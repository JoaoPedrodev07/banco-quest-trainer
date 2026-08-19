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


class AulaVersionadaTest(TestCase):
    """ADR-016: regravar aula cria versão nova em vez de apagar a anterior."""

    def setUp(self):
        from catalogo.models import Aula  # noqa: F401 — usado nos testes abaixo

        fonte = Fonte.objects.create(slug="fonte-teste-aula", tipo=Fonte.Tipo.OFICIAL, titulo="T")
        disciplina = Disciplina.objects.create(id="ti-teste-aula", nome="TI", cor="#000", fonte=fonte)
        self.topico = Topico.objects.create(
            id="ti-teste-aula-1", disciplina=disciplina, nome="Bancos de dados"
        )

    def _salvar(self, texto, prompt_versao=""):
        return self.client.post(
            "/api/aulas/",
            {
                "unidadeId": self.topico.id,
                "concursoId": "bb-ti-2026",
                "conteudoMarkdown": texto,
                "modelo": "",
                "promptVersao": prompt_versao,
            },
            content_type="application/json",
        )

    def test_regravar_cria_v2_e_preserva_a_v1_como_historico(self):
        from catalogo.models import Aula

        self.assertEqual(self._salvar("versão um", "1").status_code, 201)
        self.assertEqual(self._salvar("versão dois", "1").status_code, 201)

        self.assertEqual(Aula.objects.count(), 2)
        corrente = Aula.objects.get(substituida_em__isnull=True)
        self.assertEqual(corrente.versao, 2)
        self.assertEqual(corrente.conteudo_markdown, "versão dois")
        antiga = Aula.objects.get(substituida_em__isnull=False)
        self.assertEqual(antiga.versao, 1)
        self.assertEqual(antiga.conteudo_markdown, "versão um")

    def test_listagem_devolve_so_a_corrente(self):
        self._salvar("versão um")
        self._salvar("versão dois")
        resposta = self.client.get("/api/aulas/?concurso_id=bb-ti-2026").json()
        aulas = resposta["results"] if isinstance(resposta, dict) else resposta
        self.assertEqual(len(aulas), 1)
        self.assertEqual(aulas[0]["versao"], 2)

    def test_prompt_versao_fica_registrado(self):
        resposta = self._salvar("texto", prompt_versao="1")
        self.assertEqual(resposta.json()["promptVersao"], "1")


class ProblemaQuestaoTest(TestCase):
    """ADR-014: reportar problema é sinal para curadoria, nunca correção."""

    def setUp(self):
        fonte = Fonte.objects.create(slug="fonte-teste-prob", tipo=Fonte.Tipo.OFICIAL, titulo="T")
        disciplina = Disciplina.objects.create(id="ti-teste-prob", nome="TI", cor="#000", fonte=fonte)
        self.questao = Questao.objects.create(
            id="questao-prob-1", disciplina=disciplina, ano=2023, banca="Cesgranrio",
            enunciado="Enunciado.", correta="A", fonte=fonte,
        )

    def test_reportar_cria_e_aparece_na_fila(self):
        resposta = self.client.post(
            f"/api/questoes/{self.questao.id}/reportar/",
            {"tipo": "gabarito_errado", "descricao": "o gabarito oficial diz B"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 201)
        # A questão NÃO muda — report é sinal, não correção (§2.2).
        self.questao.refresh_from_db()
        self.assertEqual(self.questao.correta, "A")

        fila = self.client.get("/api/problemas/").json()
        itens = fila["results"] if isinstance(fila, dict) else fila
        self.assertEqual(len(itens), 1)
        self.assertEqual(itens[0]["tipo"], "gabarito_errado")

    def test_tipo_invalido_retorna_400(self):
        resposta = self.client.post(
            f"/api/questoes/{self.questao.id}/reportar/",
            {"tipo": "achei_dificil"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 400)

    def test_questao_inexistente_retorna_404(self):
        resposta = self.client.post(
            "/api/questoes/nao-existe/reportar/",
            {"tipo": "outro"},
            content_type="application/json",
        )
        self.assertEqual(resposta.status_code, 404)

    def test_resolver_tira_da_fila(self):
        from catalogo.models import ProblemaQuestao

        problema = ProblemaQuestao.objects.create(questao=self.questao, tipo="outro")
        resposta = self.client.post(f"/api/problemas/{problema.id}/resolver/")
        self.assertEqual(resposta.status_code, 200)
        fila = self.client.get("/api/problemas/").json()
        itens = fila["results"] if isinstance(fila, dict) else fila
        self.assertEqual(itens, [])
