"""
Testes das Fases 2 e 3 (`CLAUDE.md` §8): camada heurística de classificação,
importador de classificação por IA externa, e o modelo de Concurso/Edital.

Rodar com `manage.py test catalogo`.
"""

import json
import tempfile
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase

from catalogo.classificacao import classificar_por_heuristica
from catalogo.models import (
    Banca,
    ClassificacaoQuestao,
    Concurso,
    Disciplina,
    Edital,
    Fonte,
    Prova,
    Questao,
    Subtopico,
    Topico,
)


# --------------------------------------------------------------------- heurística


class ClassificarPorHeuristicaTest(SimpleTestCase):
    def test_positivo_quando_exatamente_um_subtopico_bate(self):
        resultado = classificar_por_heuristica(
            "Sobre o banco de dados MongoDB, é correto afirmar que armazena documentos."
        )
        self.assertIsNotNone(resultado)
        self.assertEqual(resultado.subtopico_id, "ti-t02-s02")
        self.assertIn("mongodb", resultado.termos_casados)
        self.assertGreater(resultado.confianca, 0)

    def test_negativo_quando_nenhum_termo_bate(self):
        resultado = classificar_por_heuristica(
            "Este enunciado não menciona nenhuma tecnologia específica do edital."
        )
        self.assertIsNone(resultado)

    def test_ambiguo_quando_mais_de_um_subtopico_bate(self):
        # "kotlin" é âncora de ti-t04-s01; "typescript" é âncora de ti-t06-s03.
        resultado = classificar_por_heuristica(
            "O time reescreveu o app mobile de Kotlin para uma stack em TypeScript."
        )
        self.assertIsNone(resultado)

    def test_considera_texto_base_alem_do_enunciado(self):
        resultado = classificar_por_heuristica(
            "Considerando o trecho acima, qual estrutura é mais adequada?",
            texto_base="O sistema usa uma lista encadeada para representar a fila de tarefas.",
        )
        self.assertIsNotNone(resultado)
        self.assertEqual(resultado.subtopico_id, "ti-t05-s02")


# ------------------------------------------------------------- importador LLM


class ImportarClassificacaoLlmTest(TestCase):
    def setUp(self):
        fonte = Fonte.objects.create(slug="fonte-teste", tipo=Fonte.Tipo.OFICIAL, titulo="Teste")
        self.disciplina_ti = Disciplina.objects.create(id="ti", nome="TI", cor="#000000", fonte=fonte)
        self.disciplina_port = Disciplina.objects.create(
            id="portugues", nome="Português", cor="#111111", fonte=fonte
        )
        self.topico = Topico.objects.create(id="ti-t02", disciplina=self.disciplina_ti, nome="Banco de Dados")
        self.subtopico = Subtopico.objects.create(
            id="ti-t02-s03", topico=self.topico, nome="linguagem SQL2008"
        )
        self.questao = Questao.objects.create(
            id="q-teste-01",
            disciplina=self.disciplina_ti,
            ano=2023,
            banca="Cesgranrio",
            enunciado="Enunciado de teste sobre SQL.",
            fonte=fonte,
        )
        self.questao_portugues = Questao.objects.create(
            id="q-teste-02",
            disciplina=self.disciplina_port,
            ano=2023,
            banca="Cesgranrio",
            enunciado="Enunciado de português.",
            fonte=fonte,
        )

    def _arquivo(self, conteudo: str) -> str:
        arquivo = tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False, encoding="utf-8"
        )
        arquivo.write(conteudo)
        arquivo.close()
        self.addCleanup(lambda: Path(arquivo.name).unlink(missing_ok=True))
        return arquivo.name

    def test_schema_valido_grava_com_origem_llm_externa(self):
        caminho = self._arquivo(
            json.dumps(
                {
                    "q-teste-01": {
                        "assunto": "ti-t02-s03",
                        "confianca": 0.9,
                        "justificativa": "menciona SELECT e JOIN",
                    }
                }
            )
        )

        call_command("importar_classificacao_llm", arquivo=caminho)

        self.questao.refresh_from_db()
        self.assertEqual(self.questao.topico_id, "ti-t02")
        self.assertEqual(self.questao.subtopico_id, "ti-t02-s03")

        classificacao = ClassificacaoQuestao.objects.get(questao=self.questao, eh_primaria=True)
        self.assertEqual(classificacao.origem_classificacao, "llm_externa")
        self.assertEqual(classificacao.confianca, 0.9)
        self.assertFalse(classificacao.revisada_por_humano)
        self.assertTrue(classificacao.justificativa)

    def test_schema_invalido_nao_grava_nada(self):
        # falta "justificativa"
        caminho = self._arquivo(
            json.dumps({"q-teste-01": {"assunto": "ti-t02-s03", "confianca": 0.9}})
        )

        with self.assertRaises(CommandError):
            call_command("importar_classificacao_llm", arquivo=caminho)

        self.questao.refresh_from_db()
        self.assertIsNone(self.questao.topico)
        self.assertEqual(ClassificacaoQuestao.objects.count(), 0)

    def test_slug_inexistente_eh_recusado(self):
        caminho = self._arquivo(
            json.dumps(
                {
                    "q-teste-01": {
                        "assunto": "ti-inventado-99",
                        "confianca": 0.9,
                        "justificativa": "x",
                    }
                }
            )
        )

        with self.assertRaises(CommandError):
            call_command("importar_classificacao_llm", arquivo=caminho)

        self.assertEqual(ClassificacaoQuestao.objects.count(), 0)

    def test_disciplina_incompativel_eh_recusada(self):
        # ti-t02-s03 é de TI; a questão é de português.
        caminho = self._arquivo(
            json.dumps(
                {
                    "q-teste-02": {
                        "assunto": "ti-t02-s03",
                        "confianca": 0.9,
                        "justificativa": "x",
                    }
                }
            )
        )

        with self.assertRaises(CommandError):
            call_command("importar_classificacao_llm", arquivo=caminho)

    def test_chave_duplicada_no_arquivo_eh_recusada(self):
        bruto = (
            '{"q-teste-01": {"assunto": "ti-t02-s03", "confianca": 0.9, "justificativa": "a"}, '
            '"q-teste-01": {"assunto": "ti-t02-s03", "confianca": 0.5, "justificativa": "b"}}'
        )
        caminho = self._arquivo(bruto)

        with self.assertRaises(CommandError):
            call_command("importar_classificacao_llm", arquivo=caminho)

        self.assertEqual(ClassificacaoQuestao.objects.count(), 0)

    def test_dry_run_nao_grava(self):
        caminho = self._arquivo(
            json.dumps(
                {
                    "q-teste-01": {
                        "assunto": "ti-t02-s03",
                        "confianca": 0.9,
                        "justificativa": "x",
                    }
                }
            )
        )

        call_command("importar_classificacao_llm", arquivo=caminho, dry_run=True)

        self.questao.refresh_from_db()
        self.assertIsNone(self.questao.topico)
        self.assertEqual(ClassificacaoQuestao.objects.count(), 0)

    def test_reimportar_a_mesma_questao_atualiza_em_vez_de_duplicar(self):
        caminho1 = self._arquivo(
            json.dumps(
                {"q-teste-01": {"assunto": "ti-t02", "confianca": 0.6, "justificativa": "primeira"}}
            )
        )
        call_command("importar_classificacao_llm", arquivo=caminho1)

        caminho2 = self._arquivo(
            json.dumps(
                {
                    "q-teste-01": {
                        "assunto": "ti-t02-s03",
                        "confianca": 0.95,
                        "justificativa": "segunda, mais específica",
                    }
                }
            )
        )
        call_command("importar_classificacao_llm", arquivo=caminho2)

        self.assertEqual(ClassificacaoQuestao.objects.filter(questao=self.questao).count(), 1)
        classificacao = ClassificacaoQuestao.objects.get(questao=self.questao)
        self.assertEqual(classificacao.subtopico_id, "ti-t02-s03")
        self.assertEqual(classificacao.confianca, 0.95)


# --------------------------------------------------------------- Fase 3: Concurso/Edital


class ConcursoEditalTest(TestCase):
    def setUp(self):
        fonte = Fonte.objects.create(slug="fonte-teste-c3", tipo=Fonte.Tipo.OFICIAL, titulo="Teste")
        self.banca = Banca.objects.create(slug="cesgranrio-teste", nome="Cesgranrio")
        self.concurso = Concurso.objects.create(
            slug="concurso-teste",
            nome="Concurso Teste",
            orgao="Órgão Teste",
            cargo="Cargo Teste",
            banca=self.banca,
            status="encerrado",
            fonte=fonte,
        )
        self.prova = Prova.objects.create(
            id="prova-teste-c3",
            concurso=self.concurso,
            ano=2023,
            banca="Cesgranrio",
            cargo="Cargo Teste",
            orgao="Órgão Teste",
            qtd_questoes=1,
            fonte=fonte,
        )

    def test_prova_aponta_pro_concurso_certo(self):
        self.assertEqual(self.prova.concurso_id, "concurso-teste")
        self.assertEqual(self.concurso.provas.count(), 1)

    def test_deletar_concurso_no_deixa_prova_orfa_mas_desliga_o_vinculo(self):
        # SET_NULL, não CASCADE: apagar um concurso não pode levar a prova junto
        # — a prova continua existindo, só perde o carimbo de concurso.
        self.concurso.delete()
        self.prova.refresh_from_db()
        self.assertIsNone(self.prova.concurso_id)

    def test_so_um_edital_vigente_por_concurso(self):
        fonte2 = Fonte.objects.create(slug="fonte-teste-c3-edital2", tipo=Fonte.Tipo.OFICIAL, titulo="v2")
        Edital.objects.create(concurso=self.concurso, versao=1, fonte=self.prova.fonte, eh_vigente=True)
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Edital.objects.create(concurso=self.concurso, versao=2, fonte=fonte2, eh_vigente=True)

    def test_um_nao_vigente_convive_com_um_vigente(self):
        fonte2 = Fonte.objects.create(slug="fonte-teste-c3-edital3", tipo=Fonte.Tipo.OFICIAL, titulo="v2")
        Edital.objects.create(concurso=self.concurso, versao=1, fonte=self.prova.fonte, eh_vigente=True)
        Edital.objects.create(concurso=self.concurso, versao=2, fonte=fonte2, eh_vigente=False)
        self.assertEqual(Edital.objects.filter(concurso=self.concurso).count(), 2)


class FiltroConcursoNaApiTest(TestCase):
    """A API precisa filtrar prova/questão por concurso sem depender do
    recorte que hoje mora em `useAcervoDoConcurso` no frontend (§7.3)."""

    def setUp(self):
        fonte = Fonte.objects.create(slug="fonte-teste-api", tipo=Fonte.Tipo.OFICIAL, titulo="Teste")
        disciplina = Disciplina.objects.create(id="ti-teste-api", nome="TI", cor="#000", fonte=fonte)

        self.concurso_a = Concurso.objects.create(
            slug="concurso-a", nome="A", orgao="X", cargo="Y", status="encerrado", fonte=fonte
        )
        self.concurso_b = Concurso.objects.create(
            slug="concurso-b", nome="B", orgao="X", cargo="Y", status="encerrado", fonte=fonte
        )
        prova_a = Prova.objects.create(
            id="prova-a", concurso=self.concurso_a, ano=2023, banca="Cesgranrio",
            cargo="Y", orgao="X", qtd_questoes=1, fonte=fonte,
        )
        prova_b = Prova.objects.create(
            id="prova-b", concurso=self.concurso_b, ano=2023, banca="Cesgranrio",
            cargo="Y", orgao="X", qtd_questoes=1, fonte=fonte,
        )
        Questao.objects.create(
            id="questao-a", disciplina=disciplina, prova=prova_a, ano=2023, banca="Cesgranrio",
            enunciado="Enunciado A.", fonte=fonte,
        )
        Questao.objects.create(
            id="questao-b", disciplina=disciplina, prova=prova_b, ano=2023, banca="Cesgranrio",
            enunciado="Enunciado B.", fonte=fonte,
        )

    def test_questoes_filtradas_por_concurso(self):
        resposta = self.client.get("/api/questoes/?concurso=concurso-a")
        ids = [q["id"] for q in resposta.json()["results"]]
        self.assertEqual(ids, ["questao-a"])

    def test_provas_filtradas_por_concurso(self):
        resposta = self.client.get("/api/provas/?concurso=concurso-b")
        ids = [p["id"] for p in resposta.json()["results"]]
        self.assertEqual(ids, ["prova-b"])

    def test_sem_filtro_devolve_tudo_e_avisa_no_header(self):
        resposta = self.client.get("/api/questoes/")
        ids = {q["id"] for q in resposta.json()["results"]}
        self.assertEqual(ids, {"questao-a", "questao-b"})
        self.assertIn("X-Deprecation-Warning", resposta.headers)

    def test_com_filtro_nao_tem_o_header_de_aviso(self):
        resposta = self.client.get("/api/questoes/?concurso=concurso-a")
        self.assertNotIn("X-Deprecation-Warning", resposta.headers)
