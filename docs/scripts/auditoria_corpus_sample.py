"""Amostragem de apoio à Fase 0: valida a heurística de truncamento e mede a
distribuição real de caracteres finais de enunciado. Só leitura, não faz parte
do relatório principal — usado para decidir se o sinal heurístico é confiável."""

import io
import os
import sys
from collections import Counter

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Questao

SAIDA = os.path.join(os.path.dirname(__file__), "auditoria_corpus_amostra_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

finais = Counter()
for q in Questao.objects.all().only("id", "enunciado"):
    e = q.enunciado.strip()
    if e:
        finais[e[-1]] += 1

print("Distribuição do último caractere do enunciado (todas as 590 questões):", file=f)
for ch, n in finais.most_common(30):
    print(f"  {ch!r}: {n}", file=f)

print("\n--- Amostra de 15 questões marcadas 'parece truncado' (200 últimos chars) ---", file=f)
qs = list(
    Questao.objects.exclude(enunciado="")
    .only("id", "enunciado")
    .order_by("id")
)
amostra_truncadas = []
for q in qs:
    e = q.enunciado.strip()
    if e and e[-1] not in ".?!:)\"'”)":
        amostra_truncadas.append(q)
    if len(amostra_truncadas) >= 15:
        break

for q in amostra_truncadas:
    trecho = q.enunciado.strip()[-200:]
    print(f"\n[{q.id}]\n...{trecho}", file=f)

f.close()
