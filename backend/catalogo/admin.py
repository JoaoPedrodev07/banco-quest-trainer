"""
Admin do catálogo.

Serve para conferir e corrigir à mão o que o parser de PDF importou torto — que é
a parte do pipeline que mais precisa de olho humano.
"""

from django.contrib import admin

from .models import (
    Alternativa,
    Banca,
    Concurso,
    Disciplina,
    Edital,
    Fonte,
    ItemEdital,
    ProblemaQuestao,
    Prova,
    Questao,
    Subtopico,
    Topico,
)


class SubtopicoInline(admin.TabularInline):
    model = Subtopico
    extra = 0


class TopicoInline(admin.TabularInline):
    model = Topico
    extra = 0
    show_change_link = True


class ProvaInline(admin.TabularInline):
    model = Prova
    extra = 0
    show_change_link = True
    fields = ["id", "ano", "cargo", "qtd_questoes"]


class ItemEditalInline(admin.TabularInline):
    model = ItemEdital
    extra = 0
    fields = ["numeracao_original", "topico", "redacao_literal"]


@admin.register(Banca)
class BancaAdmin(admin.ModelAdmin):
    list_display = ["nome", "slug"]


@admin.register(Concurso)
class ConcursoAdmin(admin.ModelAdmin):
    list_display = ["nome", "orgao", "cargo", "banca", "status", "data_prova"]
    list_filter = ["status", "banca"]
    inlines = [ProvaInline]


@admin.register(Edital)
class EditalAdmin(admin.ModelAdmin):
    list_display = ["__str__", "concurso", "versao", "eh_vigente"]
    list_filter = ["eh_vigente"]
    inlines = [ItemEditalInline]


class AlternativaInline(admin.TabularInline):
    model = Alternativa
    extra = 0
    max_num = 5


@admin.register(Fonte)
class FonteAdmin(admin.ModelAdmin):
    list_display = ["titulo", "tipo", "publicado_em", "obtido_em"]
    list_filter = ["tipo"]
    search_fields = ["titulo", "slug", "url"]


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ["nome", "id", "ordem", "fonte"]
    inlines = [TopicoInline]


@admin.register(Topico)
class TopicoAdmin(admin.ModelAdmin):
    list_display = ["nome", "disciplina", "concurso_id", "edital_ref", "ativo_edital_vigente"]
    list_filter = ["disciplina", "concurso_id", "ativo_edital_vigente"]
    inlines = [SubtopicoInline]


@admin.register(Prova)
class ProvaAdmin(admin.ModelAdmin):
    list_display = ["__str__", "concurso", "ano", "banca", "qtd_questoes", "questoes_disponiveis"]
    list_filter = ["concurso", "banca", "ano", "orgao"]

    @admin.display(description="importadas")
    def questoes_disponiveis(self, obj):
        return obj.questoes_disponiveis


@admin.register(Questao)
class QuestaoAdmin(admin.ModelAdmin):
    list_display = ["id", "disciplina", "ano", "correta", "anulada", "fonte"]
    list_filter = ["disciplina", "ano", "banca", "anulada", "fonte__tipo"]
    search_fields = ["id", "enunciado"]
    inlines = [AlternativaInline]
    autocomplete_fields = ["fonte"]


@admin.register(ProblemaQuestao)
class ProblemaQuestaoAdmin(admin.ModelAdmin):
    list_display = ["questao", "tipo", "criado_em", "resolvido_em"]
    list_filter = ["tipo", ("resolvido_em", admin.EmptyFieldListFilter)]
    search_fields = ["questao__id", "descricao"]
