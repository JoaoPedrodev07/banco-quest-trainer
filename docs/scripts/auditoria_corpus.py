"""
Script da auditoria de corpus (Fase 0 do brief "Motor de Incidência e Raio-X de Banca").

Só leitura. Não altera nenhum dado. Roda como script standalone (não via `manage.py
shell < arquivo`, que quebra blocos `for`/`def` no parser do REPL) e escreve o
resultado direto em UTF-8 num arquivo, para não depender do codepage do console:

    cd backend
    .venv/Scripts/python.exe ../docs/scripts/auditoria_corpus.py

Saída: docs/scripts/auditoria_corpus_saida.txt

Cada número em docs/auditoria-corpus.md corresponde a uma seção deste script,
identificada pelo mesmo cabeçalho, para ser reproduzível.
"""

import io
import json
import os
import re
import sys
from collections import Counter, defaultdict

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Alternativa, Disciplina, Fonte, Prova, Questao, Subtopico, Topico
from ingest.models import Ingestao

SAIDA = os.path.join(os.path.dirname(__file__), "auditoria_corpus_saida.txt")
_arquivo = io.open(SAIDA, "w", encoding="utf-8")


def print(*args, **kwargs):
    kwargs.setdefault("file", _arquivo)
    import builtins

    builtins.print(*args, **kwargs)


sep = lambda titulo: print(f"\n=== {titulo} ===")

# ---------------------------------------------------------------------------
sep("1. INVENTARIO DE PROVAS")
# ---------------------------------------------------------------------------
for prova in Prova.objects.select_related("fonte").order_by("-ano", "id"):
    n_questoes = prova.questoes.count()
    print(
        json.dumps(
            {
                "id": prova.id,
                "concurso_orgao": prova.orgao,
                "ano": prova.ano,
                "banca": prova.banca,
                "cargo": prova.cargo,
                "qtd_questoes_edital": prova.qtd_questoes,
                "questoes_extraidas": n_questoes,
                "divergencia": prova.qtd_questoes - n_questoes,
                "pontuacao_liquida": prova.pontuacao_liquida,
                "fonte_slug": prova.fonte_id,
                "fonte_tipo": prova.fonte.tipo,
                "fonte_sha256": prova.fonte.sha256 or None,
                "fonte_titulo": prova.fonte.titulo,
            },
            ensure_ascii=False,
        )
    )

print(f"\nTotal de provas cadastradas: {Prova.objects.count()}")
print(f"Total de questões avulsas (sem prova, prova_id nulo): {Questao.objects.filter(prova__isnull=True).count()}")

print("\nFontes cadastradas, por tipo:")
fontes_por_tipo = Counter(Fonte.objects.values_list("tipo", flat=True))
for tipo, n in fontes_por_tipo.items():
    print(f"  {tipo}: {n}")

# ---------------------------------------------------------------------------
sep("2. INVENTARIO DE QUESTOES")
# ---------------------------------------------------------------------------
total_questoes = Questao.objects.count()
print(f"Total de questões: {total_questoes}")

com_enunciado = Questao.objects.exclude(enunciado="").count()
sem_enunciado = total_questoes - com_enunciado
print(f"Com enunciado não-vazio: {com_enunciado}")
print(f"Com enunciado VAZIO: {sem_enunciado}")

# alternativas: só faz sentido para tipo=multipla; certo_errado não tem alternativa.
multipla_ids = set(Questao.objects.filter(tipo="multipla").values_list("id", flat=True))
alt_por_questao = defaultdict(list)
for letra, texto, qid in Alternativa.objects.filter(questao_id__in=multipla_ids).values_list(
    "letra", "texto", "questao_id"
):
    alt_por_questao[qid].append((letra, texto))

com_5_alternativas = 0
com_alternativas_incompletas = 0
com_alternativas_vazias = 0  # todas as 5 presentes mas texto vazio (bug de figura, ver CLAUDE.md §7.1)
sem_alternativas = 0
for qid in multipla_ids:
    alts = alt_por_questao.get(qid, [])
    if not alts:
        sem_alternativas += 1
        continue
    if len(alts) < 5:
        com_alternativas_incompletas += 1
        continue
    com_5_alternativas += 1
    if all(not texto.strip() for _, texto in alts):
        com_alternativas_vazias += 1

print(f"\nQuestões tipo 'multipla': {len(multipla_ids)}")
print(f"  com as 5 alternativas presentes: {com_5_alternativas}")
print(f"  com alternativas incompletas (1-4 presentes): {com_alternativas_incompletas}")
print(f"  sem nenhuma alternativa: {sem_alternativas}")
print(f"  com as 5 alternativas presentes mas TODAS com texto vazio (bug de figura): {com_alternativas_vazias}")

certo_errado_ids = set(Questao.objects.filter(tipo="certo_errado").values_list("id", flat=True))
print(f"\nQuestões tipo 'certo_errado': {len(certo_errado_ids)}")

com_gabarito = Questao.objects.exclude(correta="").count()
sem_gabarito = total_questoes - com_gabarito
anuladas = Questao.objects.filter(anulada=True).count()
sem_gabarito_nao_anulada = Questao.objects.filter(correta="", anulada=False).count()
print(f"\nCom gabarito (campo `correta` preenchido): {com_gabarito}")
print(f"Sem gabarito: {sem_gabarito}")
print(f"  das quais anuladas (esperado ficar sem gabarito): {anuladas}")
print(f"  das quais SEM gabarito e NÃO anuladas (inesperado, investigar): {sem_gabarito_nao_anulada}")

com_topico = Questao.objects.exclude(topico__isnull=True).count()
com_subtopico = Questao.objects.exclude(subtopico__isnull=True).count()
sem_topico = total_questoes - com_topico
print(f"\nCom tópico atribuído: {com_topico}")
print(f"Com subtópico atribuído: {com_subtopico}")
print(f"SEM tópico atribuído: {sem_topico}")

com_texto_base = Questao.objects.exclude(texto_base="").count()
print(f"\nCom texto_base preenchido (texto de apoio): {com_texto_base}")
# "texto-base referenciado mas ausente": heurística — enunciado cita um texto/trecho
# anterior ("o texto acima", "considerando o texto", "a partir do texto") mas texto_base
# está vazio. É indício, não certeza — sinalizado como heurística no relatório.
padrao_referencia_texto = re.compile(
    r"\b(o texto (acima|a seguir)|com base no texto|considerando o texto|a partir do texto|o texto apresentado)\b",
    re.IGNORECASE,
)
referencia_sem_texto_base = Questao.objects.filter(texto_base="").annotate().values_list("id", "enunciado")
qtd_referencia_sem_texto_base = sum(
    1 for _, enunciado in referencia_sem_texto_base if padrao_referencia_texto.search(enunciado)
)
print(
    f"Enunciados que citam um texto-base mas têm texto_base vazio (heurística por regex): "
    f"{qtd_referencia_sem_texto_base}"
)

# ---------------------------------------------------------------------------
sep("3. BURACOS DE PARSING")
# ---------------------------------------------------------------------------

# 3a. Registro oficial de descartes, das rodadas de ingestão já executadas.
print("Descartes registrados em `Ingestao.descartes` (log real da importação):")
total_descartes = 0
motivos = Counter()
for ing in Ingestao.objects.all():
    for item in ing.descartes:
        total_descartes += 1
        motivos[item.get("motivo", "sem motivo registrado")] += 1
print(f"  Total de questões descartadas nas ingestões registradas: {total_descartes}")
for motivo, n in motivos.most_common():
    print(f"    {n}x — {motivo}")

print(f"\n  Ingestões registradas: {Ingestao.objects.count()}")
for ing in Ingestao.objects.all().order_by("-executada_em"):
    print(
        f"    prova={ing.prova_id or '(nenhuma)'} status={ing.status} "
        f"detectadas={ing.questoes_detectadas} importadas={ing.questoes_importadas} "
        f"descartadas={len(ing.descartes)} em={ing.executada_em:%Y-%m-%d}"
    )

# 3b. Sinais heurísticos direto no texto persistido (independente do log de ingestão,
# cobre questões que entraram sem passar pelo pipeline logado ou por importação antiga).


def tem_caractere_de_encoding_quebrado(texto: str) -> bool:
    if "�" in texto:  # replacement character
        return True
    # sequências clássicas de mojibake UTF-8 lido como Latin-1
    return bool(re.search(r"Ã[£¡©ª¢¤¥¦§¨«¬­®¯°±²³µ¶]|â€[™œï¿½]", texto))


def tem_espacamento_suspeito_de_tabela(texto: str) -> bool:
    # 4+ espaços seguidos, repetido várias vezes, sugere colunas de tabela
    # coladas numa linha só.
    return len(re.findall(r" {4,}", texto)) >= 3


def parece_truncado(texto: str) -> bool:
    texto = texto.strip()
    if not texto:
        return False
    return texto[-1] not in ".?!:)\"'”)"


achados = defaultdict(list)
for q in Questao.objects.all().only("id", "enunciado", "texto_base"):
    campos = {"enunciado": q.enunciado, "texto_base": q.texto_base}
    for nome_campo, texto in campos.items():
        if not texto:
            continue
        if tem_caractere_de_encoding_quebrado(texto):
            achados[f"encoding_quebrado.{nome_campo}"].append(q.id)
        if tem_espacamento_suspeito_de_tabela(texto):
            achados[f"tabela_suspeita.{nome_campo}"].append(q.id)
    if parece_truncado(q.enunciado):
        achados["enunciado_parece_truncado"].append(q.id)

print("\nSinais heurísticos no texto persistido (regex sobre enunciado/texto_base):")
for chave in sorted(achados):
    ids = achados[chave]
    amostra = ", ".join(ids[:5])
    print(f"  {chave}: {len(ids)} questões (ex.: {amostra})")

# alternativas fora de ordem alfabética não é detectável aqui: `Alternativa.Meta.ordering`
# força a consulta a devolver sempre em ordem por letra, então qualquer desordem de
# gravação já é mascarada na leitura. Não incluído — não é verificável com os dados atuais.
print(
    "\n'Alternativas fora de ordem': NÃO verificável — `Alternativa.Meta.ordering` reordena "
    "por letra em toda consulta, então a ordem de gravação não é recuperável dos dados atuais."
)
print(
    "'Blocos de código destruídos': NÃO verificável de forma confiável por regex sem "
    "amostragem manual — nenhum número é reportado para não estimar."
)

# ---------------------------------------------------------------------------
sep("4. DISTRIBUICAO POR PROVA / ANO / DISCIPLINA")
# ---------------------------------------------------------------------------
print("Questões por ano:")
for ano, n in sorted(Counter(Questao.objects.values_list("ano", flat=True)).items()):
    print(f"  {ano}: {n}")

print("\nQuestões por disciplina:")
for disc_id, n in Counter(Questao.objects.values_list("disciplina_id", flat=True)).most_common():
    print(f"  {disc_id}: {n}")

print("\nQuestões por prova:")
for prova_id, n in Counter(Questao.objects.values_list("prova_id", flat=True)).most_common():
    print(f"  {prova_id or '(sem prova)'}: {n}")

print("\nQuestões por banca:")
for banca, n in Counter(Questao.objects.values_list("banca", flat=True)).most_common():
    print(f"  {banca}: {n}")

print("\nQuestões classificadas (tópico não-nulo) por disciplina:")
for disc_id, n in Counter(
    Questao.objects.exclude(topico__isnull=True).values_list("disciplina_id", flat=True)
).most_common():
    print(f"  {disc_id}: {n}")

print(f"\nTópicos cadastrados: {Topico.objects.count()}")
print(f"Subtópicos cadastrados: {Subtopico.objects.count()}")
print(f"Disciplinas cadastradas: {Disciplina.objects.count()}")

print("\n--- FIM ---")
_arquivo.close()
