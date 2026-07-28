import type { Concurso, Fonte } from "@/types";

/**
 * Catálogo de concursos.
 *
 * Nenhum destes registros veio de edital publicado — todos os quatro são
 * concursos **previstos**, e o que se sabe deles saiu de imprensa. Por isso a
 * `fonte` de todos tem `eOficial: false`: a tela precisa poder dizer "a
 * confirmar" em vez de apresentar vaga e salário como se fossem números fechados
 * (§2.2 do CLAUDE.md). Vagas, banca e salário de concurso previsto mudam até o
 * edital sair.
 */

const FONTE_IMPRENSA_TI_2026: Fonte = {
  slug: "oliberal-concursos-ti-2026",
  tipo: "amostra",
  rotulo: "Imprensa — a confirmar",
  titulo:
    "Concursos de TI ganham força em 2026 e oferecem salários de até R$ 26 mil (O Liberal, abr/2026)",
  url: "https://www.oliberal.com/concurso/concursos-de-ti-ganham-forca-em-2026-e-oferecem-salarios-de-ate-r-26-mil-1.1108010",
  publicadoEm: "2026-04-01",
  eOficial: false,
};

/**
 * O BB de 2026 não tem edital, não tem data e não tem banca definida: o contrato
 * com a Cesgranrio foi encerrado em 11/12/2025 e o banco enviou o Termo de
 * Referência para quatro instituições (Cesgranrio, FGV, Cebraspe e IBFC).
 * `banca: null` e `dataProva: null` são o estado verdadeiro — preencher com
 * "Cesgranrio" ou com uma data provável faria o app contar dias para uma prova
 * inventada, que é o que ele fazia antes.
 */
const FONTE_BB_2026: Fonte = {
  slug: "bb-2026-situacao",
  tipo: "amostra",
  rotulo: "Imprensa — a confirmar",
  titulo: "Situação do concurso BB 2026: contrato com a Cesgranrio encerrado, banca em definição",
  url: "https://blog.grancursosonline.com.br/concurso-banco-do-brasil-contrato-cesgranrio-encerrado-2026/",
  publicadoEm: "2026-01-13",
  eOficial: false,
};

export const concursos: Concurso[] = [
  {
    id: "bb-ti-2026",
    nome: "Banco do Brasil — Agente de Tecnologia",
    orgao: "Banco do Brasil",
    cargo: "Escriturário — Agente de Tecnologia",
    banca: null,
    salario: {
      valor: 6286.78,
      observacao: "Salário inicial do último edital (2022); não confirmado para 2026.",
    },
    vagas: null,
    status: "previsto",
    dataProva: null,
    editalUrl: null,
    // Provas do acervo local. As de Agente Comercial entram porque os
    // Conhecimentos Básicos são os mesmos do cargo de TI — mas as questões de
    // Informática e Vendas delas são de outro cargo e ficam em disciplina própria.
    provaIds: [
      "bb-ti-2023",
      "bb-comercial-a-2023",
      "bb-comercial-b-2023",
      "bb-comercial-c-2023",
      // 2021 entra pelos Conhecimentos Básicos, que se repetem entre os cargos e
      // entre as edições. Dá a segunda aplicação de prova — sem ela, a análise de
      // incidência descreve um caderno só e não tem como sugerir tendência.
      "bb-2021-a",
      "bb-2021-b",
      "bb-2021-c",
    ],
    fonte: FONTE_BB_2026,
  },
  {
    id: "tce-sp-ti-2026",
    nome: "TCE-SP — Auditor de Controle Externo (TI)",
    orgao: "Tribunal de Contas do Estado de São Paulo",
    cargo: "Auditor de Controle Externo — Tecnologia da Informação",
    banca: null,
    salario: { valor: 20900, observacao: "Teto citado pela imprensa; não confirmado em edital." },
    vagas: 50,
    status: "previsto",
    dataProva: null,
    editalUrl: null,
    provaIds: [],
    fonte: FONTE_IMPRENSA_TI_2026,
  },
  {
    id: "tce-rj-ti-2026",
    nome: "TCE-RJ — Auditor de Controle Externo (TI)",
    orgao: "Tribunal de Contas do Estado do Rio de Janeiro",
    cargo: "Auditor de Controle Externo — Tecnologia da Informação",
    banca: null,
    salario: { valor: 26000, observacao: "Teto citado pela imprensa; não confirmado em edital." },
    vagas: 40,
    status: "previsto",
    dataProva: null,
    editalUrl: null,
    provaIds: [],
    fonte: FONTE_IMPRENSA_TI_2026,
  },
  {
    id: "ati-pe-ti-2026",
    nome: "ATI-PE — Analista de TI",
    orgao: "Agência Estadual de Tecnologia da Informação de Pernambuco",
    cargo: "Analista de Tecnologia da Informação",
    banca: null,
    salario: { valor: 9000, observacao: "Teto citado pela imprensa; não confirmado em edital." },
    vagas: 82,
    status: "previsto",
    dataProva: null,
    editalUrl: null,
    provaIds: [],
    fonte: FONTE_IMPRENSA_TI_2026,
  },
];

export const concursoPorId = (id: string): Concurso | undefined =>
  concursos.find((c) => c.id === id);
