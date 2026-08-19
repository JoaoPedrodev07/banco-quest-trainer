from django.contrib import admin

from .models import ProgressoUsuario


@admin.register(ProgressoUsuario)
class ProgressoUsuarioAdmin(admin.ModelAdmin):
    list_display = ["usuario", "versao_backup", "atualizado_em"]
    # O blob contém raciocínios e anotações pessoais (LGPD): o admin mostra o
    # envelope, não abre o conteúdo por padrão.
    readonly_fields = ["usuario", "versao_backup", "atualizado_em"]
    exclude = ["dados"]
