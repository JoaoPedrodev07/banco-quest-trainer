"""Testes da Onda 1 (ADR-021): conta, token e sincronização de progresso."""

from django.test import TestCase

PROGRESSO_MINIMO = {
    "concursoAtivoId": "bb-ti-2026",
    "dataProva": "2026-10-25T00:00:00.000Z",
    "metaDiaria": 20,
    "editalStatus": {},
    "historico": [],
    "revisoes": [],
    "streak": {"ultimoDia": None, "dias": 0},
    "cadernos": [],
    "tentativasProva": [],
    "flashcardsSrs": {},
    "cartoesProprios": [],
    "anotacoes": {},
}


class ContaTest(TestCase):
    def registrar(self, email="a@a.com", senha="Senha-forte-123"):
        return self.client.post(
            "/api/conta/registrar/",
            {"email": email, "senha": senha},
            content_type="application/json",
        )

    def test_registrar_devolve_token_e_login_funciona(self):
        resposta = self.registrar()
        self.assertEqual(resposta.status_code, 201)
        self.assertIn("token", resposta.json())

        login = self.client.post(
            "/api/conta/entrar/",
            {"email": "a@a.com", "senha": "Senha-forte-123"},
            content_type="application/json",
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json()["email"], "a@a.com")

    def test_senha_fraca_e_email_invalido_sao_recusados(self):
        self.assertEqual(self.registrar(senha="123").status_code, 400)
        self.assertEqual(self.registrar(email="nao-e-email").status_code, 400)

    def test_email_duplicado_recusa_com_mensagem_clara(self):
        self.registrar()
        resposta = self.registrar()
        self.assertEqual(resposta.status_code, 400)
        self.assertIn("Já existe conta", resposta.json()["erro"])

    def test_login_errado_nao_revela_se_o_email_existe(self):
        self.registrar()
        errada = self.client.post(
            "/api/conta/entrar/",
            {"email": "a@a.com", "senha": "errada-123456"},
            content_type="application/json",
        )
        inexistente = self.client.post(
            "/api/conta/entrar/",
            {"email": "ninguem@a.com", "senha": "errada-123456"},
            content_type="application/json",
        )
        self.assertEqual(errada.status_code, 400)
        self.assertEqual(errada.json(), inexistente.json())

    def test_progresso_exige_token(self):
        self.assertEqual(self.client.get("/api/conta/progresso/").status_code, 401)


class SincronizacaoTest(TestCase):
    def setUp(self):
        token = self.client.post(
            "/api/conta/registrar/",
            {"email": "a@a.com", "senha": "Senha-forte-123"},
            content_type="application/json",
        ).json()["token"]
        self.auth = {"HTTP_AUTHORIZATION": f"Token {token}"}

    def _put(self, progresso, base=None, force=False):
        corpo = {"progresso": progresso, "versao": 2}
        if base is not None:
            corpo["base"] = base
        if force:
            corpo["force"] = True
        return self.client.put(
            "/api/conta/progresso/", corpo, content_type="application/json", **self.auth
        )

    def test_ciclo_completo_put_e_get(self):
        self.assertIsNone(
            self.client.get("/api/conta/progresso/", **self.auth).json()["progresso"]
        )
        gravou = self._put(PROGRESSO_MINIMO)
        self.assertEqual(gravou.status_code, 200)
        lido = self.client.get("/api/conta/progresso/", **self.auth).json()
        self.assertEqual(lido["progresso"], PROGRESSO_MINIMO)
        self.assertEqual(lido["versao"], 2)

    def test_conflito_de_dois_dispositivos_da_409_e_force_resolve(self):
        self._put(PROGRESSO_MINIMO)
        base_antiga = self.client.get("/api/conta/progresso/", **self.auth).json()[
            "atualizadoEm"
        ]
        # "Outro dispositivo" salva por cima:
        self._put({**PROGRESSO_MINIMO, "metaDiaria": 30}, base=base_antiga)

        # Este dispositivo, com a base velha, NÃO pode sobrescrever calado:
        conflito = self._put({**PROGRESSO_MINIMO, "metaDiaria": 10}, base=base_antiga)
        self.assertEqual(conflito.status_code, 409)

        # A escolha explícita do usuário passa:
        forcado = self._put({**PROGRESSO_MINIMO, "metaDiaria": 10}, force=True)
        self.assertEqual(forcado.status_code, 200)

    def test_progresso_de_um_usuario_nao_vaza_para_outro(self):
        self._put(PROGRESSO_MINIMO)
        token_b = self.client.post(
            "/api/conta/registrar/",
            {"email": "b@b.com", "senha": "Senha-forte-123"},
            content_type="application/json",
        ).json()["token"]
        do_b = self.client.get(
            "/api/conta/progresso/", HTTP_AUTHORIZATION=f"Token {token_b}"
        ).json()
        self.assertIsNone(do_b["progresso"])

    def test_corpo_sem_historico_e_recusado(self):
        self.assertEqual(self._put({"qualquer": "coisa"}).status_code, 400)

    def test_sair_revoga_o_token(self):
        self.client.post("/api/conta/sair/", **self.auth)
        self.assertEqual(
            self.client.get("/api/conta/progresso/", **self.auth).status_code, 401
        )
