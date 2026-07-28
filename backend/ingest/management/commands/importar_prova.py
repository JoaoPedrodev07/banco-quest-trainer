"""
Importa um caderno de prova + gabarito da Cesgranrio para o catálogo.

    python manage.py importar_prova \\
        --prova bb-ti-2023 --ano 2023 \\
        --arquivo-prova dados_brutos/bb2023-ti-prova-g1.pdf \\
        --arquivo-gabarito dados_brutos/bb2023-ti-gabarito.pdf \\
        --tipo 1 --dry-run

O comando é deliberadamente desconfiado: prefere **importar menos** e dizer o que
descartou a gravar questão torta. Toda rodada vira um registro `Ingestao`, então
dá para auditar o acervo sem reabrir os PDFs.

A trava mais importante é a de **tipo de caderno**. "GABARITO 1" e "GABARITO 2"
têm as mesmas questões em ordem diferente; casar caderno tipo 1 com gabarito
tipo 2 produz um acervo inteiro com a resposta errada, e nada na tela denuncia
isso. Por isso, se o caderno declarar um tipo diferente do `--tipo`, o comando
aborta em vez de seguir.
"""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalogo.models import Alternativa, Disciplina, Fonte, Prova, Questao, Topico
from ingest.models import Ingestao
from ingest.parsers import fgv as parser_fgv
from ingest.parsers.cesgranrio import QuestaoBruta, mesclar, parse_gabarito, parse_prova
from ingest.pdf import ErroDeIngestao, extrair_texto, obter

_RE_TIPO_CADERNO = re.compile(r"GABARITO\s+(\d+)", re.I)

# Recortes tentados no caderno, em ordem de prioridade. Nenhum acerta o caderno
# inteiro sozinho (ver `mesclar`): o de bandas lida com a página mista, o de duas
# colunas fixas resgata o que ele embaralhar, e o de coluna única salva as
# páginas de largura total.
RECORTES = [("bandas", "bandas"), ("2 colunas", 2), ("coluna única", 1)]


class Command(BaseCommand):
    help = "Importa questões de um caderno de prova da Cesgranrio a partir do PDF."

    def add_arguments(self, parser):
        parser.add_argument("--prova", required=True, help="Slug da prova (ex.: bb-ti-2023).")
        parser.add_argument("--arquivo-prova", required=True, help="URL ou caminho do caderno.")
        parser.add_argument("--arquivo-gabarito", required=True, help="URL ou caminho do gabarito.")
        parser.add_argument("--ano", type=int, required=True)
        parser.add_argument("--tipo", type=int, default=1, help="Tipo do caderno (GABARITO n).")
        parser.add_argument("--total", type=int, default=70, help="Questões esperadas na prova.")
        parser.add_argument(
            "--banca",
            default="Cesgranrio",
            help=(
                "Escolhe o leitor de gabarito. O caderno e lido pelo mesmo parser para "
                "todas: a diagramacao de questao e parecida entre as bancas. O que muda "
                "por banca e o gabarito (a Cesgranrio escreve '1 - C'; a FGV publica uma "
                "grade de numeros e letras)."
            ),
        )
        parser.add_argument(
            "--faixas",
            default="",
            help=(
                "Disciplina por faixa de questao, do edital: 'portugues:1-10,ti:21-60'. "
                "Obrigatorio quando o gabarito nao informa disciplina (caso da FGV, cujo "
                "caderno traz o nome da materia em elemento grafico, fora do texto)."
            ),
        )
        parser.add_argument("--orgao", default="Banco do Brasil")
        parser.add_argument("--cargo", default="Escriturário — Agente de Tecnologia")
        parser.add_argument("--url-prova", default="")
        parser.add_argument("--url-gabarito", default="")
        parser.add_argument("--aplicada-em", default="", help="Data ISO da aplicação.")
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Faz tudo e desfaz no fim: mostra o relatório sem tocar no banco.",
        )

    # ------------------------------------------------------------------ fluxo

    def handle(self, *args, **op):
        try:
            resultado = self._executar(op)
        except ErroDeIngestao as erro:
            Ingestao.objects.create(
                arquivo_prova=op["arquivo_prova"],
                arquivo_gabarito=op["arquivo_gabarito"],
                status=Ingestao.Status.ERRO,
                mensagem=str(erro),
            )
            raise CommandError(str(erro)) from erro
        return resultado

    def _executar(self, op) -> None:
        destino = Path(getattr(settings, "INGEST_DIR", "dados_brutos"))
        doc_prova = obter(op["arquivo_prova"], destino, f"{op['prova']}-prova.pdf")
        doc_gabarito = obter(op["arquivo_gabarito"], destino, f"{op['prova']}-gabarito.pdf")

        self.stdout.write(f"caderno:  {doc_prova.caminho.name} ({doc_prova.tamanho_kb} KB)")
        self.stdout.write(f"gabarito: {doc_gabarito.caminho.name} ({doc_gabarito.tamanho_kb} KB)")

        # ---- gabarito: dá a letra certa E a disciplina de cada questão
        texto_gabarito = extrair_texto(doc_gabarito.caminho, colunas=1)
        if op["banca"].strip().upper() == "FGV":
            respostas = parser_fgv.parse_gabarito(
                texto_gabarito, cargo=op["cargo"], tipo=op["tipo"]
            )
        else:
            respostas = parse_gabarito(texto_gabarito, tipo=op["tipo"])

        faixas = self._ler_faixas(op["faixas"])
        if faixas:
            # As faixas vem do edital e mandam sobre o que o gabarito disser: e o
            # unico caminho quando o gabarito nao traz disciplina nenhuma.
            for numero, resposta in respostas.items():
                for disciplina_id, (ini, fim) in faixas.items():
                    if ini <= numero <= fim:
                        resposta.disciplina_id = disciplina_id
                        break
        if not respostas:
            raise ErroDeIngestao(
                f"nenhuma resposta lida do gabarito para o tipo {op['tipo']}. "
                f"Confira se o caderno é mesmo desse tipo (--tipo)."
            )
        self.stdout.write(f"gabarito tipo {op['tipo']}: {len(respostas)} respostas")

        # ---- caderno: lido de várias formas, mesclado pela leitura mais completa
        leituras: list[tuple[str, list[QuestaoBruta]]] = []
        texto_caderno = ""
        for rotulo, modo in RECORTES:
            try:
                # `marcar_negrito` preserva o destaque da banca: sem ele,
                # 'a palavra destacada está empregada corretamente em' fica
                # sem nenhuma palavra destacada e a questão vira insolúvel.
                texto = extrair_texto(doc_prova.caminho, colunas=modo, marcar_negrito=True)
            except ErroDeIngestao as erro:
                self.stdout.write(self.style.WARNING(f"  recorte {rotulo}: {erro}"))
                continue
            texto_caderno = texto_caderno or texto
            questoes = parse_prova(texto, total_esperado=op["total"])
            completas = sum(1 for q in questoes if q.completa)
            self.stdout.write(f"  recorte {rotulo}: {len(questoes)} lidas, {completas} completas")
            leituras.append((rotulo, questoes))

        if not leituras:
            raise ErroDeIngestao("nenhum recorte conseguiu ler o caderno.")

        self._conferir_tipo(texto_caderno, op["tipo"])
        brutas, origem = mesclar(leituras)

        # ---- confronto caderno x gabarito
        descartes: list[dict] = []
        importaveis: list[QuestaoBruta] = []
        for numero, questao in brutas.items():
            if not questao.completa:
                descartes.append(
                    {"numero": numero, "motivo": questao.motivo_incompleta(), "origem": origem[numero]}
                )
                continue
            if numero not in respostas:
                descartes.append({"numero": numero, "motivo": "sem resposta no gabarito"})
                continue
            importaveis.append(questao)

        faltando_no_caderno = sorted(set(respostas) - set(brutas))
        for numero in faltando_no_caderno:
            descartes.append({"numero": numero, "motivo": "gabarito tem, caderno não"})

        disciplinas_faltando = self._disciplinas_faltando(importaveis, respostas)
        if disciplinas_faltando:
            raise ErroDeIngestao(
                f"disciplinas ausentes no catálogo: {', '.join(sorted(disciplinas_faltando))}. "
                f"Rode `manage.py seed_catalogo` antes."
            )

        # ---- gravação
        with transaction.atomic():
            gravadas = self._gravar(op, doc_prova, doc_gabarito, importaveis, respostas)
            status = (
                Ingestao.Status.SUCESSO
                if gravadas == op["total"] and not descartes
                else Ingestao.Status.PARCIAL
            )
            Ingestao.objects.create(
                prova_id=op["prova"] if not op["dry_run"] else None,
                arquivo_prova=str(doc_prova.caminho),
                arquivo_gabarito=str(doc_gabarito.caminho),
                status=status,
                questoes_detectadas=len(brutas),
                questoes_importadas=gravadas,
                descartes=sorted(descartes, key=lambda d: d["numero"]),
                mensagem="simulação (--dry-run)" if op["dry_run"] else "",
            )
            if op["dry_run"]:
                transaction.set_rollback(True)

        self._relatorio(op, brutas, gravadas, descartes, origem)

    # ------------------------------------------------------------- auxiliares

    def _conferir_tipo(self, texto_caderno: str, tipo_esperado: int) -> None:
        """Aborta se o caderno declarar um tipo diferente do gabarito pedido."""
        declarados = {int(n) for n in _RE_TIPO_CADERNO.findall(texto_caderno)}
        if declarados and tipo_esperado not in declarados:
            raise ErroDeIngestao(
                f"o caderno declara GABARITO {sorted(declarados)}, mas --tipo é {tipo_esperado}. "
                f"Cadernos de tipos diferentes têm as questões embaralhadas: importar assim "
                f"grava a resposta errada em toda a prova."
            )

    def _disciplina_de(self, questao: QuestaoBruta, respostas: dict) -> str | None:
        """Disciplina da questão: o gabarito manda, o caderno é o reserva.

        O gabarito é mais confiável porque a própria banca agrupa as respostas por
        seção; no caderno a seção depende de o cabeçalho ter sobrevivido ao recorte.
        """
        resposta = respostas.get(questao.numero)
        if resposta and resposta.disciplina_id:
            return resposta.disciplina_id
        return questao.disciplina_id

    def _disciplinas_faltando(self, questoes: list[QuestaoBruta], respostas: dict) -> set[str]:
        necessarias = {
            d for q in questoes if (d := self._disciplina_de(q, respostas)) is not None
        }
        existentes = set(Disciplina.objects.values_list("id", flat=True))
        return necessarias - existentes

    def _gravar(self, op, doc_prova, doc_gabarito, questoes, respostas) -> int:
        fonte, _ = Fonte.objects.update_or_create(
            slug=op["prova"],
            defaults={
                "tipo": Fonte.Tipo.OFICIAL,
                "titulo": f"{op['orgao']} {op['ano']} — {op['cargo']} (caderno tipo {op['tipo']})",
                "url": op["url_prova"],
                "sha256": doc_prova.sha256,
                "publicado_em": op["aplicada_em"] or None,
                "observacao": f"gabarito sha256={doc_gabarito.sha256}",
            },
        )

        prova, _ = Prova.objects.update_or_create(
            id=op["prova"],
            defaults={
                "ano": op["ano"],
                "banca": op["banca"],
                "cargo": op["cargo"],
                "orgao": op["orgao"],
                "qtd_questoes": op["total"],
                "url_prova": op["url_prova"],
                "url_gabarito": op["url_gabarito"],
                "aplicada_em": op["aplicada_em"] or None,
                "fonte": fonte,
            },
        )

        # O que foi feito à mão sobre as questões — classificação por tópico do
        # edital e gabarito comentado — não vem do PDF e não seria reconstruído
        # pela reimportação. Como o id é estável (`<prova>-q07`), dá para guardar
        # e recolocar. Sem isto, melhorar o parser custaria horas de classificação
        # a cada execução, e o prejuízo só apareceria depois, na tela de análise.
        preservado = {
            registro_id: (topico, subtopico, explicacao)
            for registro_id, topico, subtopico, explicacao in Questao.objects.filter(
                prova=prova
            ).values_list("id", "topico_id", "subtopico_id", "explicacao")
        }

        # Quais tópicos pertencem a cada disciplina, para validar a classificação
        # preservada contra a disciplina que o parser acabou de decidir.
        topicos_por_disciplina: dict[str, set[str]] = {}
        for topico_id, disciplina_id in Topico.objects.values_list("id", "disciplina_id"):
            topicos_por_disciplina.setdefault(disciplina_id, set()).add(topico_id)
        reclassificar: list[str] = []

        # Reimportar substitui: o parser melhora com o tempo e o acervo tem que
        # refletir a leitura mais recente, não a soma das tentativas.
        Questao.objects.filter(prova=prova).delete()

        gravadas = 0
        for questao in questoes:
            resposta = respostas[questao.numero]
            questao_id = f"{prova.id}-q{questao.numero:02d}"
            disciplina_id = self._disciplina_de(questao, respostas)
            topico_id, subtopico_id, explicacao = preservado.get(questao_id, (None, None, ""))

            # Se o parser passou a ler a questão como de outra disciplina, o tópico
            # antigo é de uma árvore que não vale mais. Descartar a classificação é
            # o certo: mantida, ela poria a questão sob um tópico de outra
            # disciplina e a contagem por disciplina passaria a mentir.
            if topico_id and topico_id not in topicos_por_disciplina.get(disciplina_id, set()):
                topico_id, subtopico_id = None, None
                reclassificar.append(questao_id)

            registro = Questao.objects.create(
                id=questao_id,
                disciplina_id=disciplina_id,
                prova=prova,
                numero_na_prova=questao.numero,
                ano=op["ano"],
                banca=op["banca"],
                texto_base=questao.texto_base,
                enunciado=questao.enunciado,
                correta="" if resposta.anulada else resposta.letra,
                anulada=resposta.anulada,
                topico_id=topico_id,
                subtopico_id=subtopico_id,
                explicacao=explicacao,
                fonte=fonte,
            )
            Alternativa.objects.bulk_create(
                Alternativa(questao=registro, letra=letra, texto=texto)
                for letra, texto in sorted(questao.alternativas.items())
            )
            gravadas += 1

        if reclassificar:
            self.stdout.write(
                self.style.WARNING(
                    f"  {len(reclassificar)} questao(oes) mudaram de disciplina e perderam "
                    f"a classificacao por topico: {', '.join(reclassificar[:8])}"
                    + (" ..." if len(reclassificar) > 8 else "")
                )
            )
        return gravadas

    def _relatorio(self, op, brutas, gravadas, descartes, origem) -> None:
        estilo = self.style.WARNING if descartes else self.style.SUCCESS
        prefixo = "[simulação] " if op["dry_run"] else ""
        self.stdout.write("")
        self.stdout.write(
            estilo(
                f"{prefixo}{gravadas} de {op['total']} questões importadas "
                f"({len(brutas)} detectadas no caderno)."
            )
        )

        conferir = [n for n, r in origem.items() if "incompleta" not in r and r != RECORTES[0][0]]
        if conferir:
            self.stdout.write(
                f"  questões que só o recorte alternativo leu (vale conferir): "
                f"{', '.join(str(n) for n in sorted(conferir))}"
            )

        for descarte in sorted(descartes, key=lambda d: d["numero"]):
            self.stdout.write(f"  descartada {descarte['numero']:>2}: {descarte['motivo']}")

        if op["dry_run"]:
            self.stdout.write("")
            self.stdout.write("Nada foi gravado. Rode de novo sem --dry-run para importar.")

    @staticmethod
    def _ler_faixas(bruto: str) -> dict[str, tuple[int, int]]:
        """Converte 'portugues:1-10,ti:21-60' em {disciplina: (inicio, fim)}.

        Falha alto em formato errado em vez de ignorar em silêncio: faixa mal
        digitada gravaria a questão na disciplina errada, e nada na tela
        denunciaria — o enunciado continua plausível sob qualquer matéria.
        """
        faixas: dict[str, tuple[int, int]] = {}
        for parte in (p.strip() for p in bruto.split(",") if p.strip()):
            casado = re.fullmatch(r"([a-z0-9-]+):(\d{1,3})-(\d{1,3})", parte)
            if not casado:
                raise ErroDeIngestao(
                    f"faixa inválida: {parte!r}. Use o formato 'disciplina:inicio-fim', "
                    f"por exemplo 'portugues:1-10'."
                )
            disciplina_id, inicio, fim = casado.group(1), int(casado.group(2)), int(casado.group(3))
            if inicio > fim:
                raise ErroDeIngestao(f"faixa invertida em {parte!r}: {inicio} > {fim}.")
            faixas[disciplina_id] = (inicio, fim)
        return faixas
