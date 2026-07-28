"""
Serializers da API de conteúdo.

O JSON sai em **camelCase** de propósito: é o formato que `src/types/index.ts` já
descreve. Assim trocar o mock pela API não exige renomear campo em nenhuma tela.
Os campos extras (`fonte`, `anulada`, `questoesDisponiveis`) são aditivos — o
frontend antigo os ignora, o novo os usa para não mentir sobre a procedência.
"""

from rest_framework import serializers

from .models import Alternativa, Aula, Disciplina, Fonte, Prova, Questao, Subtopico, Topico


class FonteSerializer(serializers.ModelSerializer):
    eOficial = serializers.BooleanField(source="e_oficial", read_only=True)
    rotulo = serializers.CharField(source="get_tipo_display", read_only=True)
    publicadoEm = serializers.DateField(source="publicado_em", read_only=True)

    class Meta:
        model = Fonte
        fields = ["slug", "tipo", "rotulo", "titulo", "url", "publicadoEm", "eOficial"]


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

    class Meta:
        model = Prova
        fields = [
            "id",
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

    class Meta:
        model = Aula
        fields = ["unidadeId", "concursoId", "conteudoMarkdown", "geradoEm", "modelo"]

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
        unidade_id = validated_data.pop("unidadeId")
        subtopico = Subtopico.objects.filter(pk=unidade_id).select_related("topico").first()
        topico = subtopico.topico if subtopico else Topico.objects.get(pk=unidade_id)

        # `update_or_create` e não `create`: a unicidade por (unidade, concurso) é
        # garantida no banco, e regravar precisa substituir a aula anterior em vez
        # de estourar erro de constraint na cara do usuário.
        aula, _ = Aula.objects.update_or_create(
            topico=topico,
            subtopico=subtopico,
            concurso_id=validated_data["concurso_id"],
            defaults={
                "conteudo_markdown": validated_data["conteudo_markdown"],
                "modelo": validated_data.get("modelo", ""),
            },
        )
        return aula
