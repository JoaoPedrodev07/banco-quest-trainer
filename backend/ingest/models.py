"""
Registro das execuções de ingestão.

Parser de PDF erra — layout muda, coluna quebra, questão vem com imagem. Guardar
o resultado de cada rodada (o que entrou, o que falhou e por quê) é o que permite
saber se o acervo está confiável sem reabrir os PDFs na mão.
"""

from django.db import models


class Ingestao(models.Model):
    class Status(models.TextChoices):
        SUCESSO = "sucesso", "Concluída"
        PARCIAL = "parcial", "Concluída com questões descartadas"
        ERRO = "erro", "Falhou"

    prova = models.ForeignKey(
        "catalogo.Prova", on_delete=models.CASCADE, related_name="ingestoes", null=True, blank=True
    )
    arquivo_prova = models.CharField(max_length=500, blank=True)
    arquivo_gabarito = models.CharField(max_length=500, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices)
    questoes_detectadas = models.PositiveSmallIntegerField(default=0)
    questoes_importadas = models.PositiveSmallIntegerField(default=0)
    # Cada item: {"numero": 12, "motivo": "só 3 alternativas detectadas"}
    descartes = models.JSONField(default=list, blank=True)
    mensagem = models.TextField(blank=True)
    executada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "ingestão"
        verbose_name_plural = "ingestões"
        ordering = ["-executada_em"]

    def __str__(self) -> str:
        return f"{self.prova_id or 'sem prova'} — {self.get_status_display()} ({self.executada_em:%d/%m/%Y %H:%M})"
