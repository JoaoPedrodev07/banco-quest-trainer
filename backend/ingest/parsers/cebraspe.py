"""
Parser da Cebraspe (ex-Cespe).

É a banca que mais foge do resto, em duas frentes:

1. **Não há alternativas.** Cada item é uma afirmação para julgar como certa ou
   errada. O enunciado é a afirmação inteira, e o gabarito é "C" ou "E".

2. **O gabarito vem em grade rotulada**, e não em pares:

       Item      51 52 53 54 55 ... 70
       Gabarito  E  E  E  C  E  ...  C

   Um "X" no lugar da letra marca item anulado.

O caderno é diagramado em duas colunas com os comandos ("Julgue o próximo item")
separando blocos de itens. O comando **não** entra no enunciado: ele se repete
dezenas de vezes e diluiria o texto que de fato distingue um item do outro.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from .cesgranrio import Resposta

_RE_LINHA_ITENS = re.compile(r"^\s*Item\s+((?:\d+\s*)+)$", re.I)
_RE_LINHA_GABARITO = re.compile(r"^\s*Gabarito\s+((?:[CEX]\s*)+)$", re.I)
# Início de item: número no começo da linha seguido de texto.
_RE_ITEM = re.compile(r"^(\d{1,3})\s+(\S.*)$")
# Comandos que estruturam a prova mas não são conteúdo do item.
_RE_COMANDO = re.compile(
    r"^(?:julgue|considerando|a\s+respeito|com\s+base|acerca|no\s+que\s+se\s+refere|"
    r"em\s+rela..o|tendo\s+em\s+vista)\b",
    re.I,
)


def _normalizar(texto: str) -> str:
    d = unicodedata.normalize("NFKD", texto)
    return re.sub(r"\s+", " ", "".join(c for c in d if not unicodedata.combining(c))).strip()


def parse_gabarito(texto: str) -> dict[int, Resposta]:
    """Lê a grade `Item` / `Gabarito` e devolve `{numero: Resposta}`.

    Exige que as duas linhas tenham o mesmo comprimento. Alinhar por posição com
    tamanhos diferentes produziria um acervo inteiro com o gabarito trocado —
    e "C" e "E" são plausíveis em qualquer item, então nada na tela denunciaria.
    """
    linhas = texto.splitlines()
    respostas: dict[int, Resposta] = {}

    for indice, linha in enumerate(linhas):
        casa_itens = _RE_LINHA_ITENS.match(linha)
        if not casa_itens:
            continue
        numeros = [int(n) for n in casa_itens.group(1).split()]

        letras: list[str] = []
        for adiante in linhas[indice + 1 : indice + 4]:
            if not adiante.strip():
                continue
            casa_gab = _RE_LINHA_GABARITO.match(adiante)
            if casa_gab:
                letras = casa_gab.group(1).split()
            break

        if len(letras) != len(numeros):
            continue

        for numero, letra in zip(numeros, letras):
            respostas[numero] = Resposta(
                numero=numero,
                # "X" é anulada na notação da Cebraspe; o pipeline representa
                # anulada com letra nula, como nas outras bancas.
                letra=None if letra.upper() == "X" else letra.upper(),
                disciplina_id=None,
            )

    return respostas


@dataclass
class ItemBruto:
    numero: int
    enunciado: str = ""
    linhas: list[str] = field(default_factory=list)

    @property
    def completo(self) -> bool:
        # Item de uma linha curta quase sempre é lixo de extração (número de
        # página, rodapé). Afirmação de prova não cabe em 25 caracteres.
        return len(self.enunciado) >= 25


def parse_prova(texto: str, primeiro: int = 1, ultimo: int = 120) -> list[ItemBruto]:
    """Lê os itens de um caderno certo/errado.

    `primeiro`/`ultimo` limitam a faixa de numeração aceita. Sem esse limite, um
    ano ("2022") ou um valor no meio do texto viraria início de item e partiria a
    afirmação em duas.
    """
    itens: list[ItemBruto] = []
    atual: ItemBruto | None = None

    def fechar() -> None:
        if atual is None:
            return
        corpo = " ".join(p.strip() for p in atual.linhas if p.strip())
        atual.enunciado = re.sub(r"\s+", " ", corpo).strip()
        if atual.completo:
            itens.append(atual)

    for linha in texto.splitlines():
        conteudo = linha.strip()
        if not conteudo:
            continue

        casa = _RE_ITEM.match(conteudo)
        if casa and primeiro <= int(casa.group(1)) <= ultimo:
            fechar()
            atual = ItemBruto(numero=int(casa.group(1)))
            atual.linhas.append(casa.group(2))
            continue

        if atual is None:
            continue

        # O comando de bloco encerra o item anterior sem começar outro: o texto
        # dele vale para vários itens e não pertence a nenhum.
        if _RE_COMANDO.match(_normalizar(conteudo)):
            fechar()
            atual = None
            continue

        atual.linhas.append(conteudo)

    fechar()

    # Numeração repetida acontece quando a extração embaralha as colunas; fica a
    # leitura mais longa, que é a que tem mais chance de ser a afirmação inteira.
    melhor: dict[int, ItemBruto] = {}
    for item in itens:
        if item.numero not in melhor or len(item.enunciado) > len(melhor[item.numero].enunciado):
            melhor[item.numero] = item
    return [melhor[n] for n in sorted(melhor)]
