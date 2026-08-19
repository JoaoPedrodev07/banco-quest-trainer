/**
 * Ritmo de prova.
 *
 * Gestão de tempo reprova gente que sabe a matéria. A prova do BB tem 70
 * questões em 4 horas — cerca de 3 min e 26 s por questão, contando o tempo do
 * cartão-resposta e da redação. O app media o tempo total do simulado, mas nunca
 * o de cada questão, que é onde o problema aparece: a pessoa gasta 12 minutos
 * numa questão difícil e descobre no fim que faltou tempo para cinco fáceis.
 *
 * O alvo é referência, não meta rígida: questão de interpretação de texto é
 * naturalmente mais lenta que uma de decoreba, e cobrar o mesmo de todas seria
 * inventar uma regra que a prova não tem.
 */

/** 4 horas para 70 questões, arredondado para baixo. */
export const RITMO_ALVO_SEGUNDOS = Math.floor((4 * 60 * 60) / 70);

export type Ritmo = "rapido" | "no-alvo" | "lento";

export function avaliarRitmo(segundos: number): Ritmo {
  if (segundos <= RITMO_ALVO_SEGUNDOS * 0.6) return "rapido";
  // A folga de 40% acima do alvo existe porque alternar entre questões custa
  // tempo que não é "gasto pensando"; punir a partir do segundo 207 exato
  // marcaria quase tudo como lento e o sinal perderia valor.
  if (segundos <= RITMO_ALVO_SEGUNDOS * 1.4) return "no-alvo";
  return "lento";
}

export function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}min ${String(s % 60).padStart(2, "0")}s` : `${s}s`;
}

/** Resumo do ritmo de um simulado inteiro. */
export function resumoDeRitmo(tempos: number[]): {
  total: number;
  media: number;
  acimaDoAlvo: number;
  mensagem: string;
} {
  if (tempos.length === 0) {
    return { total: 0, media: 0, acimaDoAlvo: 0, mensagem: "" };
  }
  const total = tempos.reduce((a, t) => a + t, 0);
  const media = Math.round(total / tempos.length);
  const acimaDoAlvo = tempos.filter((t) => t > RITMO_ALVO_SEGUNDOS).length;

  const mensagem =
    media <= RITMO_ALVO_SEGUNDOS
      ? `Média de ${formatarDuracao(media)} por questão — dentro do ritmo de ${formatarDuracao(RITMO_ALVO_SEGUNDOS)} que a prova exige.`
      : `Média de ${formatarDuracao(media)} por questão, acima do ritmo de ${formatarDuracao(RITMO_ALVO_SEGUNDOS)}. Nesse passo, ${Math.round((media / RITMO_ALVO_SEGUNDOS - 1) * 100)}% das questões ficariam sem resposta.`;

  return { total, media, acimaDoAlvo, mensagem };
}

/**
 * Duração real da prova, em segundos.
 *
 * O BB dá 4h para 70 questões. Simular sem relógio total treina o conteúdo mas
 * não a prova: o que reprova quem sabe a matéria é chegar na questão 55 com
 * 20 minutos restantes.
 *
 * Escala pelo número de questões do caderno, para uma prova de 60 não herdar o
 * tempo de uma de 70.
 */
export function duracaoDaProva(qtdQuestoes: number): number {
  return qtdQuestoes * RITMO_ALVO_SEGUNDOS;
}

/**
 * Tempo líquido de uma sessão de simulado, em segundos (ADR-019).
 *
 * Desconta as pausas: o acumulado (`segundosPausados`) e, se a sessão está
 * pausada AGORA (`pausadoEm` não nulo), o trecho da pausa corrente. Guardar
 * instantes e derivar na leitura é o mesmo padrão do Pomodoro (§2.3) — o
 * relógio congela durante a pausa sem nenhum timer rodando.
 */
export function tempoLiquidoSegundos(
  iniciadoEm: string,
  segundosPausados: number,
  pausadoEm: string | null,
  agora: number,
): number {
  const bruto = (agora - new Date(iniciadoEm).getTime()) / 1000;
  const pausaCorrente = pausadoEm ? (agora - new Date(pausadoEm).getTime()) / 1000 : 0;
  return Math.max(0, Math.floor(bruto - segundosPausados - pausaCorrente));
}

/** hh:mm:ss para o relógio da prova; minutos não bastam em 4 horas. */
export function formatarRelogio(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
