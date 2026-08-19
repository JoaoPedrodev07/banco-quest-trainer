/**
 * Trilha até a prova (ADR-009): em que fase do caminho o candidato está, e o
 * ritmo que o tempo restante exige.
 *
 * Calculada na leitura (§2.3) a partir de três números — dias até a prova,
 * cobertura do edital e unidades treinadas. Nada é gravado: mudou a data ou o
 * progresso, a trilha muda sozinha.
 *
 * Sem data de prova a trilha NÃO inventa cronograma: mostra só a fase sugerida
 * pela cobertura. Contar dias para uma data que ninguém anunciou é a mentira
 * que o dashboard já se recusou a contar.
 */

export type FaseId = "cobertura" | "questoes" | "reta_final";

/** A reta final são os últimos 10 dias: só revisão, resumos e provas completas. */
export const RETA_FINAL_DIAS = 10;
/** A fase de questões começa, no mais tardar, a 30 dias da prova. */
export const QUESTOES_DIAS = 30;
/** Sem data, a fase de questões é sugerida quando a cobertura passa disto. */
const COBERTURA_SUFICIENTE = 0.7;

export interface FaseDaTrilha {
  id: FaseId;
  nome: string;
  /** O que a fase pede — o texto que a tela mostra. */
  pede: string;
}

export const FASES: FaseDaTrilha[] = [
  {
    id: "cobertura",
    nome: "Cobertura",
    pede: "Ver a teoria de cada unidade do edital, começando pelo que mais cai.",
  },
  {
    id: "questoes",
    nome: "Questões e pontos fracos",
    pede: "Treino dirigido: questões dos assuntos que mais caem e dos que você mais erra.",
  },
  {
    id: "reta_final",
    nome: "Reta final",
    pede: "Só revisão, resumos do dia da prova e provas completas com relógio.",
  },
];

export interface Trilha {
  faseAtual: FaseId;
  /** Nulo quando não há data de prova. */
  diasRestantes: number | null;
  unidadesTotais: number;
  unidadesCobertas: number;
  unidadesTreinadas: number;
  /**
   * Unidades de teoria por dia para fechar a cobertura antes da fase de
   * questões. Nulo fora da fase de cobertura ou sem data.
   */
  ritmoNecessario: number | null;
}

const DIA_MS = 86_400_000;

export function montarTrilha(dados: {
  /** ISO da prova, ou null quando o edital não saiu. */
  dataProva: string | null;
  agora: Date;
  unidadesTotais: number;
  unidadesCobertas: number;
  unidadesTreinadas: number;
}): Trilha {
  const { dataProva, agora, unidadesTotais, unidadesCobertas, unidadesTreinadas } = dados;

  const diasRestantes = dataProva
    ? Math.max(0, Math.ceil((new Date(dataProva).getTime() - agora.getTime()) / DIA_MS))
    : null;

  const coberturaCompleta = unidadesTotais > 0 && unidadesCobertas >= unidadesTotais;

  let faseAtual: FaseId;
  if (diasRestantes === null) {
    // Sem data: a cobertura manda. 70% é o ponto em que continuar só na teoria
    // rende menos que começar a treinar o que já foi visto.
    faseAtual =
      unidadesTotais > 0 && unidadesCobertas / unidadesTotais >= COBERTURA_SUFICIENTE
        ? "questoes"
        : "cobertura";
  } else if (diasRestantes <= RETA_FINAL_DIAS) {
    faseAtual = "reta_final";
  } else if (diasRestantes <= QUESTOES_DIAS || coberturaCompleta) {
    faseAtual = "questoes";
  } else {
    faseAtual = "cobertura";
  }

  // Ritmo: quantas unidades de teoria por dia até a data em que a fase de
  // questões precisa começar. Só faz sentido na fase de cobertura, com data.
  let ritmoNecessario: number | null = null;
  if (faseAtual === "cobertura" && diasRestantes !== null) {
    const diasDeCobertura = Math.max(1, diasRestantes - QUESTOES_DIAS);
    const restantes = Math.max(0, unidadesTotais - unidadesCobertas);
    ritmoNecessario = Math.round((restantes / diasDeCobertura) * 10) / 10;
  }

  return { faseAtual, diasRestantes, unidadesTotais, unidadesCobertas, unidadesTreinadas, ritmoNecessario };
}
