"""
Parser dos cadernos de prova e dos gabaritos da Fundação Cesgranrio.

Escrito contra os PDFs reais do concurso BB 2023 (Agente de Tecnologia,
Microrregião 158 - TI). O layout é estável entre concursos da banca, mas
**não é contrato**: se a Cesgranrio mudar a diagramação, isto quebra. Por isso o
comando de importação tem `--dry-run` e registra os descartes em `Ingestao` —
importar torto e silenciosamente seria pior do que não importar.

Três armadilhas do formato que o código trata explicitamente:

1. **O número da página parece número de questão.** Ambos aparecem sozinhos numa
   linha. O que os separa é o que vem depois: rodapé é seguido de "GABARITO n" ou
   do nome do cargo. Além disso só aceitamos o número que continua a sequência.

2. **Palavra quebrada no fim da linha.** "atu-\nação" precisa virar "atuação", mas
   "norma-\n-padrão" precisa virar "norma-padrão".

3. **O caderno é embaralhado por tipo.** "GABARITO 1" e "GABARITO 2" têm as mesmas
   questões em ordem diferente. Casar prova e gabarito de tipos distintos produz
   um acervo inteiro com a resposta errada — daí a checagem de tipo na importação.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# ---------------------------------------------------------------- utilidades


def sem_marcas(texto: str) -> str:
    """Tira a marcação de negrito (`**`) que a extração insere.

    O negrito precisa sobreviver no **conteúdo** (é como a banca diz qual é "a
    palavra destacada"), mas atrapalha em toda decisão de **estrutura**: o número
    da questão sai como `**6**` e deixa de casar com o regex de número solto, o
    cabeçalho de seção sai como `**LÍNGUA PORTUGUESA**` e deixa de casar com
    SECOES. Então tudo que classifica linha olha o texto sem marca; só o que é
    guardado no banco mantém.
    """
    return texto.replace("**", "")


def _normalizar(texto: str) -> str:
    """Maiúsculas sem acento — para comparar cabeçalho sem depender de acentuação."""
    sem_acento = unicodedata.normalize("NFKD", sem_marcas(texto))
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", sem_acento).strip().upper()


# Cabeçalho da seção -> id da disciplina no catálogo.
SECOES = {
    "LINGUA PORTUGUESA": "portugues",
    "LINGUA INGLESA": "ingles",
    "MATEMATICA": "matematica",
    "ATUALIDADES DO MERCADO FINANCEIRO": "atualidades",
    "PROBABILIDADE E ESTATISTICA": "estatistica",
    "CONHECIMENTOS BANCARIOS": "bancarios",
    "TECNOLOGIA DA INFORMACAO": "ti",
    # Seção do cargo de Agente Comercial, não do de Agente de Tecnologia. Mapear
    # para "ti" faria a prova comercial despejar 30 questões de Excel/Teams na
    # disciplina de TI e triplicar o denominador de qualquer análise de
    # incidência — conteúdo diferente, disciplina diferente.
    "CONHECIMENTOS DE INFORMATICA": "informatica",
    # Sem esta entrada o bloco de Vendas era absorvido pela seção anterior:
    # o caderno do Agente Comercial traz 15 questões de Informática seguidas de 15
    # de Vendas, e as 30 acabavam contadas como Informática.
    "VENDAS E NEGOCIACAO": "vendas",
    "MATEMATICA FINANCEIRA": "matfinanceira",
}

# Cabeçalhos que apenas agrupam seções e não são disciplina.
AGRUPADORES = {"CONHECIMENTOS BASICOS", "CONHECIMENTOS ESPECIFICOS"}

_RE_ALTERNATIVA = re.compile(r"^\(([A-E])\)\s*(.*)$")
# Alternativas curtas (números, siglas) às vezes vêm lado a lado na mesma linha:
# "(A) 10 (B) 12 (C) 14". Sem isto, só a primeira seria capturada.
_RE_ALTERNATIVA_INLINE = re.compile(r"\(([A-E])\)\s*([^()]*?)(?=\s*\([A-E]\)|$)")
# Só o rótulo "(A)" no começo da linha, com a marcação de negrito que a extração
# possa ter posto em volta dele. Serve para tirar o rótulo da linha bruta sem
# tocar no resto — que é onde está a palavra destacada.
_RE_ROTULO_ALTERNATIVA = re.compile(r"^\*{0,2}\([A-E]\)\*{0,2}\s*")
_RE_SO_NUMERO = re.compile(r"^(\d{1,3})$")
# O marcador de tipo aparece sozinho numa linha no gabarito do BB ("GABARITO 1")
# e no FIM do título no da Caixa ("PROVA 1 - TÉCNICO BANCÁRIO NOVO - GABARITO 1").
# Aceitar as duas formas evita um parser por concurso da mesma banca.
_RE_GABARITO_TIPO = re.compile(r"(?:^|[-–—]\s*)GABARITO\s+(\d+)\s*$", re.I)
# "36 - E", "24- B", "12 – A" (travessão) e "40 - ANULADA".
_RE_RESPOSTA = re.compile(r"(\d{1,3})\s*[-–—]\s*(ANULADA|[A-E])\b", re.I)

# Linhas de rodapé/cabeçalho/marca d'água que não são conteúdo.
_RUIDO_EXATO = {"BANCO DO", "O BRASIL", "BANCO DO BRASIL", "RASCUNHO", "CONTINUA"}


def _e_ruido(linha: str) -> bool:
    s = linha.strip()
    if not s:
        return True
    if set(s) <= {"_", "-", ".", " "}:  # linhas de pauta da redação
        return True
    if len(s) == 1 and s.isalpha():  # marca d'água "RASCUNHO" na vertical
        return True
    normal = _normalizar(s)
    if normal in _RUIDO_EXATO or normal in AGRUPADORES:
        return True
    if _RE_GABARITO_TIPO.match(normal):
        return True
    # Cabeçalho de página com o nome do cargo.
    if "MICRORREGIAO" in normal or normal.startswith("AGENTE DE "):
        return True
    return False


def _juntar(partes: list[str]) -> str:
    """Junta linhas desfazendo a hifenização de fim de linha."""
    saida = ""
    for parte in partes:
        parte = parte.strip()
        if not parte:
            continue
        if not saida:
            saida = parte
            continue

        # Palavra destacada quebrada por hífen: a linha termina em `-**` porque a
        # marcação de negrito fecha depois do hífen ("**implemen-**" / "**tadas**").
        # Sem tratar isto, a hifenização não é desfeita e a alternativa fica com
        # "implemen-" — exatamente a palavra que a questão manda analisar.
        if saida.endswith("-**") and parte.startswith("**"):
            saida = saida[:-2]  # tira o fecho, deixando "...**implemen-"
            parte = parte[2:]  # tira a abertura, deixando "tadas**"
        elif saida.endswith("-**"):
            # Metade destacada e metade não: manter a marca produziria `**` solto.
            saida = saida[:-2]

        if saida.endswith("-"):
            # "norma-" + "-padrão" -> "norma-padrão"; "atu-" + "ação" -> "atuação"
            if parte.startswith("-"):
                saida = saida + parte.lstrip("-")
            else:
                saida = saida[:-1] + parte
        else:
            saida = f"{saida} {parte}"
    return re.sub(r"\s+", " ", saida).strip()


# ------------------------------------------------------------------ gabarito


@dataclass
class Resposta:
    numero: int
    letra: str | None  # None quando a questão foi anulada
    disciplina_id: str | None

    @property
    def anulada(self) -> bool:
        return self.letra is None


def parse_gabarito(texto: str, tipo: int = 1) -> dict[int, Resposta]:
    """Lê o PDF de gabarito e devolve `numero -> Resposta` para o caderno `tipo`.

    Além da letra, aproveita os cabeçalhos de seção do próprio gabarito para saber
    a que disciplina cada questão pertence — é a forma mais confiável de classificar,
    porque vem da banca e não de heurística sobre o enunciado.
    """
    respostas: dict[int, Resposta] = {}
    tipo_atual: int | None = None
    disciplina_atual: str | None = None

    for linha in texto.splitlines():
        bruta = linha.strip()
        if not bruta:
            continue
        normal = _normalizar(bruta)

        # `search`, não `match`: no gabarito da Caixa o marcador vem no fim do
        # título da prova, não sozinho na linha.
        marca_tipo = _RE_GABARITO_TIPO.search(normal)
        if marca_tipo:
            tipo_atual = int(marca_tipo.group(1))
            disciplina_atual = None
            continue

        if normal in SECOES:
            disciplina_atual = SECOES[normal]
            continue
        if normal in AGRUPADORES:
            continue

        if tipo_atual != tipo:
            continue

        for numero_txt, valor in _RE_RESPOSTA.findall(bruta):
            numero = int(numero_txt)
            letra = None if valor.upper() == "ANULADA" else valor.upper()
            # O primeiro registro vence: evita que um "1" de rodapé sobrescreva.
            respostas.setdefault(
                numero, Resposta(numero=numero, letra=letra, disciplina_id=disciplina_atual)
            )

    return dict(sorted(respostas.items()))


# --------------------------------------------------------------------- prova


@dataclass
class QuestaoBruta:
    numero: int
    enunciado: str
    alternativas: dict[str, str] = field(default_factory=dict)
    # Texto de apoio (a reportagem que as questões de português/inglês comentam).
    # Sem ele metade das questões de interpretação fica sem sentido na tela.
    texto_base: str = ""
    disciplina_id: str | None = None

    @property
    def completa(self) -> bool:
        return bool(self.enunciado) and set(self.alternativas) == {"A", "B", "C", "D", "E"}

    def motivo_incompleta(self) -> str:
        if not self.enunciado:
            return "enunciado vazio"
        faltando = sorted({"A", "B", "C", "D", "E"} - set(self.alternativas))
        if faltando:
            return f"alternativas ausentes: {', '.join(faltando)}"
        return ""


def parse_prova(texto: str, total_esperado: int = 70, salto_maximo: int = 6) -> list[QuestaoBruta]:
    """Lê o caderno de questões e devolve as questões na ordem em que aparecem.

    Aceita como início de questão qualquer número que avance a sequência dentro de
    uma janela curta (`salto_maximo`). Exigir exatamente o próximo número seria
    mais seguro contra falso positivo, mas transforma uma questão perdida na perda
    de todas as seguintes; a janela permite retomar. O número da página continua
    sendo descartado pelo que vem depois dele, não pelo valor.
    """
    linhas = [linha.rstrip() for linha in texto.splitlines()]
    questoes: list[QuestaoBruta] = []

    esperado = 1
    atual: QuestaoBruta | None = None
    letra_atual: str | None = None
    buffer_enunciado: list[str] = []
    buffer_alternativa: list[str] = []
    buffer_texto_base: list[str] = []
    disciplina_atual: str | None = None

    def fechar_alternativa() -> None:
        nonlocal letra_atual, buffer_alternativa
        if atual is not None and letra_atual:
            atual.alternativas[letra_atual] = _juntar(buffer_alternativa)
        letra_atual = None
        buffer_alternativa = []

    def fechar_questao() -> None:
        nonlocal atual, buffer_enunciado
        fechar_alternativa()
        if atual is not None:
            atual.enunciado = _juntar(buffer_enunciado)
            questoes.append(atual)
        atual = None
        buffer_enunciado = []

    def proxima_util(indice: int) -> str:
        for adiante in linhas[indice + 1 : indice + 4]:
            if adiante.strip():
                return adiante.strip()
        return ""

    for indice, linha in enumerate(linhas):
        conteudo = linha.strip()
        if not conteudo:
            continue

        normal = _normalizar(conteudo)

        # Troca de disciplina: fecha o que estava aberto e zera o texto de apoio.
        if normal in SECOES:
            fechar_questao()
            disciplina_atual = SECOES[normal]
            buffer_texto_base = []
            continue

        # A partir daqui, `limpo` decide estrutura e `conteudo` guarda conteúdo:
        # o número da questão sai do PDF como `**6**` (a banca põe em negrito) e
        # sem tirar a marca ele deixaria de ser reconhecido como início de questão.
        limpo = sem_marcas(conteudo)

        marca_numero = _RE_SO_NUMERO.match(limpo)
        if marca_numero:
            numero = int(marca_numero.group(1))
            avanca = esperado <= numero <= min(esperado + salto_maximo, total_esperado)
            # Rodapé de página também é um número sozinho; o que vem logo depois
            # desfaz o empate.
            if avanca and not _e_ruido(proxima_util(indice)):
                fechar_questao()
                atual = QuestaoBruta(
                    numero=numero,
                    enunciado="",
                    texto_base=_juntar(buffer_texto_base),
                    disciplina_id=disciplina_atual,
                )
                esperado = numero + 1
                continue

        if _e_ruido(conteudo):
            continue

        if atual is None:
            # Ainda não começaram as questões da seção: é texto de apoio.
            buffer_texto_base.append(conteudo)
            continue

        marca_alternativa = _RE_ALTERNATIVA.match(limpo)
        if marca_alternativa:
            achados = _RE_ALTERNATIVA_INLINE.findall(limpo)
            if len(achados) > 1:
                # Linha com várias alternativas: fecha tudo de uma vez, porque
                # nenhuma delas pode continuar na linha seguinte. Aqui vai o texto
                # sem marca mesmo: alternativa curta em linha compartilhada é
                # número ou sigla, onde não há destaque a preservar.
                fechar_alternativa()
                for letra, texto_alt in achados:
                    atual.alternativas[letra] = texto_alt.strip()
                continue
            fechar_alternativa()
            letra_atual = marca_alternativa.group(1)
            # O corpo vem da linha BRUTA, sem o rótulo "(A)": é onde mora a palavra
            # destacada, e usar `limpo` aqui apagaria justamente o que a questão
            # está perguntando.
            buffer_alternativa = [_RE_ROTULO_ALTERNATIVA.sub("", conteudo, count=1)]
            continue

        if letra_atual:
            buffer_alternativa.append(conteudo)
        else:
            buffer_enunciado.append(conteudo)

        if esperado > total_esperado and atual.completa:
            # Última questão fechada: o que vier depois é rodapé/rascunho.
            continue

    fechar_questao()
    return questoes


def mesclar(
    candidatos: list[tuple[str, list[QuestaoBruta]]],
) -> tuple[dict[int, QuestaoBruta], dict[int, str]]:
    """Combina leituras do mesmo caderno feitas com recortes diferentes.

    Nenhum recorte único acerta o caderno inteiro: o de duas colunas estraga as
    questões diagramadas em largura total, e o de coluna única embaralha as
    demais. Em vez de escolher o menos ruim, lemos de várias formas e ficamos,
    para cada questão, com a primeira leitura **completa** — na ordem de
    prioridade recebida.

    Devolve também de qual leitura cada questão veio: questão que só apareceu no
    recorte alternativo merece conferência humana antes de virar simulado.
    """
    escolhidas: dict[int, QuestaoBruta] = {}
    origem: dict[int, str] = {}

    for rotulo, questoes in candidatos:
        for questao in questoes:
            if not questao.completa:
                continue
            if questao.numero in escolhidas:
                continue
            escolhidas[questao.numero] = questao
            origem[questao.numero] = rotulo

    # Questões que nenhuma leitura completou entram assim mesmo, para o relatório
    # de descarte poder dizer o que faltou em vez de apenas sumir com elas.
    for rotulo, questoes in candidatos:
        for questao in questoes:
            if questao.numero not in escolhidas:
                escolhidas[questao.numero] = questao
                origem[questao.numero] = f"{rotulo} (incompleta)"

    return dict(sorted(escolhidas.items())), origem
