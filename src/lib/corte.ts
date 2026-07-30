/**
 * Nota de corte e eliminação, pelas regras do edital.
 *
 * Este módulo existe porque a conversa sobre "nota de corte" costuma começar no
 * lugar errado. O que reprova em concurso de banco não é a nota de corte
 * competitiva — é o **piso de eliminação**, que é fixo, está no edital e não
 * depende de quantas pessoas se inscreveram. Quem passa do piso já está numa
 * disputa muito menos apertada do que imagina.
 *
 * Todos os números aqui vêm do Edital BB 2023 (Cesgranrio), subitens 7.1.2 e
 * 7.1.4, e do Anexo II. O edital de 2026 ainda não saiu; quando sair, é aqui que
 * se mexe. Os pesos por disciplina NÃO são chutes: estão literalmente no edital.
 */

/** Bloco da prova. O edital elimina por bloco, não só pelo total. */
export type Bloco = "basicos" | "especificos";

export interface PesoDisciplina {
  disciplinaId: string;
  nome: string;
  bloco: Bloco;
  questoes: number;
  /** Valor de CADA questão, em pontos. */
  valorPorQuestao: number;
}

/**
 * Composição da prova objetiva: 70 questões, 100 pontos (edital 7.1.2).
 *
 * O detalhe que muda estratégia de estudo: a questão NÃO vale todas o mesmo.
 * Inglês vale 1,0 e TI vale 1,5 — um acerto de TI vale meio ponto a mais que um
 * de inglês, e TI sozinha é 52,5% da prova.
 */
export const COMPOSICAO_PROVA: PesoDisciplina[] = [
  {
    disciplinaId: "portugues",
    nome: "Língua Portuguesa",
    bloco: "basicos",
    questoes: 10,
    valorPorQuestao: 1.5,
  },
  {
    disciplinaId: "ingles",
    nome: "Língua Inglesa",
    bloco: "basicos",
    questoes: 5,
    valorPorQuestao: 1.0,
  },
  {
    disciplinaId: "matematica",
    nome: "Matemática",
    bloco: "basicos",
    questoes: 5,
    valorPorQuestao: 1.5,
  },
  {
    disciplinaId: "atualidades",
    nome: "Atualidades do Mercado Financeiro",
    bloco: "basicos",
    questoes: 5,
    valorPorQuestao: 1.0,
  },
  {
    disciplinaId: "estatistica",
    nome: "Probabilidade e Estatística",
    bloco: "especificos",
    questoes: 5,
    valorPorQuestao: 1.5,
  },
  {
    disciplinaId: "bancarios",
    nome: "Conhecimentos Bancários",
    bloco: "especificos",
    questoes: 5,
    valorPorQuestao: 1.5,
  },
  {
    disciplinaId: "ti",
    nome: "Tecnologia da Informação",
    bloco: "especificos",
    questoes: 35,
    valorPorQuestao: 1.5,
  },
];

export const TOTAL_BASICOS = 32.5;
export const TOTAL_ESPECIFICOS = 67.5;
export const TOTAL_PROVA = 100;

/**
 * Vagas da Microrregião 158 — TI, a única do cargo Agente de Tecnologia
 * (edital 1.3.1 e Anexo II). Todo o resto do Anexo II é Agente Comercial: usar
 * aqueles números para TI seria comparar com outro concurso.
 */
export const QUADRO_MR158 = {
  microrregiao: "158 — TI",
  vagas: { ampla: 1500, pcd: 100, negros: 400, total: 2000 },
  cadastroReserva: { ampla: 750, pcd: 50, negros: 200, total: 1000 },
} as const;

/**
 * Quantas posições são habilitadas para a redação (edital 7.1.6): o triplo do
 * somatório de vagas + cadastro de reserva. Quem passa disso é eliminado, mesmo
 * tendo passado do piso.
 */
export const LIMITE_HABILITACAO =
  3 * (QUADRO_MR158.vagas.total + QUADRO_MR158.cadastroReserva.total);

export interface MotivoDeEliminacao {
  regra: string;
  detalhe: string;
}

export interface ResultadoDeCorte {
  pontos: number;
  pontosBasicos: number;
  pontosEspecificos: number;
  eliminado: boolean;
  motivos: MotivoDeEliminacao[];
  /** Folga (ou falta) até o piso de 50 pontos. Negativo = abaixo do piso. */
  folgaTotal: number;
}

/**
 * Aplica os quatro filtros de eliminação do subitem 7.1.4.
 *
 * São quatro, e não um — é aqui que candidato bom é reprovado sem entender por
 * quê. Dá para tirar 62 no total e ser eliminado por ter ido mal só nos
 * Básicos; e dá para ser eliminado por zerar Inglês, que vale 5 pontos numa
 * prova de 100. O quarto filtro é o mais cruel porque é o mais fácil de ignorar:
 * "inglês vale pouco" é verdade para a nota e falso para a eliminação.
 *
 * `acertosPorDisciplina` usa os ids de `COMPOSICAO_PROVA`; disciplina ausente
 * conta como zero acerto, o que dispara o filtro de nota zero de propósito.
 */
export function avaliarCorte(acertosPorDisciplina: Record<string, number>): ResultadoDeCorte {
  let pontosBasicos = 0;
  let pontosEspecificos = 0;
  const zeradas: string[] = [];

  for (const d of COMPOSICAO_PROVA) {
    const acertos = Math.min(d.questoes, Math.max(0, acertosPorDisciplina[d.disciplinaId] ?? 0));
    const pontos = acertos * d.valorPorQuestao;
    if (acertos === 0) zeradas.push(d.nome);
    if (d.bloco === "basicos") pontosBasicos += pontos;
    else pontosEspecificos += pontos;
  }

  const pontos = Math.round((pontosBasicos + pontosEspecificos) * 100) / 100;
  const motivos: MotivoDeEliminacao[] = [];

  if (pontos < TOTAL_PROVA * 0.5) {
    motivos.push({
      regra: "50% do total",
      detalhe: `${pontos.toFixed(1)} de ${TOTAL_PROVA} pontos — o edital exige no mínimo ${TOTAL_PROVA * 0.5}.`,
    });
  }
  if (pontosBasicos < TOTAL_BASICOS * 0.5) {
    motivos.push({
      regra: "50% de Conhecimentos Básicos",
      detalhe: `${pontosBasicos.toFixed(1)} de ${TOTAL_BASICOS} pontos — o mínimo é ${TOTAL_BASICOS * 0.5}.`,
    });
  }
  if (pontosEspecificos < TOTAL_ESPECIFICOS * 0.5) {
    motivos.push({
      regra: "50% de Conhecimentos Específicos",
      detalhe: `${pontosEspecificos.toFixed(1)} de ${TOTAL_ESPECIFICOS} pontos — o mínimo é ${TOTAL_ESPECIFICOS * 0.5}.`,
    });
  }
  if (zeradas.length > 0) {
    motivos.push({
      regra: "nota zero em disciplina",
      detalhe: `Zerou ${zeradas.join(", ")}. Uma única disciplina zerada elimina, por menos que ela valha.`,
    });
  }

  return {
    pontos,
    pontosBasicos: Math.round(pontosBasicos * 100) / 100,
    pontosEspecificos: Math.round(pontosEspecificos * 100) / 100,
    eliminado: motivos.length > 0,
    motivos,
    folgaTotal: Math.round((pontos - TOTAL_PROVA * 0.5) * 100) / 100,
  };
}

/**
 * Projeta a nota a partir da sua taxa de acerto por disciplina.
 *
 * Aceita taxa (0–1) em vez de acertos porque é isso que o histórico do app
 * produz. Disciplina sem histórico entra como `null` e é devolvida na lista
 * `semBase`: fingir 0% para quem nunca respondeu inventa uma eliminação, e
 * fingir a média geral inventa uma aprovação.
 */
export function projetarNota(taxaPorDisciplina: Record<string, number | null>): {
  resultado: ResultadoDeCorte;
  semBase: string[];
} {
  const acertos: Record<string, number> = {};
  const semBase: string[] = [];

  for (const d of COMPOSICAO_PROVA) {
    const taxa = taxaPorDisciplina[d.disciplinaId];
    if (taxa === null || taxa === undefined) {
      semBase.push(d.nome);
      // Sem base, projeta pelo acaso puro (1 em 5): é o piso honesto de quem
      // não estudou nada, e não zero, que dispararia eliminação falsa.
      acertos[d.disciplinaId] = d.questoes * 0.2;
    } else {
      acertos[d.disciplinaId] = d.questoes * taxa;
    }
  }

  return { resultado: avaliarCorte(acertos), semBase };
}

export type ListaDeConcorrencia = "ampla" | "pcd" | "negros";

export interface ConcorrenciaNaLista {
  lista: ListaDeConcorrencia;
  rotulo: string;
  vagas: number;
  cadastroReserva: number;
  total: number;
  /** Fatia do total de posições da microrregião. */
  fatia: number;
}

/**
 * Quantas posições cada lista tem na MR 158.
 *
 * Serve para uma pergunta só: as listas reservadas mudam o corte? Elas mudam a
 * **ordem de chamada**, não o piso — o subitem 4.1.3 diz explicitamente que as
 * notas mínimas são as mesmas para todo mundo. E declarar-se não é escolher uma
 * frente em vez de outra: quem declara concorre nas duas listas ao mesmo tempo.
 */
export function concorrenciaPorLista(): ConcorrenciaNaLista[] {
  const { vagas, cadastroReserva } = QUADRO_MR158;
  const geral = vagas.total + cadastroReserva.total;
  const linhas: { lista: ListaDeConcorrencia; rotulo: string }[] = [
    { lista: "ampla", rotulo: "Ampla concorrência" },
    { lista: "pcd", rotulo: "Pessoa com deficiência" },
    { lista: "negros", rotulo: "Pessoa negra" },
  ];

  return linhas.map(({ lista, rotulo }) => {
    const total = vagas[lista] + cadastroReserva[lista];
    return {
      lista,
      rotulo,
      vagas: vagas[lista],
      cadastroReserva: cadastroReserva[lista],
      total,
      fatia: Math.round((total / geral) * 1000) / 10,
    };
  });
}
