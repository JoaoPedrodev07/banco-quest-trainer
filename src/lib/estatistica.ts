/**
 * Estatística de estudo.
 *
 * Todas as funções aqui são puras e testadas, porque erro em estatística não
 * aparece: produz um número plausível e errado, e o candidato reorganiza semanas
 * de estudo em cima dele.
 *
 * A regra que atravessa o módulo: **onde a amostra não sustenta uma afirmação, a
 * função devolve a incerteza junto**, em vez de um número seco. É por isso que
 * incidência vira intervalo e nota vira distribuição.
 */

// ---------------------------------------------------------------- utilidades

/** z para 90% e 95% — os dois únicos níveis usados; evita tabela inteira. */
const Z = { 90: 1.6449, 95: 1.96 } as const;

/**
 * Intervalo de confiança de Wilson para uma proporção.
 *
 * Wilson, e não o intervalo normal (Wald), porque Wald quebra exatamente onde
 * este app opera: amostra pequena e proporção perto de 0. Com 2 acertos em 35,
 * Wald devolve limite inferior negativo — "entre -1% e 12% das questões", que é
 * absurdo e destrói a confiança no número inteiro.
 */
export function intervaloWilson(
  sucessos: number,
  total: number,
  confianca: 90 | 95 = 90,
): { min: number; max: number } {
  if (total <= 0) return { min: 0, max: 0 };
  const z = Z[confianca];
  const p = sucessos / total;
  const denominador = 1 + (z * z) / total;
  const centro = p + (z * z) / (2 * total);
  const margem = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  return {
    min: Math.max(0, (centro - margem) / denominador),
    max: Math.min(1, (centro + margem) / denominador),
  };
}

// ------------------------------------------------- 1. incidência com margem

export interface FaixaDeIncidencia {
  /** Quantas questões deste assunto caíram nas provas analisadas. */
  observadas: number;
  /** Quantas questões a disciplina tem no acervo. */
  base: number;
  /** Extremos plausíveis para a próxima prova, em número de questões. */
  minEsperado: number;
  maxEsperado: number;
  /** Se o intervalo é largo demais para orientar decisão. */
  incerto: boolean;
}

/**
 * Quantas questões deste assunto esperar numa prova futura.
 *
 * Converte a proporção observada num intervalo e o projeta sobre o tamanho da
 * prova. "8 questões (25%)" vira "entre 4 e 13 na próxima" — que é o que se pode
 * honestamente dizer com duas aplicações de prova.
 */
export function faixaDeIncidencia(
  observadas: number,
  base: number,
  questoesNaProva: number,
): FaixaDeIncidencia {
  const { min, max } = intervaloWilson(observadas, base);
  const minEsperado = Math.floor(min * questoesNaProva);
  const maxEsperado = Math.ceil(max * questoesNaProva);
  return {
    observadas,
    base,
    minEsperado,
    maxEsperado,
    // Intervalo que cobre mais que o dobro do piso não orienta decisão nenhuma.
    incerto: maxEsperado > 0 && maxEsperado - minEsperado > Math.max(2, minEsperado),
  };
}

// ------------------------------------------------- 2. curva de cobertura

export interface PontoDeCobertura {
  topicoId: string;
  nome: string;
  questoes: number;
  /** Fatia acumulada da prova coberta até aqui, em pontos percentuais. */
  coberturaAcumulada: number;
  /** Quanto ESTE tópico acrescentou. É o que revela o retorno decrescente. */
  ganhoMarginal: number;
}

/**
 * Ordena os assuntos por incidência e mostra quanto da prova cada um acrescenta.
 *
 * Responde a decisão mais cara do concurseiro: **onde parar de estudar**. Os
 * primeiros tópicos rendem muito, e a partir de certo ponto cada novo assunto
 * compra 1% de prova ao custo de horas.
 */
export function curvaDeCobertura(
  topicos: { topicoId: string; nome: string; questoes: number }[],
): PontoDeCobertura[] {
  const total = topicos.reduce((a, t) => a + t.questoes, 0);
  if (total === 0) return [];

  let acumulado = 0;
  return [...topicos]
    .sort((a, b) => b.questoes - a.questoes)
    .map((t) => {
      const ganho = (t.questoes / total) * 100;
      acumulado += ganho;
      return {
        topicoId: t.topicoId,
        nome: t.nome,
        questoes: t.questoes,
        coberturaAcumulada: Math.round(acumulado),
        ganhoMarginal: Math.round(ganho * 10) / 10,
      };
    });
}

/** Quantos assuntos bastam para cobrir `alvo`% da prova. */
export function assuntosPara(curva: PontoDeCobertura[], alvo: number): number {
  const indice = curva.findIndex((p) => p.coberturaAcumulada >= alvo);
  return indice === -1 ? curva.length : indice + 1;
}

// ------------------------------------------------- 3. simulação de nota

export interface CenarioDeNota {
  /** Nota mediana das simulações. */
  mediana: number;
  /** Faixa central: 70% das simulações caem entre estes dois valores. */
  p15: number;
  p85: number;
  simulacoes: number;
}

/**
 * Distribuição da nota por simulação (Monte Carlo).
 *
 * Devolve faixa, não número único, porque o número único esconde a incerteza —
 * e é justamente a incerteza que decide se dá para relaxar ou não.
 *
 * `aleatorio` é injetável para o teste ser determinístico; em produção é
 * `Math.random`.
 */
export function simularNota(
  disciplinas: { questoesNaProva: number; taxaAcerto: number; valorPorQuestao?: number }[],
  opcoes: { simulacoes?: number; descontaErro?: boolean; aleatorio?: () => number } = {},
): CenarioDeNota {
  const { simulacoes = 2000, descontaErro = false, aleatorio = Math.random } = opcoes;
  const notas: number[] = [];

  for (let i = 0; i < simulacoes; i++) {
    let nota = 0;
    for (const d of disciplinas) {
      // O peso importa: no BB, questão de Inglês vale 1,0 e a de TI vale 1,5.
      // Contar questão em vez de ponto dá um número na escala errada — e foi
      // exatamente o que a tela chegou a mostrar: "entre 157 e 171" numa prova
      // que vale 100. Padrão 1 mantém a função utilizável em prova sem peso.
      const valor = d.valorPorQuestao ?? 1;
      for (let q = 0; q < d.questoesNaProva; q++) {
        if (aleatorio() < d.taxaAcerto) nota += valor;
        else if (descontaErro) nota -= valor;
      }
    }
    notas.push(Math.round(nota * 10) / 10);
  }

  notas.sort((a, b) => a - b);
  const em = (p: number) => notas[Math.min(notas.length - 1, Math.floor(p * notas.length))];
  return { mediana: em(0.5), p15: em(0.15), p85: em(0.85), simulacoes };
}

// ------------------------------------------------- 4. ponto fraco com teste

/**
 * O desempenho neste assunto é pior que a sua média, ou é azar?
 *
 * Compara a taxa do assunto com a taxa geral usando o intervalo de Wilson: só
 * chama de fraqueza quando o teto plausível do assunto ainda fica **abaixo** da
 * média geral. Sem isso, o app manda estudar assunto onde a pessoa só teve azar
 * em três questões — e o custo é o tempo dela.
 */
export function ehFraquezaReal(
  acertosNoTopico: number,
  respondidasNoTopico: number,
  taxaGeral: number,
): boolean {
  if (respondidasNoTopico < 3) return false;
  const { max } = intervaloWilson(acertosNoTopico, respondidasNoTopico);
  return max < taxaGeral;
}

// ------------------------------------------------- 5. tempo × acerto

export type PerfilDeRitmo = "correndo" | "equilibrado" | "travando";

export interface DiagnosticoDeRitmo {
  disciplinaId: string;
  tempoMedio: number;
  taxaAcerto: number;
  perfil: PerfilDeRitmo;
  mensagem: string;
}

/**
 * Cruza tempo gasto com acerto, por disciplina.
 *
 * O par que interessa não é "rápido" nem "lento" isolado, e sim a combinação:
 * rápido + errando é pressa; lento + acertando é dinheiro deixado na mesa. Um
 * número sozinho não distingue os dois.
 */
export function diagnosticarRitmo(
  amostras: { disciplinaId: string; segundos: number; correta: boolean }[],
  ritmoAlvo: number,
  minimo = 5,
): DiagnosticoDeRitmo[] {
  const porDisciplina = new Map<string, { tempo: number; acertos: number; n: number }>();
  for (const a of amostras) {
    const atual = porDisciplina.get(a.disciplinaId) ?? { tempo: 0, acertos: 0, n: 0 };
    atual.tempo += a.segundos;
    atual.acertos += a.correta ? 1 : 0;
    atual.n += 1;
    porDisciplina.set(a.disciplinaId, atual);
  }

  const saida: DiagnosticoDeRitmo[] = [];
  for (const [disciplinaId, d] of porDisciplina) {
    if (d.n < minimo) continue;
    const tempoMedio = Math.round(d.tempo / d.n);
    const taxaAcerto = d.acertos / d.n;
    const rapido = tempoMedio < ritmoAlvo * 0.6;
    const lento = tempoMedio > ritmoAlvo * 1.4;

    let perfil: PerfilDeRitmo = "equilibrado";
    let mensagem = "Ritmo e acerto compatíveis.";
    if (rapido && taxaAcerto < 0.6) {
      perfil = "correndo";
      mensagem = "Você responde rápido e erra muito aqui — está decidindo antes de ler.";
    } else if (lento && taxaAcerto >= 0.7) {
      perfil = "travando";
      mensagem = "Você acerta, mas gasta tempo demais — é onde dá para ganhar minutos na prova.";
    } else if (lento && taxaAcerto < 0.6) {
      perfil = "travando";
      mensagem = "Demora e erra: o assunto ainda não está firme, não é questão de ritmo.";
    }
    saida.push({ disciplinaId, tempoMedio, taxaAcerto, perfil, mensagem });
  }
  return saida.sort((a, b) => a.taxaAcerto - b.taxaAcerto);
}

// ------------------------------------------------- 6. anatomia do erro

export interface AnatomiaDoErro {
  disciplinaId: string;
  erros: number;
  /**
   * Errou com raciocínio escrito que não era chute: conceito aprendido errado.
   * É o pior tipo de erro (a pessoa tem certeza do que está errado) e pede
   * TEORIA, não mais questões.
   */
  conviccaoErrada: number;
  /** Errou chutando (declarou chute, ou nem escreveu raciocínio): lacuna de conteúdo. Pede cobertura. */
  chuteErrado: number;
}

/**
 * De que tipo são os seus erros, por disciplina (ADR-011).
 *
 * O que interessa não é quanto se erra — a taxa já diz — e sim COMO: convicção
 * errada e chute pedem estudos opostos. Só é possível porque o app grava o
 * raciocínio antes do gabarito; % de acerto sozinho não separa os dois.
 *
 * NÃO fazemos análise por distrator (qual alternativa errada atrai): corpus de
 * um usuário só não tem repetição por questão para sustentar isso — seria o
 * número bonito e falso que o §8 do CLAUDE.md proíbe.
 */
export function anatomiaDoErro(
  respostas: {
    disciplinaId: string;
    correta: boolean;
    raciocinio?: string;
    autoavaliacao?: "bateu" | "torto" | "chutei";
  }[],
  minimo = 10,
): AnatomiaDoErro[] {
  const porDisciplina = new Map<string, { erros: number; conviccao: number; chute: number }>();
  for (const r of respostas) {
    if (r.correta) continue;
    const atual = porDisciplina.get(r.disciplinaId) ?? { erros: 0, conviccao: 0, chute: 0 };
    atual.erros += 1;
    // A declaração da própria pessoa manda: raciocínio escrito mas avaliado
    // como "chutei" é chute — ela sabe melhor que a heurística.
    if (r.raciocinio && r.autoavaliacao !== "chutei") atual.conviccao += 1;
    else atual.chute += 1;
    porDisciplina.set(r.disciplinaId, atual);
  }

  return [...porDisciplina.entries()]
    .filter(([, d]) => d.erros >= minimo)
    .map(([disciplinaId, d]) => ({
      disciplinaId,
      erros: d.erros,
      conviccaoErrada: d.conviccao,
      chuteErrado: d.chute,
    }))
    .sort((a, b) => b.erros - a.erros);
}

// ------------------------------------------------- 7. evolução por janelas

export interface JanelaDeTaxa {
  respondidas: number;
  acertos: number;
  /** Intervalo de Wilson da taxa, em proporção 0–1. */
  min: number;
  max: number;
}

export interface EvolucaoDisciplina {
  disciplinaId: string;
  /** Últimos `janelaDias` dias. Nulo = amostra abaixo do mínimo (sem dados, não "zero"). */
  recente: JanelaDeTaxa | null;
  /** A janela imediatamente anterior. */
  anterior: JanelaDeTaxa | null;
  /**
   * Só afirma tendência quando os intervalos NÃO se sobrepõem: sobreposição é
   * "sem mudança detectável", não "melhorou 3%".
   */
  tendencia: "melhorou" | "piorou" | "indefinida";
}

/**
 * Sua taxa por disciplina agora × há um mês (ADR-011).
 *
 * Compara janelas com intervalo de Wilson em vez de subtrair percentuais: com
 * 12 respostas por janela, "68% → 71%" é ruído, e a seta para cima mentiria.
 */
export function evolucaoPorJanelas(
  respostas: { disciplinaId: string; correta: boolean; data: string }[],
  agora: Date,
  janelaDias = 30,
  minimo = 10,
): EvolucaoDisciplina[] {
  const corte1 = agora.getTime() - janelaDias * 86_400_000;
  const corte2 = agora.getTime() - 2 * janelaDias * 86_400_000;

  const porDisciplina = new Map<string, { recente: boolean[]; anterior: boolean[] }>();
  for (const r of respostas) {
    const t = new Date(r.data).getTime();
    if (t < corte2 || t > agora.getTime()) continue;
    const atual = porDisciplina.get(r.disciplinaId) ?? { recente: [], anterior: [] };
    (t >= corte1 ? atual.recente : atual.anterior).push(r.correta);
    porDisciplina.set(r.disciplinaId, atual);
  }

  const janela = (acertos: boolean[]): JanelaDeTaxa | null => {
    if (acertos.length < minimo) return null;
    const certas = acertos.filter(Boolean).length;
    const { min, max } = intervaloWilson(certas, acertos.length);
    return { respondidas: acertos.length, acertos: certas, min, max };
  };

  return [...porDisciplina.entries()]
    .map(([disciplinaId, d]) => {
      const recente = janela(d.recente);
      const anterior = janela(d.anterior);
      let tendencia: EvolucaoDisciplina["tendencia"] = "indefinida";
      if (recente && anterior) {
        if (recente.min > anterior.max) tendencia = "melhorou";
        else if (recente.max < anterior.min) tendencia = "piorou";
      }
      return { disciplinaId, recente, anterior, tendencia };
    })
    .filter((e) => e.recente || e.anterior);
}

// ------------------------------------------------- 8. chute racional

export interface DecisaoDeChute {
  /** Confiança mínima para responder valer a pena. */
  limiar: number;
  vantajoso: (confianca: number) => boolean;
  explicacao: string;
}

/**
 * Quando chutar compensa numa prova que desconta erro.
 *
 * Na Cebraspe cada erro anula um acerto: o valor esperado de responder é
 * `p − (1 − p)`, positivo só acima de 50%. Sem desconto, responder nunca é pior
 * que deixar em branco, e o limiar é zero.
 *
 * O número em si é simples; o que ele evita não é. Sem essa conta, o candidato
 * responde tudo por hábito e perde pontos que já tinha.
 */
export function decisaoDeChute(descontaErro: boolean, alternativas = 5): DecisaoDeChute {
  if (!descontaErro) {
    return {
      limiar: 0,
      vantajoso: () => true,
      explicacao:
        "Esta prova não desconta erro: responder em branco nunca compensa. Marque sempre, mesmo sem ideia.",
    };
  }
  const acasoPuro = 1 / alternativas;
  return {
    limiar: 0.5,
    vantajoso: (confianca) => confianca > 0.5,
    explicacao:
      `Esta prova desconta: cada erro anula um acerto. Responder só compensa acima de 50% de ` +
      `certeza — no chute cego a chance é ${Math.round(acasoPuro * 100)}%, e o valor esperado é negativo.`,
  };
}
