"""
Serializers da API de conteúdo.

O JSON sai em **camelCase** de propósito: é o formato que `src/types/index.ts` já
descreve. Assim trocar o mock pela API não exige renomear campo em nenhuma tela.
Os campos extras (`fonte`, `anulada`, `questoesDisponiveis`) são aditivos — o
frontend antigo os ignora, o novo os usa para não mentir sobre a procedência.
"""

from rest_framework import serializers

from .models import Alternativa, Disciplina, Fonte, Prova, Questao, Subtopico, Topico


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
    topicos = TopicoSerializer(many=True, read_only=True)
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
    alternativas = AlternativaSerializer(many=True, read_only=True)
    fonte = FonteSerializer(read_only=True)

    class Meta:
        model = Questao
        fields = [
            "id",
            "disciplinaId",
            "provaId",
            "numeroNaProva",
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
