"""
Importa uma prova de **certo/errado** (padrão Cebraspe).

    python manage.py importar_prova_ce \\
        --prova cebraspe-bnb-ti-2022 --ano 2022 \\
        --arquivo-prova dados_brutos/cebraspe-bnb-2022-ti-prova.pdf \\
        --arquivo-gabarito dados_brutos/cebraspe-bnb-2022-ti-gabarito.pdf \\
        --faixas "ti:51-110" --dry-run

É um comando separado, e não uma bandeira em `importar_prova`, porque o formato
diverge em quase tudo: não há alternativas para casar, o gabarito é uma grade de
C/E, e a numeração começa onde a prova de conhecimentos gerais termina. Enfiar os
dois fluxos no mesmo comando encheria cada passo de condicionais e deixaria as
duas leituras mais frágeis do que separadas.

O que é compartilhado — `Fonte`, `Prova`, `Ingestao`, preservação da
classificação ao reimportar — segue o mesmo formato do outro comando.
"""

from __future__ import annotations

import re
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from catalogo.models import Disciplina, Fonte, Prova, Questao, TipoQuestao, Topico
from ingest.models import Ingestao
from ingest.parsers import cebraspe
from ingest.pdf import ErroDeIngestao, extrair_texto, obter

RECORTES = [("2 colunas", 2), ("bandas", "bandas"), ("coluna única", 1)]


class Command(BaseCommand):
    help = "Importa uma prova de certo/errado (Cebraspe) a partir do PDF."

    def add_arguments(self, parser):
        parser.add_argument("--prova", required=True)
        parser.add_argument("--arquivo-prova", required=True)
        parser.add_argument("--arquivo-gabarito", required=True)
        parser.add_argument("--ano", type=int, required=True)
        parser.add_argument("--banca", default="Cebraspe")
        parser.add_argument("--orgao", default="Banco do Nordeste")
        parser.add_argument("--cargo", default="Especialista Técnico — Analista de Sistemas")
        parser.add_argument(
            "--faixas",
            required=True,
            help="Disciplina por faixa, do edital: 'ti:51-110'. O gabarito de certo/errado "
            "não informa disciplina nenhuma.",
        )
        parser.add_argument(
            "--sem-desconto",
            action="store_true",
            help="Marca a prova como SEM desconto por erro. O padrão é COM, porque é a "
            "regra da Cebraspe — mas quem manda é o edital, não a banca.",
        )
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **op):
        try:
            return self._executar(op)
        except ErroDeIngestao as erro:
            Ingestao.objects.create(
                arquivo_prova=op["arquivo_prova"],
                arquivo_gabarito=op["arquivo_gabarito"],
                status=Ingestao.Status.ERRO,
                mensagem=str(erro),
            )
            raise CommandError(str(erro)) from erro

    def _executar(self, op) -> None:
        destino = Path(getattr(settings, "INGEST_DIR", "dados_brutos"))
        doc_prova = obter(op["arquivo_prova"], destino, f"{op['prova']}-prova.pdf")
        doc_gabarito = obter(op["arquivo_gabarito"], destino, f"{op['prova']}-gabarito.pdf")

        self.stdout.write(f"caderno:  {doc_prova.caminho.name} ({doc_prova.tamanho_kb} KB)")
        self.stdout.write(f"gabarito: {doc_gabarito.caminho.name} ({doc_gabarito.tamanho_kb} KB)")

        respostas = cebraspe.parse_gabarito(extrair_texto(doc_gabarito.caminho, colunas=1))
        if not respostas:
            raise ErroDeIngestao(
                "nenhuma resposta lida do gabarito. A grade 'Item/Gabarito' pode ter mudado "
                "de formato — confira o PDF."
            )
        primeiro, ultimo = min(respostas), max(respostas)
        self.stdout.write(f"gabarito: {len(respostas)} itens ({primeiro}–{ultimo})")

        faixas = self._ler_faixas(op["faixas"])
        for numero, resposta in respostas.items():
            for disciplina_id, (ini, fim) in faixas.items():
                if ini <= numero <= fim:
                    resposta.disciplina_id = disciplina_id
                    break

        faltando = {r.disciplina_id for r in respostas.values() if r.disciplina_id} - set(
            Disciplina.objects.values_list("id", flat=True)
        )
        if faltando:
            raise ErroDeIngestao(
                f"disciplinas ausentes no catálogo: {', '.join(sorted(faltando))}. "
                f"Rode `manage.py seed_catalogo` antes."
            )

        # Vários recortes, como no outro comando: nenhum acerta o caderno inteiro
        # sozinho, e fica a leitura que trouxe mais itens completos.
        melhor: list[cebraspe.ItemBruto] = []
        for rotulo, modo in RECORTES:
            texto = extrair_texto(doc_prova.caminho, colunas=modo)
            itens = cebraspe.parse_prova(texto, primeiro=primeiro, ultimo=ultimo)
            self.stdout.write(f"  recorte {rotulo}: {len(itens)} itens")
            if len(itens) > len(melhor):
                melhor = itens

        descartes = [
            {"numero": n, "motivo": "gabarito tem, caderno não"}
            for n in sorted(set(respostas) - {i.numero for i in melhor})
        ]
        importaveis = [i for i in melhor if i.numero in respostas]

        with transaction.atomic():
            gravadas = self._gravar(op, doc_prova, doc_gabarito, importaveis, respostas)
            Ingestao.objects.create(
                prova_id=op["prova"] if not op["dry_run"] else None,
                arquivo_prova=str(doc_prova.caminho),
                arquivo_gabarito=str(doc_gabarito.caminho),
                status=(
                    Ingestao.Status.SUCESSO
                    if not descartes
                    else Ingestao.Status.PARCIAL
                ),
                questoes_detectadas=len(melhor),
                questoes_importadas=gravadas,
                descartes=descartes,
            )
            if op["dry_run"]:
                transaction.set_rollback(True)

        prefixo = "[simulação] " if op["dry_run"] else ""
        self.stdout.write("")
        self.stdout.write(
            self.style.SUCCESS(
                f"{prefixo}{gravadas} de {len(respostas)} itens importados "
                f"({len(melhor)} detectados no caderno)."
            )
        )
        for d in descartes[:8]:
            self.stdout.write(f"  descartado {d['numero']}: {d['motivo']}")
        if op["dry_run"]:
            self.stdout.write("Nada foi gravado. Rode de novo sem --dry-run para importar.")

    # ------------------------------------------------------------------ apoio

    @staticmethod
    def _ler_faixas(bruto: str) -> dict[str, tuple[int, int]]:
        faixas: dict[str, tuple[int, int]] = {}
        for parte in (p.strip() for p in bruto.split(",") if p.strip()):
            casado = re.fullmatch(r"([a-z0-9-]+):(\d{1,3})-(\d{1,3})", parte)
            if not casado:
                raise ErroDeIngestao(
                    f"faixa inválida: {parte!r}. Use 'disciplina:inicio-fim', ex.: 'ti:51-110'."
                )
            faixas[casado.group(1)] = (int(casado.group(2)), int(casado.group(3)))
        return faixas

    def _gravar(self, op, doc_prova, doc_gabarito, itens, respostas) -> int:
        fonte, _ = Fonte.objects.update_or_create(
            slug=op["prova"],
            defaults={
                "tipo": Fonte.Tipo.OFICIAL,
                "titulo": f"{op['orgao']} {op['ano']} — {op['cargo']} (certo/errado)",
                "sha256": doc_prova.sha256,
                "observacao": f"Gabarito: {doc_gabarito.caminho.name}",
            },
        )
        prova, _ = Prova.objects.update_or_create(
            id=op["prova"],
            defaults={
                "ano": op["ano"],
                "banca": op["banca"],
                "cargo": op["cargo"],
                "orgao": op["orgao"],
                "qtd_questoes": len(respostas),
                # Cebraspe desconta por padrão; o edital é quem decide, então há
                # como desligar.
                "pontuacao_liquida": not op["sem_desconto"],
                "fonte": fonte,
            },
        )

        preservado = {
            i: (t, s, e)
            for i, t, s, e in Questao.objects.filter(prova=prova).values_list(
                "id", "topico_id", "subtopico_id", "explicacao"
            )
        }
        topicos_por_disciplina: dict[str, set[str]] = {}
        for topico_id, disciplina_id in Topico.objects.values_list("id", "disciplina_id"):
            topicos_por_disciplina.setdefault(disciplina_id, set()).add(topico_id)

        Questao.objects.filter(prova=prova).delete()

        gravadas = 0
        for item in itens:
            resposta = respostas[item.numero]
            questao_id = f"{prova.id}-q{item.numero:03d}"
            topico_id, subtopico_id, explicacao = preservado.get(questao_id, (None, None, ""))
            if topico_id and topico_id not in topicos_por_disciplina.get(
                resposta.disciplina_id or "", set()
            ):
                topico_id, subtopico_id = None, None

            Questao.objects.create(
                id=questao_id,
                disciplina_id=resposta.disciplina_id,
                prova=prova,
                numero_na_prova=item.numero,
                ano=op["ano"],
                banca=op["banca"],
                enunciado=item.enunciado,
                tipo=TipoQuestao.CERTO_ERRADO,
                correta="" if resposta.anulada else (resposta.letra or ""),
                anulada=resposta.anulada,
                topico_id=topico_id,
                subtopico_id=subtopico_id,
                explicacao=explicacao,
                fonte=fonte,
            )
            gravadas += 1
        return gravadas
