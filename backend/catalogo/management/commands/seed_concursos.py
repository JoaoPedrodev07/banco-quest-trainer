"""
Popula o catálogo de concursos (ADR-015) com os 7 registros que viviam
hardcoded em `src/data/concursos.ts` — e vincula as provas de cada um.

Idempotente: roda quantas vezes precisar (update_or_create em tudo). Os slugs
das fontes são os MESMOS do frontend de propósito — `ehTreinoDeFormato` testa
`fonte.slug === "treino-de-formato"`, e mudar o slug aqui inverteria o aviso
mais importante da tela.

Prova listada que não existe no acervo é avisada e ignorada (importa-se a prova
depois e roda de novo) — nunca criada na marra, pelo mesmo princípio do
importador de classificação.
"""

from django.core.management.base import BaseCommand

from catalogo.models import Banca, Concurso, Fonte, Prova

FONTES = [
    {
        "slug": "bb-2026-situacao",
        "tipo": "amostra",
        "rotulo": "Imprensa — a confirmar",
        "titulo": "Situação do concurso BB 2026: contrato com a Cesgranrio encerrado, banca em definição",
        "url": "https://blog.grancursosonline.com.br/concurso-banco-do-brasil-contrato-cesgranrio-encerrado-2026/",
        "publicado_em": "2026-01-13",
    },
    {
        "slug": "oliberal-concursos-ti-2026",
        "tipo": "amostra",
        "rotulo": "Imprensa — a confirmar",
        "titulo": "Concursos de TI ganham força em 2026 e oferecem salários de até R$ 26 mil (O Liberal, abr/2026)",
        "url": "https://www.oliberal.com/concurso/concursos-de-ti-ganham-forca-em-2026-e-oferecem-salarios-de-ate-r-26-mil-1.1108010",
        "publicado_em": "2026-04-01",
    },
    {
        "slug": "treino-de-formato",
        "tipo": "derivada",
        "rotulo": "Concurso encerrado — treino de formato",
        "titulo": "Prova anterior de outro órgão, no catálogo para treinar o estilo da banca",
        "url": "",
        "publicado_em": None,
    },
]

BANCAS = [("fgv", "FGV"), ("cesgranrio", "Cesgranrio"), ("cebraspe", "Cebraspe")]

CONCURSOS = [
    {
        "slug": "bb-ti-2026",
        "nome": "Banco do Brasil — Agente de Tecnologia",
        "orgao": "Banco do Brasil",
        "cargo": "Escriturário — Agente de Tecnologia",
        "banca": None,  # contrato com a Cesgranrio encerrado; banca em disputa (§2.2)
        "status": "previsto",
        "data_prova": None,
        "salario_valor": "6286.78",
        "salario_observacao": "Salário inicial do último edital (2022); não confirmado para 2026.",
        "vagas": None,
        "fonte": "bb-2026-situacao",
        "ordem": 0,
        "provas": [
            "bb-ti-2023",
            "bb-comercial-a-2023",
            "bb-comercial-b-2023",
            "bb-comercial-c-2023",
            "bb-2021-a",
            "bb-2021-b",
            "bb-2021-c",
            "bb-escriturario-2018",
            "bb-escriturario-2014",
        ],
    },
    {
        "slug": "tce-sp-ti-2026",
        "nome": "TCE-SP — Auditor de Controle Externo (TI)",
        "orgao": "Tribunal de Contas do Estado de São Paulo",
        "cargo": "Auditor de Controle Externo — Tecnologia da Informação",
        "banca": None,
        "status": "previsto",
        "data_prova": None,
        "salario_valor": "20900",
        "salario_observacao": "Teto citado pela imprensa; não confirmado em edital.",
        "vagas": 50,
        "fonte": "oliberal-concursos-ti-2026",
        "ordem": 1,
        "provas": [],
    },
    {
        "slug": "tce-rj-ti-2026",
        "nome": "TCE-RJ — Auditor de Controle Externo (TI)",
        "orgao": "Tribunal de Contas do Estado do Rio de Janeiro",
        "cargo": "Auditor de Controle Externo — Tecnologia da Informação",
        "banca": None,
        "status": "previsto",
        "data_prova": None,
        "salario_valor": "26000",
        "salario_observacao": "Teto citado pela imprensa; não confirmado em edital.",
        "vagas": 40,
        "fonte": "oliberal-concursos-ti-2026",
        "ordem": 2,
        "provas": [],
    },
    {
        "slug": "ati-pe-ti-2026",
        "nome": "ATI-PE — Analista de TI",
        "orgao": "Agência Estadual de Tecnologia da Informação de Pernambuco",
        "cargo": "Analista de Tecnologia da Informação",
        "banca": None,
        "status": "previsto",
        "data_prova": None,
        "salario_valor": "9000",
        "salario_observacao": "Teto citado pela imprensa; não confirmado em edital.",
        "vagas": 82,
        "fonte": "oliberal-concursos-ti-2026",
        "ordem": 3,
        "provas": [],
    },
    {
        "slug": "fgv-banestes-ti-2021",
        "nome": "Banestes 2021 — Analista de TI (treino FGV)",
        "orgao": "Banco do Estado do Espírito Santo",
        "cargo": "Analista em Tecnologia da Informação - Desenvolvimento de Sistemas",
        "banca": "fgv",
        "status": "encerrado",
        "data_prova": "2021-12-19",
        "salario_valor": None,
        "salario_observacao": "",
        "vagas": None,
        "fonte": "treino-de-formato",
        "ordem": 4,
        "provas": ["fgv-banestes-ti-2021"],
    },
    {
        "slug": "cesgranrio-caixa-2024",
        "nome": "Caixa 2024 — Técnico Bancário (treino Cesgranrio)",
        "orgao": "Caixa Econômica Federal",
        "cargo": "Técnico Bancário Novo",
        "banca": "cesgranrio",
        "status": "encerrado",
        "data_prova": "2024-05-26",
        "salario_valor": None,
        "salario_observacao": "",
        "vagas": None,
        "fonte": "treino-de-formato",
        "ordem": 5,
        "provas": ["cesgranrio-caixa-ti-2024", "cesgranrio-caixa-geral-2024"],
    },
    {
        "slug": "cebraspe-bnb-ti-2022",
        "nome": "BNB 2022 — Analista de Sistemas (treino Cebraspe)",
        "orgao": "Banco do Nordeste do Brasil",
        "cargo": "Especialista Técnico — Analista de Sistemas",
        "banca": "cebraspe",
        "status": "encerrado",
        "data_prova": "2022-12-04",
        "salario_valor": None,
        "salario_observacao": "",
        "vagas": None,
        "fonte": "treino-de-formato",
        "ordem": 6,
        "provas": ["cebraspe-bnb-ti-2022"],
    },
]


class Command(BaseCommand):
    help = "Popula/atualiza o catálogo de concursos (ADR-015) e vincula as provas."

    def handle(self, *args, **options):
        for dados in FONTES:
            Fonte.objects.update_or_create(
                slug=dados["slug"],
                defaults={k: v for k, v in dados.items() if k != "slug"},
            )
        for slug, nome in BANCAS:
            Banca.objects.update_or_create(slug=slug, defaults={"nome": nome})

        for c in CONCURSOS:
            concurso, _ = Concurso.objects.update_or_create(
                slug=c["slug"],
                defaults={
                    "nome": c["nome"],
                    "orgao": c["orgao"],
                    "cargo": c["cargo"],
                    "banca_id": c["banca"],
                    "status": c["status"],
                    "data_prova": c["data_prova"],
                    "salario_valor": c["salario_valor"],
                    "salario_observacao": c["salario_observacao"],
                    "vagas": c["vagas"],
                    "fonte_id": c["fonte"],
                    "ordem": c["ordem"],
                },
            )
            for prova_id in c["provas"]:
                atualizadas = Prova.objects.filter(pk=prova_id).update(concurso=concurso)
                if not atualizadas:
                    self.stdout.write(
                        self.style.WARNING(
                            f"prova '{prova_id}' do catálogo não existe no acervo — "
                            "importe-a e rode o seed de novo."
                        )
                    )
            self.stdout.write(f"{concurso.slug}: ok ({len(c['provas'])} provas no catálogo)")

        self.stdout.write(self.style.SUCCESS(f"{len(CONCURSOS)} concursos no catálogo."))
