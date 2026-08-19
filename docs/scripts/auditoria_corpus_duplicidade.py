"""Apoio à Fase 0: bb-comercial-a/b/c-2023 têm o MESMO título de Fonte ('caderno
tipo 1') mas sha256 diferentes — checa se são a mesma prova (conteúdo duplicado
sob 3 slugs) ou provas distintas (datas/praças diferentes com conteúdo próprio),
porque isso muda o 'n' real de qualquer estatística sobre esse acervo."""

import io
import os
import sys

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Questao

SAIDA = os.path.join(os.path.dirname(__file__), "auditoria_corpus_duplicidade_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

provas = ["bb-comercial-a-2023", "bb-comercial-b-2023", "bb-comercial-c-2023"]
mapas = {}
for p in provas:
    mapas[p] = {
        q.numero_na_prova: q.enunciado.strip()
        for q in Questao.objects.filter(prova_id=p).only("numero_na_prova", "enunciado")
    }

print("Comparação enunciado por número de questão, entre as 3 provas 'caderno tipo 1':", file=f)
numeros_comuns = sorted(set(mapas[provas[0]]) & set(mapas[provas[1]]) & set(mapas[provas[2]]))
print(f"Números de questão presentes nas 3: {len(numeros_comuns)}", file=f)

identicas_ab = sum(1 for n in numeros_comuns if mapas[provas[0]].get(n) == mapas[provas[1]].get(n))
identicas_ac = sum(1 for n in numeros_comuns if mapas[provas[0]].get(n) == mapas[provas[2]].get(n))
print(f"Enunciado idêntico A vs B (mesmo número): {identicas_ab} / {len(numeros_comuns)}", file=f)
print(f"Enunciado idêntico A vs C (mesmo número): {identicas_ac} / {len(numeros_comuns)}", file=f)

print("\nAmostra (número, primeiros 80 chars de cada versão):", file=f)
for n in numeros_comuns[:5]:
    print(f"\n  #{n}", file=f)
    for p in provas:
        print(f"    {p}: {mapas[p].get(n, '(ausente)')[:80]!r}", file=f)

# Mesmo teste para bb-2021-a/b/c
provas21 = ["bb-2021-a", "bb-2021-b", "bb-2021-c"]
mapas21 = {}
for p in provas21:
    mapas21[p] = {
        q.numero_na_prova: q.enunciado.strip()
        for q in Questao.objects.filter(prova_id=p).only("numero_na_prova", "enunciado")
    }
numeros_comuns21 = sorted(set(mapas21[provas21[0]]) & set(mapas21[provas21[1]]) & set(mapas21[provas21[2]]))
identicas_ab21 = sum(1 for n in numeros_comuns21 if mapas21[provas21[0]].get(n) == mapas21[provas21[1]].get(n))
print(f"\n\n[bb-2021-a/b/c] Números em comum: {len(numeros_comuns21)}", file=f)
print(f"Enunciado idêntico A vs B (mesmo número): {identicas_ab21} / {len(numeros_comuns21)}", file=f)

f.close()
