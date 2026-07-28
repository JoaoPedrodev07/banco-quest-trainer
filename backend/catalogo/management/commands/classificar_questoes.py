"""
Aplica a classificação de questões por tópico/subtópico do edital.

A classificação vem de um arquivo JSON, e não de heurística no código, porque
decidir que "q56 é SQL2008" exige ler o enunciado — palavra-chave erra em silêncio
e a análise de incidência herda o erro sem ninguém perceber.

O comando recusa mapeamento incoerente (tópico de outra disciplina, id que não
existe) em vez de gravar torto: uma questão sob o tópico errado é pior do que uma
questão sem tópico, porque a primeira mente na estatística e a segunda só falta
nela — e a tela sabe contar o que falta.

Formato do arquivo:

    {
      "bb-ti-2023-q56": "ti-t02-s03",   # subtópico (grão fino)
      "bb-ti-2023-q54": "ti-t02"        # tópico, quando não há subtópico aplicável
    }
"""

from __future__ import annotations

import json
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalogo.models import Questao, Subtopico, Topico


class Command(BaseCommand):
    help = "Classifica questões por tópico/subtópico a partir de um JSON."

    def add_arguments(self, parser):
        parser.add_argument("--arquivo", required=True, help="JSON {questao_id: topico_ou_subtopico_id}")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Valida e mostra o resultado sem gravar.",
        )

    def handle(self, *args, **opts):
        caminho = Path(opts["arquivo"])
        if not caminho.exists():
            raise CommandError(f"arquivo não encontrado: {caminho}")

        mapa: dict[str, str] = json.loads(caminho.read_text(encoding="utf-8"))
        if not mapa:
            raise CommandError("o arquivo não tem nenhuma classificação.")

        topicos = {t.id: t for t in Topico.objects.all()}
        subtopicos = {s.id: s for s in Subtopico.objects.select_related("topico").all()}
        questoes = {q.id: q for q in Questao.objects.filter(id__in=mapa.keys())}

        erros: list[str] = []
        aplicar: list[Questao] = []

        for questao_id, alvo_id in mapa.items():
            questao = questoes.get(questao_id)
            if questao is None:
                erros.append(f"{questao_id}: questão não existe no banco")
                continue

            if alvo_id in subtopicos:
                sub = subtopicos[alvo_id]
                topico = sub.topico
                questao.subtopico = sub
            elif alvo_id in topicos:
                topico = topicos[alvo_id]
                questao.subtopico = None
            else:
                erros.append(f"{questao_id}: '{alvo_id}' não é tópico nem subtópico conhecido")
                continue

            # A trava que importa: o tópico tem de ser da mesma disciplina da
            # questão. Sem isso, um id trocado moveria a questão de disciplina sem
            # aviso e o total por disciplina passaria a mentir.
            if topico.disciplina_id != questao.disciplina_id:
                erros.append(
                    f"{questao_id}: '{alvo_id}' é de '{topico.disciplina_id}', "
                    f"mas a questão é de '{questao.disciplina_id}'"
                )
                continue

            questao.topico = topico
            aplicar.append(questao)

        if erros:
            for e in erros:
                self.stderr.write(self.style.ERROR(f"  {e}"))
            raise CommandError(f"{len(erros)} problema(s) no mapeamento. Nada foi gravado.")

        if opts["dry_run"]:
            self.stdout.write(f"[simulação] {len(aplicar)} questões seriam classificadas.")
            self._resumo()
            return

        with transaction.atomic():
            Questao.objects.bulk_update(aplicar, ["topico", "subtopico"])

        self.stdout.write(self.style.SUCCESS(f"{len(aplicar)} questões classificadas."))
        self._resumo()

    def _resumo(self) -> None:
        total = Questao.objects.count()
        com = Questao.objects.filter(topico__isnull=False).count()
        self.stdout.write(f"cobertura: {com}/{total} questões com tópico ({com * 100 // max(total, 1)}%).")
