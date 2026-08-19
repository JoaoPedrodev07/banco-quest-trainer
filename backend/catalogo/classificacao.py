"""
Camada heurística de classificação — Fase 2 do brief "Motor de Incidência e
Raio-X de Banca" (`CLAUDE.md` §8).

Cobre só o caso fácil: termo-âncora específico o bastante pra não confundir com
outro subtópico. Não tenta decidir o caso difícil — isso é trabalho pra Fase 2
item 2 (exportação pra IA externa) ou pra revisão humana.

Escopo deliberadamente restrito à disciplina `ti` do concurso `bb-ti-2026`: os
termos abaixo foram calibrados lendo a árvore desse edital especificamente
(`docs/taxonomia.md`). Aplicar essa mesma lista a uma questão de TI do BNB ou do
Banestes não classificaria errado (os termos são específicos o bastante pra não
casar por acidente com Docker/Kubernetes/TDD, por exemplo), mas também não tem
por que tentar: aquele conteúdo não pertence a esta árvore (`CLAUDE.md` §7.7).
"""

from __future__ import annotations

from dataclasses import dataclass

# subtopico_id -> termos-âncora. Cada termo é checado como substring
# case-insensitive no enunciado (+ texto_base, quando houver). Termo tem que ser
# específico o bastante pra não aparecer em outro subtópico — é por isso que
# "java" sozinho não é âncora de ti-t06-s02 (bateria em qualquer questão que
# cite Java de passagem, inclusive as de ti-t04-s01, que também é Java/Kotlin).
ANCORAS: dict[str, list[str]] = {
    # ti-t01 — Aprendizagem de máquina
    "ti-t01-s01": ["aprendizado de máquina", "aprendizagem de máquina", "machine learning"],
    "ti-t01-s02": [
        "aprendizado supervisionado",
        "não supervisionado",
        "não-supervisionado",
        "clustering",
        "agrupamento de dados",
    ],
    "ti-t01-s03": [
        "processamento de linguagem natural",
        "linguagem natural",
        "pln ",
        " nlp",
    ],
    # ti-t02 — Banco de Dados
    "ti-t02-s01": [
        "nosql",
        "banco orientado a grafos",
        "banco de dados orientado a colunas",
        "chave-valor",
        "chave/valor",
        "banco de documentos",
    ],
    "ti-t02-s02": ["mongodb", "mongo db"],
    "ti-t02-s03": [
        "inner join",
        "left join",
        "right join",
        "self join",
        "subconsulta",
        "sql2008",
        "group by",
    ],
    "ti-t02-s04": [
        "sgbd",
        "sistema gerenciador de banco de dados",
        "gerenciador de banco de dados",
    ],
    "ti-t02-s05": ["data warehouse", "modelagem multidimensional", "star schema", "esquema estrela"],
    "ti-t02-s06": [
        "entidade-relacionamento",
        "entidade relacionamento",
        "diagrama entidade",
        "cardinalidade",
    ],
    "ti-t02-s07": [
        "forma normal",
        "normalização de dados",
        "chave primária",
        "chave estrangeira",
        "modelo relacional",
    ],
    "ti-t02-s08": ["postgresql", "postgres-sql", "postgre-sql"],
    # ti-t03 — Big data
    "ti-t03-s01": ["big data", "hadoop", "apache spark"],
    "ti-t03-s02": ["etl ", "limpeza de dados", "data cleaning"],
    # ti-t04 — Desenvolvimento Mobile
    "ti-t04-s01": ["kotlin", "swift", "react native"],
    "ti-t04-s02": ["xcode", "android api", "ios "],
    # ti-t05 — Estrutura de dados e algoritmos
    "ti-t05-s01": ["busca sequencial", "busca binária", "pesquisa binária"],
    "ti-t05-s02": [
        "ordenação por seleção",
        "ordenação por inserção",
        "método da bolha",
        "bubble sort",
        "lista encadeada",
        "árvore binária",
    ],
    # ti-t06 — Ferramentas e Linguagens
    "ti-t06-s01": ["ansible", "playbook"],
    "ti-t06-s02": ["java se 11", "java ee 8", "jdk 11", "java enterprise edition"],
    "ti-t06-s03": ["typescript"],
    "ti-t06-s04": ["scikit-learn", "scikit learn", "numpy", "scipy", "matplotlib", "pandas"],
}


@dataclass(frozen=True)
class ResultadoHeuristica:
    subtopico_id: str
    termos_casados: tuple[str, ...]
    confianca: float


CONFIANCA_PADRAO = 0.85


def classificar_por_heuristica(enunciado: str, texto_base: str = "") -> ResultadoHeuristica | None:
    """Devolve o subtópico casado, ou `None` se não achou nenhum ou achou mais
    de um (ambíguo — melhor deixar sem classificar do que arriscar errado)."""
    texto = f"{enunciado} {texto_base}".lower()

    casados: dict[str, list[str]] = {}
    for subtopico_id, termos in ANCORAS.items():
        achados = [termo for termo in termos if termo.lower() in texto]
        if achados:
            casados[subtopico_id] = achados

    if len(casados) != 1:
        return None

    (subtopico_id, termos_casados), = casados.items()
    return ResultadoHeuristica(
        subtopico_id=subtopico_id,
        termos_casados=tuple(termos_casados),
        confianca=CONFIANCA_PADRAO,
    )
