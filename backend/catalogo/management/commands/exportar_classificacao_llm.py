"""
Gera o prompt de classificação para uma IA externa — variante da Fase 2 do brief
"Motor de Incidência e Raio-X de Banca" (`CLAUDE.md` §8) que pede confiança e
justificativa por questão, porque o motor de incidência precisa saber quanto
confiar em cada classificação automática antes de contar com peso cheio.

Não substitui `prompt_classificacao` (mantido como está, é o caminho que já
funciona pra classificação "humana" via `classificar_questoes`) — este é o
caminho que alimenta `importar_classificacao_llm`, com origem=llm_externa
rastreada.

    python manage.py exportar_classificacao_llm --disciplina ti --limite 40
"""

from __future__ import annotations

import re
import textwrap

from django.core.management.base import BaseCommand, CommandError

from catalogo.models import Disciplina, Questao


class Command(BaseCommand):
    help = "Gera o prompt (com pedido de confiança/justificativa) para classificação por IA externa."

    def add_arguments(self, parser):
        parser.add_argument("--disciplina", required=True, help="id da disciplina (ex.: ti).")
        parser.add_argument("--limite", type=int, default=40)
        parser.add_argument("--prova", default="", help="Filtra por prova (ex.: bb-ti-2023).")
        parser.add_argument("--saida", default="")

    def handle(self, *args, **op):
        disciplina = Disciplina.objects.filter(pk=op["disciplina"]).first()
        if disciplina is None:
            raise CommandError(f"disciplina {op['disciplina']!r} não existe no catálogo.")

        questoes = Questao.objects.filter(disciplina=disciplina, topico__isnull=True)
        if op["prova"]:
            questoes = questoes.filter(prova_id=op["prova"])
        questoes = list(questoes.order_by("prova_id", "numero_na_prova")[: op["limite"]])

        if not questoes:
            self.stdout.write(self.style.SUCCESS(f"{disciplina.nome}: nada por classificar."))
            return

        arvore = self._arvore(disciplina)
        prompt = self._montar(disciplina, arvore, questoes)

        if op["saida"]:
            with open(op["saida"], "w", encoding="utf-8") as arquivo:
                arquivo.write(prompt)
            self.stdout.write(
                self.style.SUCCESS(
                    f"{len(questoes)} questões de {disciplina.nome} → {op['saida']}\n"
                    f"Cole o conteúdo numa IA, salve a resposta como JSON e rode:\n"
                    f"  manage.py importar_classificacao_llm --arquivo <resposta>.json --dry-run"
                )
            )
        else:
            self.stdout.write(prompt)

    @staticmethod
    def _arvore(disciplina: Disciplina) -> str:
        linhas: list[str] = []
        for topico in disciplina.topicos.prefetch_related("subtopicos").all():
            subtopicos = list(topico.subtopicos.all())
            if subtopicos:
                for sub in subtopicos:
                    linhas.append(f"- {sub.id} — {topico.nome} › {sub.nome}")
            else:
                linhas.append(f"- {topico.id} — {topico.nome}")
        return "\n".join(linhas)

    @staticmethod
    def _montar(disciplina: Disciplina, arvore: str, questoes: list[Questao]) -> str:
        blocos = []
        for questao in questoes:
            enunciado = re.sub(r"\s+", " ", questao.enunciado).strip()
            blocos.append(f"### {questao.id}\n{textwrap.shorten(enunciado, 420, placeholder='…')}")

        exemplo_assunto = questoes[0].disciplina_id + "-t01"
        return f"""Classifique questões de concurso público por assunto do edital.

## Disciplina
{disciplina.nome}

## Assuntos permitidos
Use EXATAMENTE um destes identificadores. Não invente id, nem use nome no lugar do id.

{arvore}

## Questões

{chr(10).join(blocos)}

## O que devolver
Um objeto JSON e **nada além dele** — sem cercas de código, sem explicação antes
ou depois. As chaves são os ids das questões acima; os valores, um objeto com
três campos:

{{
  "exemplo-q01": {{
    "assunto": "{exemplo_assunto}",
    "confianca": 0.9,
    "justificativa": "cite o trecho ou termo do enunciado que te fez decidir"
  }}
}}

Regras:
1. `confianca` é um número de 0 a 1 — sua confiança real, não um número decorativo.
   Se não tiver certeza razoável, **omita a questão inteira** do JSON em vez de
   forçar uma confiança baixa: uma questão sem assunto só falta na análise; uma
   questão sob o assunto errado mente nela, e ninguém percebe depois.
2. `justificativa` é obrigatória e curta (uma frase). Cite o que no enunciado
   sustenta a escolha.
3. Não force distribuição uniforme: se dez questões forem do mesmo assunto,
   classifique as dez nele.
4. Algumas questões têm ruído de extração de PDF (cabeçalho de página colado no
   enunciado). Ignore o ruído; se sobrar texto insuficiente para decidir, omita.
"""
