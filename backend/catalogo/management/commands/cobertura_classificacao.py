"""
Reporta cobertura de classificação — critério de aceite da Fase 2 do brief
"Motor de Incidência e Raio-X de Banca" (`CLAUDE.md` §8): "≥95% com
classificação primária" antes de seguir pra Fase 4.

O brief mede isso contra "o corpus" — mas a Fase 0 (`docs/auditoria-corpus.md`)
achou que só uma fatia do corpus pertence ao escopo real desta linha de trabalho
(BB, Agente de Tecnologia). Reportar um único número misturado esconderia essa
distinção outra vez, então este comando reporta os dois: o corpus inteiro (pra
transparência) e o recorte que a Fase 4 vai efetivamente usar.

    python manage.py cobertura_classificacao
"""

from __future__ import annotations

from django.core.management.base import BaseCommand

from catalogo.models import ClassificacaoQuestao, Questao

PROVA_ALVO = "bb-ti-2023"


class Command(BaseCommand):
    help = "Reporta % de questões com classificação primária — total e no recorte BB/Agente de TI."

    def handle(self, *args, **opts):
        self._linha("Corpus inteiro", Questao.objects.all())
        self.stdout.write("")
        self._linha(
            f"Recorte em escopo (prova {PROVA_ALVO}, disciplina ti)",
            Questao.objects.filter(disciplina_id="ti", prova_id=PROVA_ALVO),
        )
        self.stdout.write("")

        nao_revisadas = ClassificacaoQuestao.objects.filter(
            eh_primaria=True, revisada_por_humano=False
        ).count()
        baixa_confianca = ClassificacaoQuestao.objects.filter(
            eh_primaria=True, confianca__lt=0.8
        ).count()
        self.stdout.write(
            f"Na fila de revisão (não revisada por humano OU confiança < 0.8): "
            f"{nao_revisadas} não revisadas, {baixa_confianca} com confiança baixa "
            f"(pode haver sobreposição)."
        )

    def _linha(self, rotulo: str, qs) -> None:
        total = qs.count()
        com = qs.filter(topico__isnull=False).count()
        pct = (com * 100 // total) if total else 0
        selo = self.style.SUCCESS("OK") if pct >= 95 else self.style.WARNING("abaixo de 95%")
        self.stdout.write(f"{rotulo}: {com}/{total} ({pct}%) — {selo}")
