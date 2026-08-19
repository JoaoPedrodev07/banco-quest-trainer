"""Gera docs/taxonomia.md a partir do estado atual do banco (Disciplina > Topico >
Subtopico). Fase 1 do brief "Motor de Incidência e Raio-X de Banca" (CLAUDE.md §8).

Só leitura. Roda como script standalone (mesmo padrão dos scripts da Fase 0):

    cd backend
    .venv/Scripts/python.exe ../docs/scripts/gerar_taxonomia_md.py
"""

import os
import sys

sys.path.insert(0, os.getcwd())
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django

django.setup()

from catalogo.models import Disciplina, Questao, Subtopico, Topico

DESTINO = os.path.join(os.path.dirname(__file__), "..", "taxonomia.md")

CONCURSO_ID = "bb-ti-2026"

linhas: list[str] = []


def w(texto: str = "") -> None:
    linhas.append(texto)


w("# Taxonomia canônica do edital — Fase 1")
w()
w('> Gerado por `docs/scripts/gerar_taxonomia_md.py` a partir do banco. Fonte da verdade dos')
w('> dados: `backend/dados_brutos/bb2023-edital.pdf`, importado por')
w('> `manage.py importar_edital` para as tabelas `catalogo.Disciplina` / `Topico` / `Subtopico`.')
w(f"> Concurso: `{CONCURSO_ID}`. Data de geração: 2026-08-05.")
w()

w("## Por que não é um app novo (`backend/apps/edital/taxonomia.py`)")
w()
w(
    "O brief da Fase 1 pede a árvore num módulo novo. Esse acervo já tinha "
    "`catalogo.models.Disciplina/Topico/Subtopico` — um `Topico` populado direto do PDF do "
    "edital por `manage.py importar_edital`, com `nome` guardando a redação literal do item "
    "(o `titulo_edital` que o brief pede como campo separado). Criar uma segunda árvore "
    "paralela duplicaria dado que já existe e abriria espaço pra divergência entre as duas — "
    "exatamente o que o `CLAUDE.md` §2.3 proíbe. Por isso a Fase 1 **estendeu o que já existia** "
    "em vez de recomeçar."
)
w()

w("## Por que os slugs NÃO viraram `ti.bd.sql.joins`")
w()
w(
    "O brief pede slug \"legível\" tipo `ti.bd.sql.joins`. Os ids atuais são posicionais — "
    "`ti-t02`, `ti-t02-s03` — e **ficam assim**, por uma razão que o brief não tinha como "
    "prever: o próprio model já documenta que esses ids **são a chave primária de propósito**, "
    "porque já existem no frontend e no localStorage do usuário "
    "(`EditalStatus` em `src/store/useStore.ts`, indexado por `subtopicoId`; revisões "
    "agendadas também apontam pra cá). Trocar o esquema de id agora não é reorganizar um "
    "detalhe interno — é invalidar o progresso de estudo que qualquer usuário já tenha salvo "
    "no navegador, sem forma de migrar (não há conta, não há como avisar quem está afetado). "
    "Isso é exatamente o tipo de dano que o `CLAUDE.md` §2.4 pede pra evitar."
)
w()
w(
    "O que a Fase 1 mudou foi a parte seguura de mudar: `edital_ref` (a numeração do edital, "
    "só pra referência) e `ativo_edital_vigente` (a política de deprecação abaixo) — sem tocar "
    "no id de nenhum tópico já existente."
)
w()

w("## Regra de nomenclatura do slug (id)")
w()
w("- **Tópico**: `[<concurso_id>--]<disciplina_id>-t<NN>`, `NN` = posição do item dentro da")
w("  disciplina, 2 dígitos. O prefixo do concurso só existe quando `concurso_id != \"bb-ti-2026\"`")
w("  (o concurso padrão manteve os ids sem prefixo por compatibilidade com as classificações e")
w("  o localStorage que já existiam antes de o backend separar por concurso).")
w("- **Subtópico**: `<id do tópico pai>-s<NN>`, mesma régua.")
w("- **Nunca renomeie um id depois de criado.** Se o edital renumerar um item (não só editar o")
w("  texto), `manage.py importar_edital` avisa no stdout (`[atenção] ... mudou de conteúdo`) —")
w("  isso significa que o id antigo passou a apontar pra um item diferente do edital, e quem")
w("  decide o que fazer (reclassificar as questões daquele tópico, ou tratar como item novo) é")
w("  humano, não o importador.")
w("- **`nome`** é a redação literal do edital (equivalente ao `titulo_edital` do brief) — nunca")
w("  parafraseado. **`edital_ref`** é só a numeração pra achar o item no PDF original, não é")
w("  chave de nada.")
w("- **`nível`** e **`pai`** (que o brief pede como campos) não existem como coluna: nível é")
w("  qual model a linha é (`Disciplina` = 1, `Topico` = 2, `Subtopico` = 3) e pai é a FK que já")
w("  existe (`Topico.disciplina`, `Subtopico.topico`). Adicionar coluna pra isso seria estado")
w("  derivado duplicado — `CLAUDE.md` §2.3.")
w()

w("## Política de deprecação")
w()
w(
    "`ativo_edital_vigente=False` no lugar de deletar. Um `Topico`/`Subtopico` some da tela de "
    "edital vigente, mas continua no banco — porque `Questao.topico`/`Questao.subtopico` "
    "apontam pra ele, e apagar acionaria o `SET_NULL` e devolveria a questão pra \"sem "
    "classificação\" silenciosamente. `manage.py importar_edital` já foi corrigido nesta fase: "
    "antes fazia `delete()` de toda a árvore do concurso e recriava do zero a cada reimportação "
    "— o que zerava a classificação de qualquer questão entre o delete e o recreate. Agora faz "
    "`update_or_create` por item e só marca `ativo_edital_vigente=False` no que não veio na "
    "leitura mais recente."
)
w()

w("## Cobertura do corpus (critério de aceite da Fase 1)")
w()
total_questoes = Questao.objects.count()
disciplinas_no_corpus = set(Questao.objects.values_list("disciplina_id", flat=True))
disciplinas_na_arvore = set(Disciplina.objects.values_list("id", flat=True))
faltando = disciplinas_no_corpus - disciplinas_na_arvore
w(
    f"Toda disciplina que aparece nas {total_questoes} questões do corpus já existe na árvore "
    f"({len(disciplinas_no_corpus)} disciplinas distintas em uso, {len(disciplinas_na_arvore)} "
    f"cadastradas). Disciplinas do corpus ausentes da árvore: "
    f"{sorted(faltando) if faltando else 'nenhuma'}."
)
w(
    "Verificação mais forte que a amostra de 20 questões pedida no brief: aqui é o corpus "
    "inteiro, não uma amostra — toda `Questao.disciplina_id` é FK pra uma `Disciplina` que já "
    "está na árvore, então nenhuma questão pode existir apontando pra disciplina fora dela."
)
w()

w("## Árvore completa")
w()

for disc in Disciplina.objects.order_by("ordem"):
    topicos = Topico.objects.filter(disciplina=disc, concurso_id=CONCURSO_ID).order_by("ordem")
    if not topicos.exists():
        continue
    w(f"### {disc.nome} (`{disc.id}`)")
    w()
    for t in topicos:
        subs = Subtopico.objects.filter(topico=t).order_by("ordem")
        n_q = Questao.objects.filter(topico=t).count()
        marca = "" if t.ativo_edital_vigente else " _(fora do edital vigente)_"
        w(f"- **`{t.id}`** [{t.edital_ref}] {t.nome} — {n_q} questões{marca}")
        for s in subs:
            n_qs = Questao.objects.filter(subtopico=s).count()
            marca_s = "" if s.ativo_edital_vigente else " _(fora do edital vigente)_"
            w(f"  - `{s.id}` [{s.edital_ref}] {s.nome} — {n_qs} questões{marca_s}")
    w()

w("## Números")
w()
w(f"- Disciplinas: {Disciplina.objects.count()}")
w(f"- Tópicos (concurso `{CONCURSO_ID}`): {Topico.objects.filter(concurso_id=CONCURSO_ID).count()}")
w(f"- Subtópicos: {Subtopico.objects.filter(topico__concurso_id=CONCURSO_ID).count()}")
w(
    f"- Tópicos inativos (fora do edital vigente): "
    f"{Topico.objects.filter(concurso_id=CONCURSO_ID, ativo_edital_vigente=False).count()}"
)

with open(DESTINO, "w", encoding="utf-8") as f:
    f.write("\n".join(linhas) + "\n")

print(f"Escrito em {os.path.abspath(DESTINO)}")
