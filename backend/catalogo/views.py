"""
Views da API de conteúdo — só leitura.

As listas saem **sem paginação**, como arrays puros, porque é o que o frontend já
consome hoje (`api.listQuestoes()` devolve `Questao[]`). Isso é adequado à escala
atual (dezenas a poucas centenas de questões). Quando o acervo crescer, o certo é
paginar aqui e ajustar `src/services/` junto — não deixar a lista inteira crescer
sem limite.
"""

from django.db.models import Count, OuterRef, Q, Subquery
from django.utils import timezone
from django_filters import rest_framework as filters
from rest_framework import viewsets
from rest_framework.decorators import action, api_view
from rest_framework.response import Response

from .models import (
    Aula,
    ClassificacaoQuestao,
    Disciplina,
    ProblemaQuestao,
    Prova,
    Questao,
    TipoProblema,
)
from .serializers import (
    AulaSerializer,
    ClassificacaoQuestaoSerializer,
    DisciplinaSerializer,
    ProblemaQuestaoSerializer,
    ProvaSerializer,
    QuestaoSerializer,
)


class AvisoRecorteSemConcursoMixin:
    """Fase 3 (`CLAUDE.md` §8): os endpoints de conteúdo ganharam `?concurso=`,
    mas continuam devolvendo tudo sem o parâmetro — trocar o comportamento
    padrão quebraria o frontend atual, que ainda faz esse recorte sozinho em
    `useAcervoDoConcurso`. O header é o aviso de que isso é transitório; a troca
    do frontend para depender do filtro do backend é um passo à parte (o
    brief pede commit separado), não decisão para tomar aqui.
    """

    query_param_concurso = "concurso"

    def list(self, request, *args, **kwargs):
        resposta = super().list(request, *args, **kwargs)
        if not request.query_params.get(self.query_param_concurso):
            # Header HTTP precisa ser ASCII — sem acento, sem travessão, para não
            # sair codificado em RFC 2047 (=?utf-8?q?...=) e virar ilegível pra
            # quem ler o header cru em vez de decodificar.
            resposta["X-Deprecation-Warning"] = (
                f"Response not scoped by concurso. Pass ?{self.query_param_concurso}=<slug> "
                "- unscoped behavior will be removed once the frontend migrates to this "
                "filter (CLAUDE.md doc, Fase 3 secao 8)."
            )
        return resposta


class DisciplinaViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DisciplinaSerializer

    def get_serializer_context(self):
        # `?concursoId=` escolhe a árvore do edital. Sem o parâmetro devolve tudo,
        # para não quebrar quem já consome a rota sem saber de concurso.
        contexto = super().get_serializer_context()
        contexto["concurso_id"] = self.request.query_params.get("concursoId")
        return contexto

    queryset = (
        Disciplina.objects.select_related("fonte")
        .prefetch_related("topicos__subtopicos")
        .all()
    )


class QuestaoFilter(filters.FilterSet):
    disciplina = filters.CharFilter(field_name="disciplina_id")
    prova = filters.CharFilter(field_name="prova_id")
    # Fase 3 (`CLAUDE.md` §8): recorte por concurso direto no backend, via
    # `Prova.concurso` — a questão não tem concurso próprio, ela herda da prova.
    concurso = filters.CharFilter(field_name="prova__concurso_id")
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
        fields = ["disciplina", "prova", "concurso", "ano", "banca"]


class QuestaoViewSet(AvisoRecorteSemConcursoMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = QuestaoSerializer
    filterset_class = QuestaoFilter
    queryset = (
        Questao.objects.select_related("disciplina", "fonte", "prova")
        .prefetch_related("alternativas")
        .all()
    )


class ProvaViewSet(AvisoRecorteSemConcursoMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = ProvaSerializer
    queryset = Prova.objects.select_related("fonte").all()
    filterset_fields = ["ano", "banca", "orgao", "concurso"]


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


class AulaViewSet(viewsets.ModelViewSet):
    """Aulas do acervo. **Este é o primeiro endpoint de escrita da API.**

    Escrita liberada sem autenticação é uma decisão consciente e limitada a este
    uso: o app roda em `127.0.0.1`, é de um usuário só, e não há login em lugar
    nenhum do projeto. Se um dia isto for exposto na rede, **este endpoint é o
    primeiro que precisa de autenticação** — hoje qualquer um que alcance a porta
    8000 pode gravar aula e explicação.

    O corpo aceita `unidadeId` (tópico ou subtópico) e regrava a aula existente
    daquela unidade, em vez de acumular versões.
    """

    serializer_class = AulaSerializer
    # Só as correntes: o histórico de versões (ADR-016) fica no admin. Devolver
    # todas faria a tela ter de escolher entre versões sem critério.
    queryset = (
        Aula.objects.select_related("topico", "subtopico")
        .filter(substituida_em__isnull=True)
        .all()
    )
    filterset_fields = ["concurso_id"]
    # `unidade_id` é propriedade, não coluna: a rota por id usaria o pk inteiro, e
    # a tela não conhece esse número. Buscar é por lista filtrada.
    http_method_names = ["get", "post", "delete", "head", "options"]


class ClassificacaoQuestaoViewSet(viewsets.ReadOnlyModelViewSet):
    """Fila de revisão da Fase 2 (`CLAUDE.md` §8).

    Só lista o que precisa de olho humano: classificação primária que ainda não
    foi revisada — confiança baixa ou vinda de heurística/IA externa. O que já
    passou pela revisão (`revisada_por_humano=True`) sai da lista porque a fila
    é trabalho pendente, não histórico; histórico é o admin do Django.

    Escrita é só a ação `revisar` — não há endpoint pra criar classificação por
    aqui, isso é dos comandos de management (`classificar_questoes`,
    `classificar_heuristica`, `importar_classificacao_llm`), que são os únicos
    lugares que também sincronizam `Questao.topico`/`subtopico`.
    """

    serializer_class = ClassificacaoQuestaoSerializer

    def get_queryset(self):
        # Subquery, não annotate direto: `topico__classificacoes` volta pra
        # mesma tabela, e um Count anotado por JOIN nesse caminho multiplicaria
        # linha por causa do fan-out — a Subquery isola a contagem por tópico
        # sem mexer na cardinalidade da queryset principal.
        impacto = (
            ClassificacaoQuestao.objects.filter(topico_id=OuterRef("topico_id"), eh_primaria=True)
            .values("topico_id")
            .annotate(n=Count("id"))
            .values("n")
        )
        return (
            ClassificacaoQuestao.objects.filter(eh_primaria=True, revisada_por_humano=False)
            .filter(Q(confianca__lt=0.8) | ~Q(origem_classificacao="humana"))
            .select_related("questao", "topico", "subtopico")
            .annotate(impacto_topico=Subquery(impacto))
            .order_by("-impacto_topico")
        )

    @action(detail=True, methods=["post"])
    def revisar(self, request, pk=None):
        classificacao = self.get_object()
        classificacao.revisada_por_humano = True
        classificacao.revisada_em = timezone.now()
        classificacao.save(update_fields=["revisada_por_humano", "revisada_em"])

        # A revisão confirma a classificação primária corrente — reflete em
        # Questao.topico/subtopico pela mesma disciplina de escrita única que os
        # comandos de management seguem (ver docstring de ClassificacaoQuestao).
        questao = classificacao.questao
        questao.topico = classificacao.topico
        questao.subtopico = classificacao.subtopico
        questao.save(update_fields=["topico", "subtopico"])

        return Response(ClassificacaoQuestaoSerializer(classificacao).data)


@api_view(["POST"])
def reportar_problema(request, questao_id: str):
    """Registra um problema reportado numa questão (ADR-014).

    É sinal para curadoria, nunca correção automática: a questão não muda aqui.
    Sem autenticação como todo endpoint de escrita atual — mesma ressalva
    documentada do `AulaViewSet`.
    """
    questao = Questao.objects.filter(pk=questao_id).first()
    if questao is None:
        return Response({"erro": f"questão '{questao_id}' não existe."}, status=404)

    dados = request.data or {}
    tipo = dados.get("tipo", "")
    if tipo not in TipoProblema.values:
        return Response(
            {"erro": f"tipo inválido. Use um de: {', '.join(TipoProblema.values)}."}, status=400
        )

    problema = ProblemaQuestao.objects.create(
        questao=questao, tipo=tipo, descricao=str(dados.get("descricao", "")).strip()
    )
    return Response(ProblemaQuestaoSerializer(problema).data, status=201)


class ProblemaQuestaoViewSet(viewsets.ReadOnlyModelViewSet):
    """Fila de curadoria de problemas reportados (ADR-014).

    Só os abertos — resolvido sai da lista porque fila é trabalho pendente, não
    histórico (histórico é o admin). Mesmo desenho da fila de classificação.
    """

    serializer_class = ProblemaQuestaoSerializer
    queryset = (
        ProblemaQuestao.objects.filter(resolvido_em__isnull=True)
        .select_related("questao")
        .order_by("criado_em")
    )

    @action(detail=True, methods=["post"])
    def resolver(self, request, pk=None):
        problema = self.get_object()
        problema.resolvido_em = timezone.now()
        problema.save(update_fields=["resolvido_em"])
        return Response(ProblemaQuestaoSerializer(problema).data)


@api_view(["POST"])
def comentar_gabarito(request, questao_id: str):
    """Grava o gabarito comentado de uma questão.

    O texto é conteúdo gerado (o usuário traz de uma IA de fora), e não sai da
    banca. Fica em `Questao.explicacao`, campo que já existia vazio, e a tela que
    o exibe precisa dizer que é comentário gerado — a banca publica gabarito, não
    explicação.
    """
    questao = Questao.objects.filter(pk=questao_id).first()
    if questao is None:
        return Response({"erro": f"questão '{questao_id}' não existe."}, status=404)

    texto = (request.data or {}).get("explicacao", "")
    if not isinstance(texto, str) or not texto.strip():
        return Response({"erro": "campo 'explicacao' vazio."}, status=400)

    questao.explicacao = texto.strip()
    questao.save(update_fields=["explicacao", "atualizada_em"])
    return Response({"id": questao.id, "explicacao": questao.explicacao})
