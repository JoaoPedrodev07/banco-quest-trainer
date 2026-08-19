"""Apoio à Fase 3: verifica a migration de backfill de Concurso/Edital contra a
cópia de teste do banco, antes de aplicar na base real."""

import io
import os
import sys

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
os.environ["DATABASE_URL"] = "sqlite:///db.sqlite3.testecopia"
import django

django.setup()

from catalogo.models import Banca, Concurso, Edital, ItemEdital, Prova, Questao, Topico

SAIDA = os.path.join(os.path.dirname(__file__), "fase3_verificar_backfill_saida.txt")
f = io.open(SAIDA, "w", encoding="utf-8")

print("Bancas:", list(Banca.objects.values_list("slug", "nome")), file=f)
print(file=f)

print("Concursos:", file=f)
for c in Concurso.objects.all():
    n_provas = c.provas.count()
    print(
        f"  {c.slug}: banca={c.banca_id} status={c.status} data_prova={c.data_prova} "
        f"provas={n_provas}",
        file=f,
    )

print(file=f)
print(f"Provas SEM concurso (deveria ser 0, todas as 9 têm concurso no catálogo): "
      f"{Prova.objects.filter(concurso__isnull=True).count()}", file=f)
for p in Prova.objects.filter(concurso__isnull=True):
    print(f"  órfã: {p.id}", file=f)

print(file=f)
total_provas = Prova.objects.count()
print(f"Total provas: {total_provas}", file=f)
print(f"Total questões: {Questao.objects.count()} (deve continuar 590)", file=f)

print(file=f)
edital = Edital.objects.first()
if edital:
    print(f"Edital: concurso={edital.concurso_id} versao={edital.versao} vigente={edital.eh_vigente}", file=f)
    print(f"Itens do edital: {ItemEdital.objects.filter(edital=edital).count()}", file=f)
    print(f"Tópicos de bb-ti-2026: {Topico.objects.filter(concurso_id='bb-ti-2026').count()} (deve bater)", file=f)

    # amostra
    for item in ItemEdital.objects.select_related("topico").order_by("ordem")[:3]:
        print(f"  amostra: [{item.numeracao_original}] {item.redacao_literal[:60]} (topico={item.topico_id})", file=f)
else:
    print("NENHUM Edital criado — problema.", file=f)

f.close()
