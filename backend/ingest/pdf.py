"""
Obtenção e leitura dos PDFs.

Duas coisas que não são óbvias e custam caro se ignoradas:

* **Provas da Cesgranrio são diagramadas em duas colunas.** `extract_text()` numa
  página assim intercala as colunas e produz texto sem sentido. Por isso a leitura
  recorta a página verticalmente e lê coluna por coluna.

* **PDF de prova pode ser digitalizado** (imagem, sem camada de texto). Nesse caso
  não há o que extrair, e o pipeline precisa dizer isso em vez de gravar vazio.
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from pathlib import Path

import pdfplumber
import requests

# Sites de concurso costumam recusar requisição sem user-agent de navegador.
CABECALHOS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
    ),
    "Accept": "application/pdf,*/*",
}


class ErroDeIngestao(RuntimeError):
    """Falha esperada e explicável (download recusado, PDF sem texto, etc.)."""


@dataclass
class Documento:
    caminho: Path
    sha256: str
    origem: str = ""

    @property
    def tamanho_kb(self) -> int:
        return self.caminho.stat().st_size // 1024


def _sha256(caminho: Path) -> str:
    digest = hashlib.sha256()
    with caminho.open("rb") as arquivo:
        for bloco in iter(lambda: arquivo.read(65536), b""):
            digest.update(bloco)
    return digest.hexdigest()


def obter(origem: str, destino_dir: Path, nome: str) -> Documento:
    """Aceita URL ou caminho local e devolve sempre um arquivo em disco.

    Baixar e guardar (em vez de ler direto da rede) é proposital: o PDF fica como
    evidência do que foi importado, e o sha256 detecta republicação silenciosa.
    """
    destino_dir.mkdir(parents=True, exist_ok=True)
    destino = destino_dir / nome

    if origem.startswith(("http://", "https://")):
        if not destino.exists():
            try:
                resposta = requests.get(origem, headers=CABECALHOS, timeout=60)
                resposta.raise_for_status()
            except requests.RequestException as erro:
                raise ErroDeIngestao(f"não consegui baixar {origem}: {erro}") from erro

            conteudo = resposta.content
            if not conteudo.startswith(b"%PDF"):
                # Tipicamente uma página de bloqueio/anti-bot devolvida com HTTP 200.
                raise ErroDeIngestao(
                    f"{origem} não devolveu um PDF (veio {resposta.headers.get('Content-Type')!r}, "
                    f"{len(conteudo)} bytes). Baixe o arquivo pelo navegador e "
                    f"aponte o comando para o caminho local."
                )
            destino.write_bytes(conteudo)
        return Documento(caminho=destino, sha256=_sha256(destino), origem=origem)

    local = Path(origem).expanduser()
    if not local.is_file():
        raise ErroDeIngestao(f"arquivo não encontrado: {local}")
    return Documento(caminho=local, sha256=_sha256(local), origem=str(local))


def _tem_duas_colunas(pagina, folga: float = 0.02, tolerancia: float = 0.04) -> bool:
    """Detecta a calha vertical no meio da página.

    Não dá para assumir o layout do caderno inteiro: a Cesgranrio diagrama em duas
    colunas, mas abre para largura total nas questões com código-fonte ou tabela
    larga. Recortar uma página dessas ao meio corta enunciado e alternativa no
    meio da linha — foi exatamente o que aconteceu com a questão 64 da prova de
    2023. Então a decisão é por página: se existe uma faixa central praticamente
    sem palavras, são duas colunas; se as linhas atravessam o centro, é uma só.

    Os números vieram da medição no caderno real: numa página de duas colunas
    apenas ~3 palavras invadem a faixa central de 2% (o cabeçalho), enquanto numa
    página de largura total dezenas a atravessam.
    """
    palavras = pagina.extract_words()
    if len(palavras) < 20:
        return False

    centro = pagina.width / 2
    limite_esquerdo = centro - pagina.width * folga
    limite_direito = centro + pagina.width * folga
    cruzam = sum(1 for p in palavras if p["x0"] < limite_direito and p["x1"] > limite_esquerdo)
    return cruzam <= max(4, len(palavras) * tolerancia)


def _agrupar_em_faixas(pagina, tolerancia: float = 3.0) -> list[list[dict]]:
    """Agrupa as palavras da página em faixas horizontais pela altura.

    Uma faixa é a altura de uma linha de texto. Numa página de duas colunas ela
    contém *duas* linhas lado a lado — separá-las é trabalho de quem chama.
    """
    palavras = sorted(pagina.extract_words(), key=lambda p: (p["top"], p["x0"]))
    faixas: list[list[dict]] = []
    for palavra in palavras:
        if faixas and abs(palavra["top"] - faixas[-1][0]["top"]) <= tolerancia:
            faixas[-1].append(palavra)
        else:
            faixas.append([palavra])
    for faixa in faixas:
        faixa.sort(key=lambda p: p["x0"])
    return faixas


def _texto_por_bandas(pagina, folga: float = 0.02) -> str:
    """Lê a página respeitando trechos de duas colunas e trechos de largura total.

    O caderno da Cesgranrio **mistura os dois layouts na mesma página**: o corpo é
    de duas colunas, mas uma questão com código-fonte ou tabela abre para a largura
    inteira. Escolher um recorte só para a página inteira erra de um jeito ou de
    outro — cortar a linha larga ao meio, ou intercalar as duas colunas.

    Então a leitura é por faixa horizontal. O que classifica a faixa é **alguma
    palavra invadir a calha central**, não a extensão da faixa: numa página de duas
    colunas a faixa vai de ponta a ponta, mas são duas linhas distintas com um vão
    no meio. Faixas com vão viram duas linhas (acumuladas em blocos esquerdo e
    direito, despejados na ordem coluna-a-coluna); faixas que atravessam a calha
    despejam o bloco pendente e saem inteiras, na posição natural.
    """
    centro = pagina.width / 2
    margem = pagina.width * folga
    inicio_calha = centro - margem
    fim_calha = centro + margem

    saida: list[str] = []
    esquerda: list[str] = []
    direita: list[str] = []

    def despejar_bloco() -> None:
        saida.extend(esquerda)
        saida.extend(direita)
        esquerda.clear()
        direita.clear()

    for faixa in _agrupar_em_faixas(pagina):
        atravessa = any(p["x0"] < fim_calha and p["x1"] > inicio_calha for p in faixa)
        if atravessa:
            despejar_bloco()
            saida.append(" ".join(p["text"] for p in faixa))
            continue

        texto_esquerda = " ".join(p["text"] for p in faixa if p["x1"] <= fim_calha)
        texto_direita = " ".join(p["text"] for p in faixa if p["x0"] >= inicio_calha)
        if texto_esquerda:
            esquerda.append(texto_esquerda)
        if texto_direita:
            direita.append(texto_direita)

    despejar_bloco()
    return "\n".join(saida)


def extrair_texto(caminho: Path, colunas: int | str = "bandas") -> str:
    """Devolve o texto do PDF.

    * `"bandas"` (padrão) — leitura por faixa horizontal, que lida com páginas que
      misturam duas colunas e largura total. É o modo certo para caderno de prova.
    * `"auto"` — escolhe 1 ou 2 colunas por página. Mais simples, erra em página mista.
    * um inteiro — força o mesmo recorte em todas as páginas. Serve para gabarito,
      que é sempre de largura total.
    """
    partes: list[str] = []
    with pdfplumber.open(caminho) as pdf:
        for pagina in pdf.pages:
            if colunas == "bandas":
                partes.append(_texto_por_bandas(pagina))
                continue

            qtd = (2 if _tem_duas_colunas(pagina) else 1) if colunas == "auto" else int(colunas)

            if qtd <= 1:
                partes.append(pagina.extract_text() or "")
                continue

            largura = pagina.width
            for indice in range(qtd):
                esquerda = largura * indice / qtd
                direita = largura * (indice + 1) / qtd
                faixa = pagina.crop((esquerda, 0, direita, pagina.height))
                partes.append(faixa.extract_text() or "")

    texto = "\n".join(partes)
    if len(texto.strip()) < 200:
        raise ErroDeIngestao(
            f"{caminho.name} não tem camada de texto utilizável "
            f"({len(texto.strip())} caracteres). Provavelmente é um PDF digitalizado; "
            f"seria preciso OCR, que este pipeline não faz."
        )
    return texto
