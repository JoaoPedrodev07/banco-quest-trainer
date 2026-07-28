"""
Views da API de conteúdo — só leitura.

As listas saem **sem paginação**, como arrays puros, porque é o que o frontend já
consome hoje (`api.listQuestoes()` devolve `Questao[]`). Isso é adequado à escala
atual (dezenas a poucas centenas de questões). Quando o acervo crescer, o certo é
paginar aqui e ajustar `src/services/` junto — não deixar a lista inteira crescer
sem limite.
"""

from django.db.models import Count, Q
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .models import Disciplina, Prova, Questao
from .serializers import DisciplinaSerializer, ProvaSerializer, QuestaoSerializer


class DisciplinaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DisciplinaSerializer
    queryset = (
        Disciplina.objects.select_related("fonte")
        .prefetch_related("topicos__subtopicos")
        .all()
    )


class QuestaoFilter(filters.FilterSet):
    disciplina = filters.CharFilter(field_name="disciplina_id")
    prova = filters.CharFilter(field_name="prova_id")
    ano = filters.NumberFilter()
    ano_min = filters.NumberFilter(field_name="ano", lookup_expr="gte")
    banca = filters.CharFilter(field_name="banca", lookup_expr="iexact")
    # Só questões vindas de documento oficial da banca.
    somente_oficiais = filters.BooleanFilter(method="filtrar_oficiais")

    def filtrar_oficiais(self, queryset, nome, valor):
        if valor is None:
            return queryset
        return queryset.filter(fonte__tipo="oficial" if valor else "amostra")

    class Meta:
        model = Questao
        fields = ["disciplina", "prova", "ano", "banca"]


class QuestaoViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = QuestaoSerializer
    filterset_class = QuestaoFilter
    queryset = (
        Questao.objects.select_related("disciplina", "fonte", "prova")
        .prefetch_related("alternativas")
        .all()
    )


class ProvaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ProvaSerializer
    queryset = Prova.objects.select_related("fonte").all()
    filterset_fields = ["ano", "banca", "orgao"]


@api_view(["GET"])
def meta(request):
    """Resumo do acervo, para a UI poder dizer em que ela está se apoiando.

    A tela usa isso para exibir o aviso de amostra quando a maior parte do
    conteúdo ainda não veio de documento oficial (§2.2 do CLAUDE.md)."""
    agregado = Questao.objects.aggregate(
        total=Count("id"),
        oficiais=Count("id", filter=Q(fonte__tipo="oficial")),
        anuladas=Count("id", filter=Q(anulada=True)),
    )
    return Response(
        {
            "questoes": {
                "total": agregado["total"],
                "oficiais": agregado["oficiais"],
                "amostra": agregado["total"] - agregado["oficiais"],
                "anuladas": agregado["anuladas"],
            },
            "disciplinas": Disciplina.objects.count(),
            "provas": Prova.objects.count(),
            # O edital de 2026 ainda não existe: até ele sair, o conteúdo
            # programático exibido é o do edital anterior.
            "editalVigente": _edital_vigente(),
        }
    )


def _edital_vigente() -> dict:
    fonte = (
        Disciplina.objects.select_related("fonte")
        .order_by("ordem")
        .values_list("fonte__titulo", "fonte__url", "fonte__tipo")
        .first()
    )
    if not fonte:
        return {"titulo": None, "url": None, "tipo": None}
    titulo, url, tipo = fonte
    return {"titulo": titulo, "url": url, "tipo": tipo}
