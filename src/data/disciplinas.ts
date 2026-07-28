import type { Disciplina } from "@/types";

export const disciplinas: Disciplina[] = [
  {
    id: "portugues",
    nome: "Língua Portuguesa",
    cor: "#003399",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "port-1",
        nome: "Compreensão e interpretação de textos",
        subtopicos: [
          { id: "port-1-1", nome: "Gêneros textuais" },
          { id: "port-1-2", nome: "Coerência e coesão" },
          { id: "port-1-3", nome: "Tipologia textual" },
        ],
      },
      {
        id: "port-2",
        nome: "Gramática",
        subtopicos: [
          { id: "port-2-1", nome: "Ortografia e acentuação" },
          { id: "port-2-2", nome: "Concordância verbal e nominal" },
          { id: "port-2-3", nome: "Regência" },
          { id: "port-2-4", nome: "Pontuação" },
        ],
      },
    ],
  },
  {
    id: "ingles",
    nome: "Língua Inglesa",
    cor: "#0055B7",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "ing-1",
        nome: "Reading comprehension",
        subtopicos: [
          { id: "ing-1-1", nome: "Main idea and details" },
          { id: "ing-1-2", nome: "Vocabulary in context" },
          { id: "ing-1-3", nome: "Inference" },
        ],
      },
      {
        id: "ing-2",
        nome: "Grammar",
        subtopicos: [
          { id: "ing-2-1", nome: "Tenses" },
          { id: "ing-2-2", nome: "Modal verbs" },
        ],
      },
    ],
  },
  {
    id: "matematica",
    nome: "Matemática",
    cor: "#1E7B3E",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "mat-1",
        nome: "Aritmética e Razão/Proporção",
        subtopicos: [
          { id: "mat-1-1", nome: "Porcentagem" },
          { id: "mat-1-2", nome: "Regra de três" },
          { id: "mat-1-3", nome: "Juros simples e compostos" },
        ],
      },
      {
        id: "mat-2",
        nome: "Álgebra",
        subtopicos: [
          { id: "mat-2-1", nome: "Equações e sistemas" },
          { id: "mat-2-2", nome: "Funções" },
        ],
      },
    ],
  },
  {
    id: "estatistica",
    nome: "Probabilidade e Estatística",
    cor: "#7B3EA8",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "est-1",
        nome: "Estatística descritiva",
        subtopicos: [
          { id: "est-1-1", nome: "Medidas de tendência central" },
          { id: "est-1-2", nome: "Medidas de dispersão" },
        ],
      },
      {
        id: "est-2",
        nome: "Probabilidade",
        subtopicos: [
          { id: "est-2-1", nome: "Probabilidade condicional" },
          { id: "est-2-2", nome: "Distribuições" },
        ],
      },
    ],
  },
  {
    id: "bancarios",
    nome: "Conhecimentos Bancários",
    cor: "#B78E00",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "bnc-1",
        nome: "Sistema Financeiro Nacional",
        subtopicos: [
          { id: "bnc-1-1", nome: "Estrutura do SFN" },
          { id: "bnc-1-2", nome: "CMN, Bacen, CVM" },
        ],
      },
      {
        id: "bnc-2",
        nome: "Produtos e serviços bancários",
        subtopicos: [
          { id: "bnc-2-1", nome: "Cartões, crédito e investimentos" },
          { id: "bnc-2-2", nome: "Pix e Open Finance" },
        ],
      },
    ],
  },
  {
    id: "ti",
    nome: "Tecnologia da Informação",
    cor: "#B01F1F",
    concursoId: "bb-ti-2026",
    topicos: [
      {
        id: "ti-1",
        nome: "Desenvolvimento de Sistemas",
        subtopicos: [
          { id: "ti-1-1", nome: "Paradigmas de programação" },
          { id: "ti-1-2", nome: "APIs REST e microserviços" },
          { id: "ti-1-3", nome: "Testes automatizados" },
        ],
      },
      {
        id: "ti-2",
        nome: "Segurança da Informação",
        subtopicos: [
          { id: "ti-2-1", nome: "Criptografia" },
          { id: "ti-2-2", nome: "OWASP Top 10" },
          { id: "ti-2-3", nome: "LGPD" },
        ],
      },
      {
        id: "ti-3",
        nome: "Banco de Dados",
        subtopicos: [
          { id: "ti-3-1", nome: "Modelagem relacional" },
          { id: "ti-3-2", nome: "SQL avançado" },
          { id: "ti-3-3", nome: "NoSQL" },
        ],
      },
      {
        id: "ti-4",
        nome: "Redes",
        subtopicos: [
          { id: "ti-4-1", nome: "Modelo OSI e TCP/IP" },
          { id: "ti-4-2", nome: "Protocolos de aplicação" },
        ],
      },
      {
        id: "ti-5",
        nome: "DevOps",
        subtopicos: [
          { id: "ti-5-1", nome: "CI/CD" },
          { id: "ti-5-2", nome: "Containers e Kubernetes" },
        ],
      },
      {
        id: "ti-6",
        nome: "IA e Analytics",
        subtopicos: [
          { id: "ti-6-1", nome: "Machine Learning básico" },
          { id: "ti-6-2", nome: "Data pipelines" },
        ],
      },
    ],
  },
];
