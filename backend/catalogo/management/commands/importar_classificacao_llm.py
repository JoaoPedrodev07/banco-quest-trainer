"""
Importa a resposta de uma IA externa gerada por `exportar_classificacao_llm`.

    python manage.py importar_classificacao_llm --arquivo resposta.json --dry-run

Formato esperado:

    {
      "bb-ti-2023-q56": {
        "assunto": "ti-t02-s03",
        "confianca": 0.9,
        "justificativa": "menciona INNER JOIN e subconsulta"
      }
    }

Regras duras (Fase 2 do `CLAUDE.md` §8):

- Recusa qualquer `assunto` que não seja um tópico/subtópico conhecido — nunca
  cria tópico na marra a partir do que a IA mandou.
- Recusa questão de outra disciplina (mesma trava de `classificar_questoes`).
- Recusa chave de questão duplicada no próprio arquivo — se o JSON colado tem a
  mesma questão duas vezes, é sinal de que o corte do lote saiu errado, e
  silenciosamente ficar com a última venceria sem avisar.
- Grava sempre com `origem_classificacao=llm_externa` e
  `revisada_por_humano=False`: essa classificação só entra com peso cheio na
  incidência depois que alguém confirmar na fila de revisão.
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from catalogo.models import ClassificacaoQuestao, OrigemClassificacao, Questao, Subtopico, Topico


class ErroDeChaveDuplicada(ValueError):
    pass


def _sem_chave_duplicada(pares: list[tuple[str, object]]) -> dict:
    chaves = [chave for chave, _ in pares]
    repetidas = {chave for chave in chaves if chaves.count(chave) > 1}
    if repetidas:
        raise ErroDeChaveDuplicada(f"questão(ões) duplicada(s) no arquivo: {', '.join(sorted(repetidas))}")
    return dict(pares)


class Command(BaseCommand):
    help = "Importa classificação de IA externa (origem=llm_externa) a partir do JSON de resposta."

    def add_arguments(self, parser):
        parser.add_argument("--arquivo", required=True)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        caminho = Path(opts["arquivo"])
        if not caminho.exists():
            raise CommandError(f"arquivo não encontrado: {caminho}")

        bruto = caminho.read_text(encoding="utf-8")
        try:
            mapa = json.loads(bruto, object_pairs_hook=_sem_chave_duplicada)
        except ErroDeChaveDuplicada as erro:
            raise CommandError(str(erro)) from erro
        except json.JSONDecodeError as erro:
            raise CommandError(f"JSON inválido: {erro}") from erro

        if not isinstance(mapa, dict) or not mapa:
            raise CommandError("o arquivo precisa ser um objeto JSON não vazio.")

        topicos = {t.id: t for t in Topico.objects.all()}
        subtopicos = {s.id: s for s in Subtopico.objects.select_related("topico").all()}
        questoes = {q.id: q for q in Questao.objects.filter(id__in=mapa.keys())}

        erros: list[str] = []
        aplicar: list[tuple[Questao, Topico, Subtopico | None, float, str]] = []

        for questao_id, item in mapa.items():
            if (
                not isinstance(item, dict)
                or "assunto" not in item
                or "confianca" not in item
                or "justificativa" not in item
            ):
                erros.append(
                    f"{questao_id}: schema inválido — precisa de assunto/confianca/justificativa"
                )
                continue

            assunto = item["assunto"]
            confianca = item["confianca"]
            justificativa = str(item["justificativa"]).strip()

            if not isinstance(assunto, str):
                erros.append(f"{questao_id}: 'assunto' precisa ser texto")
                continue
            if not isinstance(confianca, (int, float)) or isinstance(confianca, bool) or not (0.0 <= confianca <= 1.0):
                erros.append(f"{questao_id}: 'confianca' precisa ser número entre 0 e 1")
                continue
            if not justificativa:
                erros.append(f"{questao_id}: 'justificativa' é obrigatória (origem != humana)")
                continue

            questao = questoes.get(questao_id)
            if questao is None:
                erros.append(f"{questao_id}: questão não existe no banco")
                continue

            if assunto in subtopicos:
                subtopico = subtopicos[assunto]
                topico = subtopico.topico
            elif assunto in topicos:
                topico = topicos[assunto]
                subtopico = None
            else:
                erros.append(f"{questao_id}: '{assunto}' não é tópico nem subtópico conhecido")
                continue

            if topico.disciplina_id != questao.disciplina_id:
                erros.append(
                    f"{questao_id}: '{assunto}' é de '{topico.disciplina_id}', "
                    f"mas a questão é de '{questao.disciplina_id}'"
                )
                continue

            aplicar.append((questao, topico, subtopico, float(confianca), justificativa))

        if erros:
            for e in erros:
                self.stderr.write(self.style.ERROR(f"  {e}"))
            raise CommandError(f"{len(erros)} problema(s) no arquivo. Nada foi gravado.")

        if opts["dry_run"]:
            self.stdout.write(f"[simulação] {len(aplicar)} questões seriam classificadas (llm_externa).")
            return

        agora = timezone.now()
        with transaction.atomic():
            for questao, topico, subtopico, confianca, justificativa in aplicar:
                questao.topico = topico
                questao.subtopico = subtopico
                questao.save(update_fields=["topico", "subtopico"])

                ClassificacaoQuestao.objects.update_or_create(
                    questao=questao,
                    eh_primaria=True,
                    defaults={
                        "topico": topico,
                        "subtopico": subtopico,
                        "confianca": confianca,
                        "origem_classificacao": OrigemClassificacao.LLM_EXTERNA,
                        "justificativa": justificativa,
                        "revisada_por_humano": False,
                        "revisada_em": None,
                    },
                )

        self.stdout.write(
            self.style.SUCCESS(
                f"{len(aplicar)} questões classificadas (origem=llm_externa, aguardando revisão)."
            )
        )
