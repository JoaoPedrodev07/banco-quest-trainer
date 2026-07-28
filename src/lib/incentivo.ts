/**
 * Mensagens de incentivo.
 *
 * Ficam aqui, e não espalhadas na tela, por um motivo que não é organização:
 * elogio que não corresponde ao desempenho vira ruído e some da percepção em
 * dois dias. "Você está indo muito bem!" depois de 30% de acerto ensina o
 * usuário a ignorar o app.
 *
 * Então cada mensagem é presa a um estado verificável, e a de desempenho baixo
 * não finge que está tudo bem — ela reenquadra o erro como informação, que é a
 * única coisa verdadeira que dá para dizer ali.
 */

export function incentivoPorTaxa(taxa: number, respondidas: number): string {
  if (respondidas === 0) {
    return "Nenhuma questão ainda. A primeira é a mais difícil de começar.";
  }
  // Com pouca coisa respondida, a taxa não sustenta elogio nem alarme.
  if (respondidas < 10) {
    return `${respondidas} ${respondidas === 1 ? "questão respondida" : "questões respondidas"}. Ainda é cedo para a taxa dizer algo — siga.`;
  }
  if (taxa >= 80) return "Acerto alto e consistente. Mantenha o volume e ataque os pontos fracos.";
  if (taxa >= 60)
    return "Faixa de aprovação em boa parte dos concursos. Dá para subir mirando o que erra mais.";
  if (taxa >= 40)
    return "Metade do caminho. O que separa daqui pra frente é revisar o erro, não fazer mais questão.";
  return "Cada erro aqui é um erro que não vai acontecer na prova. É para isso que serve o treino.";
}

/**
 * Mensagem da meta diária. Compara o feito com o combinado — sem transformar
 * um dia fraco em fracasso, porque desistir custa mais que um dia ruim.
 */
export function incentivoPorMeta(hoje: number, meta: number): string {
  if (hoje === 0) return `Meta de hoje: ${meta} questões. Comece por 5 — o resto vem junto.`;
  if (hoje >= meta) return `Meta batida: ${hoje} de ${meta}. O que vier agora é lucro.`;
  const faltam = meta - hoje;
  return `${hoje} de ${meta} hoje. Faltam ${faltam} — dá para fechar num pomodoro.`;
}

/** Mensagem do streak. Só celebra o que existe; não inventa constância. */
export function incentivoPorStreak(dias: number): string | null {
  if (dias <= 1) return null;
  if (dias >= 30) return `${dias} dias seguidos. Isso já é rotina, não força de vontade.`;
  if (dias >= 7) return `${dias} dias seguidos. A constância é o que faz diferença no resultado.`;
  return `${dias} dias seguidos.`;
}
