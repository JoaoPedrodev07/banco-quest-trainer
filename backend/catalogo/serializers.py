"""
Serializers da API de conteúdo.

O JSON sai em **camelCase** de propósito: é o formato que `src/types/index.ts` já
descreve. Assim trocar o mock pela API não exige renomear campo em nenhuma tela.
Os campos extras (`fonte`, `anulada`, `questoesDisponiveis`) são aditivos — o
frontend antigo os ignora, o novo os usa para não mentir sobre a procedência.
"""

from rest_framework import serializers

from .models import (
    Alternativa,
    Concurso,
    Aula,
    ClassificacaoQuestao,
    Disciplina,
    Fonte,
    ProblemaQuestao,
    Prova,
    Questao,
    Subtopico,
    Topico,
)


class FonteSerializer(serializers.ModelSerializer):
    eOficial = serializers.BooleanField(source="e_oficial", read_only=True)
    rotulo = serializers.SerializerMethodField()
    publicadoEm = serializers.DateField(source="publicado_em", read_only=True)

    class Meta:
        model = Fonte
        fields = ["slug", "tipo", "rotulo", "titulo", "url", "publicadoEm", "eOficial"]

    def get_rotulo(self, obj) -> str:
        # O rótulo explícito manda ("Imprensa — a confirmar"); sem ele, o nome
        # do tipo continua sendo o que a tela mostrava antes do ADR-015.
        return obj.rotulo or obj.get_tipo_display()


class SubtopicoSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subtopico
        fields = ["id", "nome"]


class TopicoSerializer(serializers.ModelSerializer):
    subtopicos = SubtopicoSerializer(many=True, read_only=True)

    class Meta:
        model = Topico
        fields = ["id", "nome", "subtopicos"]


class DisciplinaSerializer(serializers.ModelSerializer):
    # A árvore vem filtrada pelo concurso pedido. Sem isso, uma disciplina
    # traria as árvores de todos os editais juntas: o candidato do BB veria
    # DevOps e contêineres (que são do edital do BNB) no seu edital, e o
    # progresso sairia sobre um denominador que inclui matéria que ele não faz.
    topicos = serializers.SerializerMethodField()

    def get_topicos(self, disciplina):
        concurso_id = self.context.get("concurso_id")
        topicos = [
            t for t in disciplina.topicos.all() if not concurso_id or t.concurso_id == concurso_id
        ]
        return TopicoSerializer(topicos, many=True).data
    fonte = FonteSerializer(read_only=True)

    class Meta:
        model = Disciplina
        fields = ["id", "nome", "cor", "topicos", "fonte"]


class AlternativaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alternativa
        fields = ["letra", "texto"]


class QuestaoSerializer(serializers.ModelSerializer):
    disciplinaId = serializers.CharField(source="disciplina_id", read_only=True)
    provaId = serializers.CharField(source="prova_id", read_only=True, allow_null=True)
    numeroNaProva = serializers.IntegerField(source="numero_na_prova", read_only=True)
    textoBase = serializers.CharField(source="texto_base", read_only=True)
    # A classificação sai na API porque a tela precisa achar as questões de um
    # subtópico para montar o prompt de estudo. Vem nula enquanto a questão não
    # foi classificada — e a UI conta quantas faltam em vez de fingir cobertura.
    topicoId = serializers.CharField(source="topico_id", read_only=True, allow_null=True)
    subtopicoId = serializers.CharField(source="subtopico_id", read_only=True, allow_null=True)
    # `tipo` diz como interpretar `correta`: em certo/errado o "C" é "Certo",
    # não a alternativa C. Sem ele a tela corrigiria contra a letra errada.
    pontuacaoLiquida = serializers.BooleanField(
        source="prova.pontuacao_liquida", read_only=True, default=False
    )
    alternativas = AlternativaSerializer(many=True, read_only=True)
    fonte = FonteSerializer(read_only=True)

    class Meta:
        model = Questao
        fields = [
            "id",
            "disciplinaId",
            "provaId",
            "numeroNaProva",
            "topicoId",
            "subtopicoId",
            "tipo",
            "pontuacaoLiquida",
            "ano",
            "banca",
            "textoBase",
            "enunciado",
            "alternativas",
            "correta",
            "explicacao",
            "anulada",
            "fonte",
        ]


class ProvaSerializer(serializers.ModelSerializer):
    qtdQuestoes = serializers.IntegerField(source="qtd_questoes", read_only=True)
    # Quantas questões dessa prova estão de fato no banco. A tela precisa dos dois
    # números para não sugerir que uma importação parcial é a prova inteira.
    questoesDisponiveis = serializers.IntegerField(source="questoes_disponiveis", read_only=True)
    urlProva = serializers.CharField(source="url_prova", read_only=True)
    urlGabarito = serializers.CharField(source="url_gabarito", read_only=True)
    fonte = FonteSerializer(read_only=True)
    # Fase 3 (`CLAUDE.md` §8): campo aditivo — nulo enquanto uma prova nova não
    # foi ligada a um concurso. Front antigo ignora; é o que `?concurso=` filtra.
    concursoId = serializers.CharField(source="concurso_id", read_only=True, allow_null=True)

    class Meta:
        model = Prova
        fields = [
            "id",
            "concursoId",
            "ano",
            "banca",
            "cargo",
            "orgao",
            "qtdQuestoes",
            "questoesDisponiveis",
            "urlProva",
            "urlGabarito",
            "fonte",
        ]


class AulaSerializer(serializers.ModelSerializer):
    """Aula de uma unidade do edital.

    `unidadeId` é o campo que a tela usa: ela conhece a linha do edital por um id
    só (o do subtópico, ou o do tópico quando a disciplina não tem subdivisão) e
    não deveria precisar saber qual dos dois é. Na escrita, o serializer resolve
    esse id para o par (tópico, subtópico) — é o único lugar que precisa entender
    a diferença.
    """

    unidadeId = serializers.CharField(write_only=True)
    concursoId = serializers.CharField(source="concurso_id")
    conteudoMarkdown = serializers.CharField(source="conteudo_markdown")
    geradoEm = serializers.DateTimeField(source="gerado_em", read_only=True)
    versao = serializers.IntegerField(read_only=True)
    promptVersao = serializers.CharField(
        source="prompt_versao", required=False, allow_blank=True, default=""
    )

    class Meta:
        model = Aula
        fields = [
            "unidadeId",
            "concursoId",
            "conteudoMarkdown",
            "geradoEm",
            "modelo",
            "versao",
            "promptVersao",
        ]

    def to_representation(self, instance):
        dados = super().to_representation(instance)
        dados["unidadeId"] = instance.unidade_id
        return dados

    def validate_unidadeId(self, valor):
        if Subtopico.objects.filter(pk=valor).exists() or Topico.objects.filter(pk=valor).exists():
            return valor
        raise serializers.ValidationError(
            f"'{valor}' não é tópico nem subtópico do edital. "
            "Aula presa a uma unidade inexistente nunca apareceria na tela."
        )

    def create(self, validated_data):
        from django.utils import timezone

        unidade_id = validated_data.pop("unidadeId")
        subtopico = Subtopico.objects.filter(pk=unidade_id).select_related("topico").first()
        topico = subtopico.topico if subtopico else Topico.objects.get(pk=unidade_id)

        # Versionamento (ADR-016): regravar NÃO sobrescreve — a corrente vira
        # histórico (substituida_em) e nasce a versão seguinte. Antes era
        # update_or_create, e "Substituir aula" apagava o texto anterior sem volta.
        corrente = Aula.objects.filter(
            topico=topico,
            subtopico=subtopico,
            concurso_id=validated_data["concurso_id"],
            substituida_em__isnull=True,
        ).first()
        proxima_versao = 1
        if corrente:
            proxima_versao = corrente.versao + 1
            corrente.substituida_em = timezone.now()
            corrente.save(update_fields=["substituida_em"])

        return Aula.objects.create(
            topico=topico,
            subtopico=subtopico,
            concurso_id=validated_data["concurso_id"],
            conteudo_markdown=validated_data["conteudo_markdown"],
            modelo=validated_data.get("modelo", ""),
            prompt_versao=validated_data.get("prompt_versao", ""),
            versao=proxima_versao,
        )


class ClassificacaoQuestaoSerializer(serializers.ModelSerializer):
    """Fila de revisão da Fase 2 (`CLAUDE.md` §8): classificação automática
    (heurística ou IA externa) que ainda não foi confirmada por um humano."""

    questaoId = serializers.CharField(source="questao_id", read_only=True)
    enunciado = serializers.SerializerMethodField()
    disciplinaId = serializers.CharField(source="topico.disciplina_id", read_only=True)
    topicoId = serializers.CharField(source="topico_id", read_only=True)
    topicoNome = serializers.CharField(source="topico.nome", read_only=True)
    subtopicoId = serializers.CharField(source="subtopico_id", read_only=True, allow_null=True)
    subtopicoNome = serializers.CharField(source="subtopico.nome", read_only=True, allow_null=True, default=None)
    origemClassificacao = serializers.CharField(source="origem_classificacao", read_only=True)
    revisadaPorHumano = serializers.BooleanField(source="revisada_por_humano", read_only=True)
    revisadaEm = serializers.DateTimeField(source="revisada_em", read_only=True)
    # Quantas questões o tópico já tem — é o critério de "impacto" que decide a
    # ordem da fila (CLAUDE.md §8: tópico com mais questões entra primeiro,
    # porque uma classificação errada ali distorce mais estatística).
    impactoTopico = serializers.SerializerMethodField()

    class Meta:
        model = ClassificacaoQuestao
        fields = [
            "id",
            "questaoId",
            "enunciado",
            "disciplinaId",
            "topicoId",
            "topicoNome",
            "subtopicoId",
            "subtopicoNome",
            "confianca",
            "origemClassificacao",
            "justificativa",
            "revisadaPorHumano",
            "revisadaEm",
            "impactoTopico",
        ]

    def get_enunciado(self, obj):
        import textwrap

        return textwrap.shorten(obj.questao.enunciado, 240, placeholder="…")

    def get_impactoTopico(self, obj):
        return obj.topico.classificacoes.filter(eh_primaria=True).count()


class ProblemaQuestaoSerializer(serializers.ModelSerializer):
    """Fila de curadoria de problemas reportados (ADR-014)."""

    questaoId = serializers.CharField(source="questao_id", read_only=True)
    enunciado = serializers.SerializerMethodField()
    tipoRotulo = serializers.CharField(source="get_tipo_display", read_only=True)
    criadoEm = serializers.DateTimeField(source="criado_em", read_only=True)

    class Meta:
        model = ProblemaQuestao
        fields = ["id", "questaoId", "enunciado", "tipo", "tipoRotulo", "descricao", "criadoEm"]

    def get_enunciado(self, obj) -> str:
        texto = obj.questao.enunciado
        return texto[:280] + ("…" if len(texto) > 280 else "")


class ConcursoSerializer(serializers.ModelSerializer):
    """Catálogo de concursos (ADR-015), no shape exato do tipo `Concurso` do
    frontend — trocar o hardcoded pela API não renomeia campo nenhum."""

    id = serializers.CharField(source="slug", read_only=True)
    banca = serializers.SerializerMethodField()
    salario = serializers.SerializerMethodField()
    dataProva = serializers.DateField(source="data_prova", read_only=True)
    editalUrl = serializers.SerializerMethodField()
    provaIds = serializers.SerializerMethodField()
    fonte = FonteSerializer(read_only=True)

    class Meta:
        model = Concurso
        fields = [
            "id",
            "nome",
            "orgao",
            "cargo",
            "banca",
            "salario",
            "vagas",
            "status",
            "dataProva",
            "editalUrl",
            "provaIds",
            "fonte",
        ]

    def get_banca(self, obj):
        return obj.banca.nome if obj.banca_id else None

    def get_salario(self, obj):
        if obj.salario_valor is None:
            return None
        salario = {"valor": float(obj.salario_valor)}
        if obj.salario_observacao:
            salario["observacao"] = obj.salario_observacao
        return salario

    def get_editalUrl(self, obj):
        # O frontend espera string | null; URLField vazio é "".
        return obj.edital_url or None

    def get_provaIds(self, obj):
        return [p.id for p in obj.provas.all()]
