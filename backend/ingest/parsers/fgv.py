"""
Parser do gabarito da FGV.

O caderno da FGV é estruturalmente igual ao da Cesgranrio — número da questão
sozinho numa linha, alternativas em `(A)` — e por isso reaproveita
`cesgranrio.parse_prova` sem alteração (medido: 59 de 60 questões lidas).

O que muda é o **gabarito**, e muda por completo. A Cesgranrio escreve pares
(`1 - C`); a FGV publica uma **grade**: uma linha com os números e a linha
seguinte com as letras, alinhadas por posição.

    1 2 3 4 5 ... 20
    B C D E B ... C
    21 22 23 24 ... 40
    * * A B ... B

Duas consequências que o código trata:

1. **Um arquivo cobre vários cargos.** O gabarito definitivo traz todos os cargos
   do concurso em sequência, cada um com seu cabeçalho. Ler o arquivo inteiro
   misturaria as respostas de cargos diferentes — e nada na tela denunciaria isso,
   porque as letras são plausíveis. Daí o recorte obrigatório por cargo e tipo.

2. **`*` marca questão anulada**, e anulada não tem gabarito. Vira `Resposta`
   com letra vazia, igual ao que a Cesgranrio produz, para o resto do pipeline
   não precisar saber de qual banca veio.
"""

from __future__ import annotations

import re
import unicodedata

from .cesgranrio import Resposta

_RE_SO_NUMEROS = re.compile(r"^\s*\d+(?:\s+\d+)+\s*$")
# Letras e asteriscos separados por espaço: a linha de respostas da grade.
_RE_SO_LETRAS = re.compile(r"^\s*[A-E*](?:\s+[A-E*])+\s*$")


def _normalizar(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sem_acento).strip().upper()


def _recortar_cargo(linhas: list[str], cargo: str, tipo: int) -> list[str]:
    """Fica só com o bloco do cargo pedido.

    O cabeçalho é do tipo "Analista em Tecnologia da Informação - Desenvolvimento
    de Sistemas – Tipo 1". A comparação é por *todas* as palavras do cargo
    aparecerem na linha, e não por igualdade: o hífen e o travessão variam entre
    edições, e exigir a string exata quebraria no primeiro concurso novo.
    """
    alvo = [p for p in _normalizar(cargo).split() if len(p) > 2]
    marca_tipo = f"TIPO {tipo}"

    inicio = None
    for indice, linha in enumerate(linhas):
        normal = _normalizar(linha)
        if all(p in normal for p in alvo) and marca_tipo in normal:
            inicio = indice + 1
            break

    if inicio is None:
        return []

    # O bloco termina no próximo cabeçalho de cargo (linha que cita "TIPO n").
    fim = len(linhas)
    for indice in range(inicio, len(linhas)):
        if re.search(r"TIPO\s+\d", _normalizar(linhas[indice])):
            fim = indice
            break
    return linhas[inicio:fim]


def parse_gabarito(texto: str, cargo: str, tipo: int = 1) -> dict[int, Resposta]:
    """Lê a grade de gabarito da FGV e devolve `{numero: Resposta}`.

    A disciplina fica `None`: o gabarito da FGV não a informa, e o caderno também
    não traz cabeçalho de seção em texto extraível (o nome da matéria está em
    elemento gráfico). Quem chama precisa declarar as faixas a partir do edital —
    inventar disciplina aqui seria pior do que admitir que não se sabe.
    """
    linhas = _recortar_cargo(texto.splitlines(), cargo, tipo)
    respostas: dict[int, Resposta] = {}

    for indice, linha in enumerate(linhas):
        if not _RE_SO_NUMEROS.match(linha):
            continue
        numeros = [int(n) for n in linha.split()]

        # A linha de letras é a próxima não vazia. Entre elas pode haver quebra
        # de página com linha em branco.
        letras: list[str] = []
        for adiante in linhas[indice + 1 : indice + 4]:
            if not adiante.strip():
                continue
            if _RE_SO_LETRAS.match(adiante):
                letras = adiante.split()
            break

        # Sem o mesmo tamanho não dá para alinhar número e letra por posição, e
        # alinhar torto produziria um acervo inteiro com a resposta errada — o
        # tipo de erro que a tela não tem como denunciar.
        if len(letras) != len(numeros):
            continue

        for numero, letra in zip(numeros, letras):
            # `letra=None` é como o pipeline representa anulada; o `*` da FGV é a
            # notação dela para a mesma coisa.
            respostas[numero] = Resposta(
                numero=numero,
                letra=None if letra == "*" else letra,
                disciplina_id=None,
            )

    return respostas
