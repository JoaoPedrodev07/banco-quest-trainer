"""
Admin do catálogo.

Serve para conferir e corrigir à mão o que o parser de PDF importou torto — que é
a parte do pipeline que mais precisa de olho humano.
"""

from django.contrib import admin

from .models import Alternativa, Disciplina, Fonte, Prova, Questao, Subtopico, Topico


class SubtopicoInline(admin.TabularInline):
    model = Subtopico
    extra = 0


class TopicoInline(admin.TabularInline):
    model = Topico
    extra = 0
    show_change_link = True


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
    list_display = ["nome", "disciplina", "ordem"]
    list_filter = ["disciplina"]
    inlines = [SubtopicoInline]


@admin.register(Prova)
class ProvaAdmin(admin.ModelAdmin):
    list_display = ["__str__", "ano", "banca", "qtd_questoes", "questoes_disponiveis"]
    list_filter = ["banca", "ano", "orgao"]

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
