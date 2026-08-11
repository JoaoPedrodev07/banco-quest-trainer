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
      // Edições antigas do cargo de Escriturário, antes da divisão entre Agente
      // Comercial e Agente de Tecnologia. Entram pelo mesmo motivo que 2021: são
      // Conhecimentos Básicos do mesmo órgão e da mesma banca. Não trazem TI —
      // o cargo de tecnologia não existia ainda.
      "bb-escriturario-2018",
      "bb-escriturario-2014",
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

/**
 * Concursos já encerrados, no catálogo para **treinar o formato da banca**.
 *
 * Existem porque a banca do BB 2026 não está definida — o contrato com a
 * Cesgranrio caiu e disputam Cesgranrio, FGV, Cebraspe e IBFC. Treinar só no
 * estilo de uma é apostar. Aqui o candidato pode trocar o foco e sentir como
 * cada uma cobra.
 *
 * São concursos separados de propósito, e não provas anexadas ao BB: o edital é
 * de outro órgão e de outro cargo, e somá-los à contagem de incidência do BB
 * distorceria a análise — o mesmo erro que já custou três correções neste
 * acervo.
 */
const FONTE_TREINO: Fonte = {
  slug: "treino-de-formato",
  tipo: "derivada",
  rotulo: "Concurso encerrado — treino de formato",
  titulo: "Prova anterior de outro órgão, no catálogo para treinar o estilo da banca",
  url: "",
  publicadoEm: null,
  eOficial: false,
};

concursos.push(
  {
    id: "fgv-banestes-ti-2021",
    nome: "Banestes 2021 — Analista de TI (treino FGV)",
    orgao: "Banco do Estado do Espírito Santo",
    cargo: "Analista em Tecnologia da Informação - Desenvolvimento de Sistemas",
    banca: "FGV",
    salario: null,
    vagas: null,
    status: "encerrado",
    dataProva: "2021-12-19",
    editalUrl: null,
    provaIds: ["fgv-banestes-ti-2021"],
    fonte: FONTE_TREINO,
  },
  {
    // A mais valiosa das três: é a **mesma banca** que aplicou o BB até 2023, e
    // num concurso bancário recente. Se a Cesgranrio levar o contrato de 2026,
    // este é o treino mais próximo do real que o acervo tem.
    id: "cesgranrio-caixa-2024",
    nome: "Caixa 2024 — Técnico Bancário (treino Cesgranrio)",
    orgao: "Caixa Econômica Federal",
    cargo: "Técnico Bancário Novo",
    banca: "Cesgranrio",
    salario: null,
    vagas: null,
    status: "encerrado",
    dataProva: "2024-05-26",
    editalUrl: null,
    provaIds: ["cesgranrio-caixa-ti-2024", "cesgranrio-caixa-geral-2024"],
    fonte: FONTE_TREINO,
  },
  {
    id: "cebraspe-bnb-ti-2022",
    nome: "BNB 2022 — Analista de Sistemas (treino Cebraspe)",
    orgao: "Banco do Nordeste do Brasil",
    cargo: "Especialista Técnico — Analista de Sistemas",
    banca: "Cebraspe",
    salario: null,
    vagas: null,
    status: "encerrado",
    dataProva: "2022-12-04",
    editalUrl: null,
    provaIds: ["cebraspe-bnb-ti-2022"],
    fonte: FONTE_TREINO,
  },
);

export const concursoPorId = (id: string): Concurso | undefined =>
  concursos.find((c) => c.id === id);
