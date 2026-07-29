"""
Testes do parser de provas.

O primeiro alvo é a classe de defeito que motivou estes testes: **questão cujas
alternativas são figuras**. O PDF traz as cinco letras — `(A)`, `(B)`, ... — mas
o conteúdo de cada uma é uma imagem (uma árvore binária, um diagrama E-R, um
gráfico). A extração de texto devolve string vazia, ou um fragmento solto que
sobrou de dentro da figura, como "22".

`completa` conferia apenas se as cinco letras existiam, e por isso 50 das 533
questões do acervo entraram inutilizáveis: chegam na tela com alternativas em
branco e um gabarito apontando para uma delas. O candidato não tem como
responder, e nada avisa — é o pior formato de erro para este app, porque parece
uma questão normal.

Rodar com `manage.py test ingest`. É tudo função pura, então `SimpleTestCase`:
sem banco, sem migração, roda em segundos.
"""

from django.test import SimpleTestCase

from ingest.parsers.cesgranrio import QuestaoBruta, parse_prova


def _questao(**alternativas: str) -> QuestaoBruta:
    return QuestaoBruta(numero=1, enunciado="Enunciado qualquer.", alternativas=alternativas)


class QuestaoCompletaTest(SimpleTestCase):
    def test_aceita_questao_com_cinco_alternativas_de_texto(self):
        questao = _questao(
            A="primeira opção", B="segunda opção", C="terceira", D="quarta", E="quinta"
        )
        self.assertTrue(questao.completa)
        self.assertEqual(questao.motivo_incompleta(), "")

    def test_recusa_quando_falta_letra(self):
        questao = _questao(A="uma", B="duas", C="tres", D="quatro")
        self.assertFalse(questao.completa)
        self.assertIn("E", questao.motivo_incompleta())

    def test_recusa_alternativas_vazias_de_questao_com_figura(self):
        """O caso real: bb-ti-2023-q67, árvore binária desenhada.

        Três alternativas vieram vazias e duas com fragmentos ("22", "23") que
        sobraram de dentro do desenho.
        """
        questao = _questao(A="", B="", C="22", D="", E="23")
        self.assertFalse(questao.completa)
        self.assertIn("figura", questao.motivo_incompleta())

    def test_recusa_mesmo_com_marcacao_de_negrito(self):
        """A extração marca negrito com `**`; isso não é conteúdo."""
        questao = _questao(A="", B="", C="**22**", D="", E="**23**")
        self.assertFalse(questao.completa)

    def test_aceita_alternativas_curtas_legitimas(self):
        """Questão de matemática responde com número — curto não é vazio.

        Esta é a fronteira que importa: apertar demais o critério jogaria fora
        questão boa, e o acervo perderia justamente as de cálculo.
        """
        questao = _questao(A="10", B="12", C="14", D="16", E="18")
        self.assertTrue(questao.completa)

    def test_aceita_uma_alternativa_curta_entre_longas(self):
        questao = _questao(
            A="uma opção longa", B="outra bem longa", C="0", D="mais uma", E="e a última"
        )
        self.assertTrue(questao.completa)

    def test_recusa_enunciado_vazio(self):
        questao = QuestaoBruta(numero=1, enunciado="", alternativas={l: "x" for l in "ABCDE"})
        self.assertFalse(questao.completa)
        self.assertEqual(questao.motivo_incompleta(), "enunciado vazio")


class ParseProvaTest(SimpleTestCase):
    def test_le_questao_simples(self):
        texto = "\n".join(
            [
                "1",
                "Qual é a capital do Brasil?",
                "(A) São Paulo",
                "(B) Rio de Janeiro",
                "(C) Brasília",
                "(D) Salvador",
                "(E) Belo Horizonte",
            ]
        )
        questoes = parse_prova(texto, total_esperado=1)
        self.assertEqual(len(questoes), 1)
        self.assertTrue(questoes[0].completa)
        self.assertEqual(questoes[0].alternativas["C"], "Brasília")

    def test_questao_com_figura_e_lida_mas_marcada_incompleta(self):
        """Ela precisa ser DETECTADA e recusada, não sumir em silêncio.

        Sumir seria tão ruim quanto importar: o relatório de descartes é o que
        permite auditar o acervo sem reabrir os PDFs.
        """
        texto = "\n".join(
            ["1", "Qual árvore foi recebida?", "(A)", "(B)", "(C) 22", "(D)", "(E) 23"]
        )
        questoes = parse_prova(texto, total_esperado=1)
        self.assertEqual(len(questoes), 1)
        self.assertFalse(questoes[0].completa)
        self.assertIn("figura", questoes[0].motivo_incompleta())

    def test_preserva_o_destaque_em_negrito_da_banca(self):
        """`**` marca a palavra destacada e não pode se perder no conteúdo."""
        texto = "\n".join(
            [
                "1",
                "A palavra destacada está correta em:",
                "(A) são **causadoras** de ansiedade",
                "(B) opção b",
                "(C) opção c",
                "(D) opção d",
                "(E) opção e",
            ]
        )
        questoes = parse_prova(texto, total_esperado=1)
        self.assertIn("**causadoras**", questoes[0].alternativas["A"])
