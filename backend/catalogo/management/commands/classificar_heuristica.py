"""
Aplica a camada heurística de classificação (termo-âncora) às questões de TI do
BB ainda sem tópico. Fase 2 do brief "Motor de Incidência e Raio-X de Banca"
(`CLAUDE.md` §8).

    python manage.py classificar_heuristica --dry-run
    python manage.py classificar_heuristica

Cobre só o caso fácil e de graça: quando exatamente um subtópico tem termo-âncora
no enunciado. Ambíguo (mais de um bateu) ou sem sinal nenhum ficam pra Fase 2
item 2 (exportação pra IA externa) — ver `catalogo/classificacao.py` pra régua
de quando um termo entra na lista de âncoras.
"""

from __future__ import annotations

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from catalogo.classificacao import classificar_por_heuristica
from catalogo.models import ClassificacaoQuestao, OrigemClassificacao, Questao, Subtopico

# Restrito ao concurso/prova alvo desta linha de trabalho — ver docstring de
# `catalogo/classificacao.py` sobre por que não vale a pena rodar contra TI de
# outro concurso.
PROVA_ALVO = "bb-ti-2023"


class Command(BaseCommand):
    help = "Classifica por termo-âncora as questões de TI do BB ainda sem tópico."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **opts):
        questoes = Questao.objects.filter(disciplina_id="ti", prova_id=PROVA_ALVO, topico__isnull=True)

        classificados = 0
        ambiguos_ou_sem_sinal = 0
        agora = timezone.now()

        with transaction.atomic():
            for questao in questoes:
                resultado = classificar_por_heuristica(questao.enunciado, questao.texto_base)
                if resultado is None:
                    ambiguos_ou_sem_sinal += 1
                    continue

                subtopico = Subtopico.objects.select_related("topico").get(id=resultado.subtopico_id)
                termos = ", ".join(resultado.termos_casados)
                self.stdout.write(
                    f"  {questao.id} -> {resultado.subtopico_id} "
                    f"(confiança {resultado.confianca}, termos: {termos})"
                )

                if opts["dry_run"]:
                    classificados += 1
                    continue

                questao.topico = subtopico.topico
                questao.subtopico = subtopico
                questao.save(update_fields=["topico", "subtopico"])

                ClassificacaoQuestao.objects.update_or_create(
                    questao=questao,
                    eh_primaria=True,
                    defaults={
                        "topico": subtopico.topico,
                        "subtopico": subtopico,
                        "confianca": resultado.confianca,
                        "origem_classificacao": OrigemClassificacao.HEURISTICA,
                        "justificativa": f"termo-âncora: {termos}",
                        "revisada_por_humano": False,
                        "revisada_em": None,
                    },
                )
                classificados += 1

            if opts["dry_run"]:
                transaction.set_rollback(True)

        prefixo = "[simulação] " if opts["dry_run"] else ""
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefixo}{classificados} questões classificadas por heurística; "
                f"{ambiguos_ou_sem_sinal} sem sinal claro (ambíguo ou nenhum termo bateu) — "
                f"ficam pra fila de IA externa/revisão."
            )
        )
