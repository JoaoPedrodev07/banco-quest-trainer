"""
Conta e progresso do usuário (ADR-021, Onda 1 da rota SaaS).

O progresso é UM blob por usuário, no shape exato do backup v2 do frontend
(`src/lib/backup.ts`) — não são 8 tabelas relacionais, de propósito: o cliente
já serializa/valida esse formato, nenhuma feature atual consulta dentro do
progresso no servidor (as análises são calculadas no cliente, §2.3), e um blob
por usuário torna vazamento entre contas estruturalmente impossível. Quando
existir um consumidor server-side (ranking, análise agregada), granularizar é
um comando de migração que lê JSON — o caminho inverso é que seria caro.
"""

from django.conf import settings
from django.db import models


class ProgressoUsuario(models.Model):
    usuario = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="progresso"
    )
    # Shape de Backup["progresso"] (src/lib/backup.ts). O servidor guarda e
    # devolve; quem valida o conteúdo é o `lerBackup` do cliente — mesma regra
    # do import de arquivo.
    dados = models.JSONField()
    versao_backup = models.PositiveSmallIntegerField(default=2)
    # É a "base" do controle de concorrência: o PUT envia o valor que conhece e
    # leva 409 se outro dispositivo salvou depois (ADR-021).
    atualizado_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "progresso de usuário"
        verbose_name_plural = "progressos de usuários"

    def __str__(self) -> str:
        return f"progresso de {self.usuario_id} (v{self.versao_backup})"
