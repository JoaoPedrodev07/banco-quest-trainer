"""Apoio à Fase 0: quantifica o padrão de corrupção de fórmula/subscrito achado
na amostragem manual (dígito colado no meio de uma palavra, sinal de que um
subscrito/sobrescrito do PDF virou caractere solto no texto extraído)."""

import io
import os
import re
import sys

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Questao

SAIDA = os.path.join(os.path.dirname(__file__), "auditoria_corpus_formula_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

# letra-dígito-letra sem espaço (ex.: "anu2al"), ou dígito solto cercado de espaços
# no meio de uma frase minúscula (ex.: "taxa anu2 al máxima") — sinal de subscrito
# do PDF que virou caractere solto.
padrao_letra_digito_letra = re.compile(
    r"[a-záàâãéêíóôõúç]\d\s?[a-záàâãéêíóôõúç]{1,3}\b|\b[a-záàâãéêíóôõúç]{1,3}\s?\d[a-záàâãéêíóôõúç]",
    re.IGNORECASE,
)

achados = []
for q in Questao.objects.filter(disciplina_id__in=["matematica", "matfinanceira", "estatistica", "ti"]).only(
    "id", "enunciado", "disciplina_id"
):
    m = padrao_letra_digito_letra.findall(q.enunciado)
    if m:
        achados.append((q.id, q.disciplina_id, m))

print(f"Questões com padrão letra-dígito-letra sem espaço no enunciado: {len(achados)}", file=f)
from collections import Counter

por_disciplina = Counter(d for _, d, _ in achados)
print("Por disciplina:", file=f)
for d, n in por_disciplina.most_common():
    print(f"  {d}: {n}", file=f)

print("\nLista completa (id, disciplina, trechos casados):", file=f)
for qid, disc, m in achados:
    print(f"  {qid} [{disc}]: {m}", file=f)

f.close()
