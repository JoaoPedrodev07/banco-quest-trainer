"""
Gera o prompt que classifica um lote de questões por tópico do edital.

Existe porque a classificação é o gargalo de tudo o que o app faz de útil —
análise de incidência, plano de estudos, pontos fracos, prompt de aula — e até
agora ela dependia de alguém ler questão por questão. Isso não escala: são 364
questões sem tópico só neste acervo, e cada prova nova traz mais 60 a 70.

O ciclo é o mesmo que o das aulas: o app monta o prompt (com a árvore do edital e
os enunciados), o usuário roda numa IA gratuita, e cola o JSON de volta em
`classificar_questoes`, que **valida antes de gravar** — tópico de outra
disciplina ou id inexistente é recusado, e nada é gravado.

Essa validação é o que torna o ciclo seguro: a IA erra, e o erro dela aqui seria
invisível (uma questão sob o tópico errado continua parecendo plausível). O que
protege não é confiar na IA, é o comando recusar o que não fecha com o edital.

    python manage.py prompt_classificacao --disciplina ti --limite 40
"""

from __future__ import annotations

import re
import textwrap

from django.core.management.base import BaseCommand, CommandError

from catalogo.models import Disciplina, Questao


class Command(BaseCommand):
    help = "Gera o prompt para classificar questões sem tópico por uma IA externa."

    def add_arguments(self, parser):
        parser.add_argument("--disciplina", required=True, help="id da disciplina (ex.: ti).")
        parser.add_argument(
            "--limite",
            type=int,
            default=40,
            help="Questões por lote. Acima de ~50 o prompt fica grande demais para chat gratuito.",
        )
        parser.add_argument("--prova", default="", help="Filtra por prova (ex.: bb-2021-a).")
        parser.add_argument(
            "--saida", default="", help="Grava o prompt num arquivo em vez de imprimir."
        )

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
                    f"  manage.py classificar_questoes --arquivo <resposta>.json --dry-run"
                )
            )
        else:
            self.stdout.write(prompt)

    # ------------------------------------------------------------------ apoio

    @staticmethod
    def _arvore(disciplina: Disciplina) -> str:
        linhas: list[str] = []
        for topico in disciplina.topicos.prefetch_related("subtopicos").all():
            subtopicos = list(topico.subtopicos.all())
            if subtopicos:
                # Só o subtópico é oferecido quando ele existe: aceitar os dois
                # níveis faria a IA escolher o tópico pai por preguiça, e a
                # análise perderia o grão fino justamente onde ele existe.
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
ou depois. As chaves são os ids das questões acima; os valores, o id do assunto:

{{"exemplo-q01": "{questoes[0].disciplina_id}-t01"}}

Regras:
1. Se você não tiver certeza razoável de uma questão, **omita-a** do JSON. Uma
   questão sem assunto apenas falta na análise; uma questão sob o assunto errado
   mente nela, e ninguém percebe depois.
2. Não force distribuição uniforme: se dez questões forem do mesmo assunto,
   classifique as dez nele.
3. Algumas questões têm ruído de extração de PDF (cabeçalho de página colado no
   enunciado). Ignore o ruído; se sobrar texto insuficiente para decidir, omita.
"""
