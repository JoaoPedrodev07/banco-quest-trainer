"""Apoio à Fase 0: cruza disciplina 'ti' com prova/cargo/órgão, para checar o
recorte real do escopo 'BB / Agente de Tecnologia' (§8 do CLAUDE.md) dentro do
corpus total de 590 questões."""

import io
import os
import sys
from collections import Counter

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Questao

SAIDA = os.path.join(os.path.dirname(__file__), "auditoria_corpus_escopo_ti_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

print("Questões de disciplina='ti', por prova (id / órgão / cargo / ano / banca):", file=f)
qs = Questao.objects.filter(disciplina_id="ti").select_related("prova", "prova__fonte")
por_prova = Counter(q.prova_id for q in qs)
for prova_id, n in por_prova.most_common():
    q0 = qs.filter(prova_id=prova_id).first()
    if q0 and q0.prova:
        p = q0.prova
        print(f"  {prova_id}: {n} questões — {p.orgao} / {p.cargo} / {p.ano} / {p.banca}", file=f)
    else:
        print(f"  {prova_id}: {n} questões — (sem prova associada)", file=f)

print(f"\nTotal disciplina='ti': {qs.count()}", file=f)

print("\nDentre essas, com tópico atribuído, por prova:", file=f)
com_topico = qs.exclude(topico__isnull=True)
por_prova_topico = Counter(q.prova_id for q in com_topico)
for prova_id, n in por_prova_topico.most_common():
    print(f"  {prova_id}: {n}", file=f)
print(f"Total 'ti' com tópico: {com_topico.count()}", file=f)

print("\n--- Recorte estrito: só prova bb-ti-2023 (cargo Agente de Tecnologia) ---", file=f)
bb_ti = Questao.objects.filter(prova_id="bb-ti-2023")
print(f"Total de questões em bb-ti-2023 (todas disciplinas, é prova completa com CB): {bb_ti.count()}", file=f)
print("Por disciplina:", file=f)
for disc, n in Counter(bb_ti.values_list("disciplina_id", flat=True)).most_common():
    print(f"  {disc}: {n}", file=f)
bb_ti_ti = bb_ti.filter(disciplina_id="ti")
print(f"\nSó disciplina 'ti' dentro de bb-ti-2023: {bb_ti_ti.count()}", file=f)
print(f"  com tópico: {bb_ti_ti.exclude(topico__isnull=True).count()}", file=f)

f.close()
