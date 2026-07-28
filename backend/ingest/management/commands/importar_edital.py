"""
Importa o conteúdo programático do edital (Anexo III) para o catálogo.

    python manage.py importar_edital \\
        --arquivo dados_brutos/bb2023-edital.pdf \\
        --titulo "Edital nº 01 - 2022/001 BB, de 22/12/2022" --dry-run

O Anexo III é texto corrido com um formato regular:

    LÍNGUA PORTUGUESA: 1 - Compreensão de textos. 2 - Ortografia oficial. ...
    TECNOLOGIA DA INFORMAÇÃO: 1. Aprendizagem de máquina: Fundamentos básicos;
    Noções de algoritmos...

Cada item numerado vira um `Topico`; o que vem depois do ":" dentro do item,
separado por ";", vira `Subtopico`. Assim o edital chega na tela **com as
palavras da banca**, que é o ponto — estudar por resumo de terceiro é como o
acervo perde valor.

Duas armadilhas do documento:

1. **O mesmo anexo serve a dois cargos.** Depois do bloco do Agente de Tecnologia
   vem o do Agente Comercial, com disciplinas diferentes (Matemática Financeira)
   e um "CONHECIMENTOS BANCÁRIOS" repetido. Importar o anexo inteiro mistura os
   dois editais; por isso o corte por cargo é obrigatório.

2. **Número de item x número dentro do texto.** "Lei nº 9.613/98" e "Python
   3.9.X" parecem início de item. O que desfaz o empate é a sequência: só é item
   novo o número que continua a contagem da disciplina.
"""

from __future__ import annotations

import re
import unicodedata
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalogo.models import Disciplina, Fonte, Subtopico, Topico
from ingest.pdf import ErroDeIngestao, extrair_texto, obter

# Cabeçalho da disciplina no edital -> id no catálogo.
DISCIPLINAS_EDITAL = {
    "LINGUA PORTUGUESA": "portugues",
    "LINGUA INGLESA": "ingles",
    "MATEMATICA": "matematica",
    "ATUALIDADES DO MERCADO FINANCEIRO": "atualidades",
    "PROBABILIDADE E ESTATISTICA": "estatistica",
    "CONHECIMENTOS BANCARIOS": "bancarios",
    "TECNOLOGIA DA INFORMACAO": "ti",
    # Seções do cargo de Agente Comercial. Estão no mesmo Anexo III, mas são
    # conteúdo de outro cargo — ficam em disciplinas próprias para não somarem com
    # as de Agente de Tecnologia em nenhuma contagem.
    "CONHECIMENTOS DE INFORMATICA": "informatica",
    "VENDAS E NEGOCIACAO": "vendas",
}

_RE_ANEXO = re.compile(r"ANEXO\s+III\s*[-–—]\s*CONTE.DOS\s+PROGRAM.TICOS", re.I)
_RE_SO_NUMERO = re.compile(r"^\d{1,3}$")
# Cabeçalhos que estruturam o anexo mas não são conteúdo. Sem tirá-los, eles
# grudam no último item da disciplina anterior ("... Sistema Financeiro.
# ESCRITURÁRIO -CONHECIMENTOS ESPECÍFICOS") e viram nome de tópico na tela.
_RE_ESTRUTURA = re.compile(
    r"\s*(?:ESCRITUR.RIO\s*[-–—]*\s*|CONHECIMENTOS\s+(?:B.SICOS|ESPEC.FICOS))\s*", re.I
)
# Cabeçalho que troca o cargo do bloco.
_RE_CARGO = re.compile(r"NOME DE RELACIONAMENTO:\s*(.+?)\s*$", re.I | re.M)

LIMITE_NOME = 300  # `Topico.nome` / `Subtopico.nome` no modelo


def _sem_acento(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in decomposto if not unicodedata.combining(c))


def _normalizar(texto: str) -> str:
    return re.sub(r"\s+", " ", _sem_acento(texto)).strip().upper()


class Command(BaseCommand):
    help = "Importa o conteúdo programático do edital (Anexo III) para as disciplinas."

    def add_arguments(self, parser):
        parser.add_argument("--arquivo", required=True, help="URL ou caminho do PDF do edital.")
        parser.add_argument("--titulo", required=True, help="Como o edital aparece na UI.")
        parser.add_argument("--url", default="", help="Endereço público do edital.")
        parser.add_argument("--publicado-em", default="", help="Data ISO de publicação.")
        parser.add_argument(
            "--cargo",
            default="AGENTE DE TECNOLOGIA",
            help="Bloco do anexo a importar. O anexo cobre vários cargos.",
        )
        parser.add_argument("--slug", default="edital-bb", help="Slug da Fonte criada.")
        parser.add_argument(
            "--somente",
            default="",
            help=(
                "Lista de disciplinas (por vírgula) a importar deste bloco. As demais "
                "ficam intactas. Necessário ao trazer as seções exclusivas de um cargo "
                "(ex.: informatica,vendas) sem sobrescrever as disciplinas comuns, que "
                "já foram importadas pelo bloco do outro cargo."
            ),
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **op):
        destino = Path(getattr(settings, "INGEST_DIR", "dados_brutos"))
        try:
            documento = obter(op["arquivo"], destino, f"{op['slug']}.pdf")
            texto = extrair_texto(documento.caminho, colunas=1)
        except ErroDeIngestao as erro:
            raise CommandError(str(erro)) from erro

        trecho = self._recortar_anexo(texto, op["cargo"])
        blocos = self._separar_disciplinas(trecho)
        if not blocos:
            raise CommandError(
                "nenhuma disciplina reconhecida no Anexo III. O edital pode ter mudado "
                "de formato — confira `DISCIPLINAS_EDITAL`."
            )

        somente = {d.strip() for d in op["somente"].split(",") if d.strip()}
        if somente:
            desconhecidas = somente - set(blocos)
            if desconhecidas:
                raise CommandError(
                    f"--somente pede {', '.join(sorted(desconhecidas))}, que não "
                    f"aparece(m) no bloco do cargo {op['cargo']!r}. "
                    f"Disciplinas encontradas: {', '.join(sorted(blocos))}."
                )
            blocos = {k: v for k, v in blocos.items() if k in somente}

        faltando = set(blocos) - set(Disciplina.objects.values_list("id", flat=True))
        if faltando:
            raise CommandError(
                f"disciplinas ausentes no catálogo: {', '.join(sorted(faltando))}. "
                f"Rode `manage.py seed_catalogo` antes."
            )

        with transaction.atomic():
            fonte, _ = Fonte.objects.update_or_create(
                slug=op["slug"],
                defaults={
                    "tipo": Fonte.Tipo.OFICIAL,
                    "titulo": op["titulo"],
                    "url": op["url"],
                    "sha256": documento.sha256,
                    "publicado_em": op["publicado_em"] or None,
                    "observacao": f"Anexo III, bloco {op['cargo']}.",
                },
            )
            resumo = self._gravar(blocos, fonte)
            if op["dry_run"]:
                transaction.set_rollback(True)

        prefixo = "[simulação] " if op["dry_run"] else ""
        self.stdout.write("")
        for id_disciplina, (topicos, subtopicos) in resumo.items():
            self.stdout.write(f"  {id_disciplina:<12} {topicos:>3} tópicos, {subtopicos:>3} subtópicos")
        total_t = sum(t for t, _ in resumo.values())
        total_s = sum(s for _, s in resumo.values())
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefixo}{len(resumo)} disciplinas, {total_t} tópicos e {total_s} subtópicos "
                f"vindos de {op['titulo']}."
            )
        )
        if op["dry_run"]:
            self.stdout.write("Nada foi gravado. Rode de novo sem --dry-run para importar.")

    # ------------------------------------------------------------- recortes

    def _recortar_anexo(self, texto: str, cargo: str) -> str:
        """Devolve só o trecho do Anexo III que pertence ao cargo pedido.

        O anexo repete disciplinas entre cargos: pegar o documento inteiro faria o
        conteúdo do Agente Comercial sobrescrever o do Agente de Tecnologia.
        """
        inicio = _RE_ANEXO.search(texto)
        if not inicio:
            raise CommandError("não achei o 'ANEXO III - CONTEÚDOS PROGRAMÁTICOS' no PDF.")
        anexo = texto[inicio.end() :]

        alvo = _normalizar(cargo)
        pedacos: list[str] = []
        posicao = 0
        cargo_atual = ""

        marcas = list(_RE_CARGO.finditer(anexo))
        if not marcas:
            return anexo

        for indice, marca in enumerate(marcas):
            fim = marcas[indice + 1].start() if indice + 1 < len(marcas) else len(anexo)
            cargo_atual = _normalizar(marca.group(1))
            # "AGENTE DE TECNOLOGIA E AGENTE COMERCIAL" é o bloco comum (básicos):
            # vale para os dois cargos, então entra sempre que o alvo aparecer nele.
            if alvo in cargo_atual:
                pedacos.append(anexo[marca.end() : fim])
            posicao = fim

        if not pedacos:
            raise CommandError(f"não achei o bloco do cargo {cargo!r} no Anexo III.")
        return "\n".join(pedacos)[: posicao or None]

    def _limpar(self, trecho: str) -> str:
        """Junta as linhas descartando número de página e desfazendo hifenização."""
        saida = ""
        for linha in trecho.splitlines():
            atual = linha.strip()
            if not atual or _RE_SO_NUMERO.match(atual):
                continue
            if not saida:
                saida = atual
            elif saida.endswith("-"):
                # "bancos-\nsombra" -> "bancos-sombra"; "aprendiza-\ngem" -> "aprendizagem".
                # No edital o hífen no fim da linha quase sempre é da própria palavra
                # composta, então preservá-lo erra menos que removê-lo.
                saida = f"{saida}{atual}"
            else:
                saida = f"{saida} {atual}"
        return re.sub(r"\s+", " ", _RE_ESTRUTURA.sub(" ", saida)).strip()

    def _separar_disciplinas(self, trecho: str) -> dict[str, str]:
        """Quebra o texto corrido em `id da disciplina -> texto dos itens`."""
        texto = self._limpar(trecho)
        sem_acento = _sem_acento(texto).upper()

        achados: list[tuple[int, int, str]] = []
        for cabecalho, id_disciplina in DISCIPLINAS_EDITAL.items():
            for marca in re.finditer(re.escape(cabecalho) + r"\s*:", sem_acento):
                achados.append((marca.start(), marca.end(), id_disciplina))
        achados.sort()

        blocos: dict[str, str] = {}
        for indice, (_, fim, id_disciplina) in enumerate(achados):
            proximo = achados[indice + 1][0] if indice + 1 < len(achados) else len(texto)
            corpo = texto[fim:proximo].strip()
            # Disciplina repetida entre cargos: fica a primeira ocorrência, que é a
            # do bloco do cargo pedido.
            blocos.setdefault(id_disciplina, corpo)
        return blocos

    # -------------------------------------------------------------- parsing

    def _itens(self, corpo: str) -> list[str]:
        """Quebra o corpo da disciplina nos itens numerados do edital.

        Só conta como item novo o número que **continua a sequência**: sem isso,
        "Lei nº 9.613/98" e "Python 3.9.X" viram tópicos fantasmas.

        O espaço depois do traço é opcional porque o edital não é consistente
        ("9 - Sistemas lineares" e "10 -Marketplace" convivem no mesmo parágrafo);
        exigi-lo fazia o item sumir e, pior, travava a sequência — perdendo todos
        os itens seguintes da disciplina. O que separa item de número solto é o
        que vem depois: item é seguido de letra, "9.613" é seguido de dígito.
        """
        marcas = [
            (m.start(), m.end(), int(m.group(1)))
            for m in re.finditer(r"(\d{1,2})\s*[-–—.]\s*(?=[^\W\d_])", corpo)
        ]
        cortes: list[tuple[int, int]] = []
        esperado = 1
        for inicio, fim, numero in marcas:
            if numero == esperado:
                cortes.append((inicio, fim))
                esperado += 1

        if not cortes:
            return [corpo] if corpo else []

        itens: list[str] = []
        for indice, (_, fim) in enumerate(cortes):
            proximo = cortes[indice + 1][0] if indice + 1 < len(cortes) else len(corpo)
            item = corpo[fim:proximo].strip(" .;")
            if item:
                itens.append(item)
        return itens

    def _dividir_item(self, item: str) -> tuple[str, list[str]]:
        """Separa "Nome do tópico: sub A; sub B" em nome + subtópicos."""
        nome, separador, resto = item.partition(":")
        if not separador:
            return item[:LIMITE_NOME], []
        subtopicos = [parte.strip(" .;") for parte in resto.split(";")]
        return nome.strip()[:LIMITE_NOME], [s[:LIMITE_NOME] for s in subtopicos if s]

    # ------------------------------------------------------------- gravação

    def _gravar(self, blocos: dict[str, str], fonte: Fonte) -> dict[str, tuple[int, int]]:
        resumo: dict[str, tuple[int, int]] = {}

        for id_disciplina, corpo in blocos.items():
            disciplina = Disciplina.objects.get(id=id_disciplina)
            # Reimportar substitui: o edital vigente é um só, e tópico órfão de uma
            # leitura anterior apareceria na tela como conteúdo a estudar.
            Topico.objects.filter(disciplina=disciplina).delete()

            total_sub = 0
            itens = self._itens(corpo)
            for ordem, item in enumerate(itens, start=1):
                nome, subtopicos = self._dividir_item(item)
                topico = Topico.objects.create(
                    id=f"{id_disciplina}-t{ordem:02d}",
                    disciplina=disciplina,
                    nome=nome,
                    ordem=ordem,
                )
                Subtopico.objects.bulk_create(
                    Subtopico(
                        id=f"{topico.id}-s{sub_ordem:02d}",
                        topico=topico,
                        nome=nome_sub,
                        ordem=sub_ordem,
                    )
                    for sub_ordem, nome_sub in enumerate(subtopicos, start=1)
                )
                total_sub += len(subtopicos)

            disciplina.fonte = fonte
            disciplina.save(update_fields=["fonte"])
            resumo[id_disciplina] = (len(itens), total_sub)

        return resumo
