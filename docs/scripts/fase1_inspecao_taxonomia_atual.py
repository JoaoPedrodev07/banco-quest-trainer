"""Apoio à Fase 1: inspeciona a árvore Disciplina/Topico/Subtopico já existente no
banco (vinda de `importar_edital`), para decidir como estender em vez de duplicar."""

import io
import os
import sys
from collections import Counter

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Disciplina, Questao, Subtopico, Topico

SAIDA = os.path.join(os.path.dirname(__file__), "fase1_inspecao_taxonomia_atual_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

print("Concursos distintos em Topico.concurso_id:", file=f)
for c, n in Counter(Topico.objects.values_list("concurso_id", flat=True)).most_common():
    print(f"  {c}: {n} tópicos", file=f)

print("\nDisciplinas cadastradas (id, nome, fonte):", file=f)
for d in Disciplina.objects.select_related("fonte").order_by("ordem"):
    print(f"  {d.id:<16} {d.nome:<45} fonte={d.fonte_id}", file=f)

print("\nÁrvore completa para concurso_id='bb-ti-2026':", file=f)
for disc in Disciplina.objects.order_by("ordem"):
    topicos = Topico.objects.filter(disciplina=disc, concurso_id="bb-ti-2026").order_by("ordem")
    if not topicos.exists():
        continue
    print(f"\n[{disc.id}] {disc.nome}", file=f)
    for t in topicos:
        subs = Subtopico.objects.filter(topico=t).order_by("ordem")
        n_questoes_topico = Questao.objects.filter(topico=t).count()
        print(f"  {t.id:<20} (n_questoes={n_questoes_topico}) {t.nome}", file=f)
        for s in subs:
            n_questoes_sub = Questao.objects.filter(subtopico=s).count()
            print(f"    {s.id:<24} (n_questoes={n_questoes_sub}) {s.nome}", file=f)

print(f"\nTotal Topico (todos concursos): {Topico.objects.count()}", file=f)
print(f"Total Subtopico: {Subtopico.objects.count()}", file=f)

# tamanho dos nomes, pra calibrar geração de slug
tam_nomes = [len(t.nome) for t in Topico.objects.all()]
if tam_nomes:
    print(f"\nTamanho de Topico.nome: min={min(tam_nomes)} max={max(tam_nomes)} media={sum(tam_nomes)/len(tam_nomes):.0f}", file=f)

f.close()
