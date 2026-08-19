/**
 * Contagem de streak — a última regra de data sem teste do §7.1.
 *
 * Função pura, fora do store, pelo mesmo motivo de `lib/revisao.ts`: regra de
 * data erra em silêncio (fuso, virada de dia, ISO com hora), e o store deve
 * guardar fato e delegar regra.
 *
 * A comparação é sempre por `slice(0, 10)` (§2.5): comparar o ISO completo
 * incluiria a hora e "hoje" nunca casaria com "hoje".
 */

export interface Streak {
  ultimoDia: string | null;
  dias: number;
}

const DIA_MS = 86_400_000;

/** Uma resposta aconteceu agora: o streak avança, se mantém ou recomeça. */
export function avancarStreak(streak: Streak, agora: Date): Streak {
  const hoje = agora.toISOString().slice(0, 10);
  // Já respondeu hoje: o dia conta uma vez só — responder 50 questões num dia
  // não vira 50 dias de constância.
  if (streak.ultimoDia === hoje) return streak;

  const ontem = new Date(agora.getTime() - DIA_MS).toISOString().slice(0, 10);
  return {
    ultimoDia: hoje,
    // Ontem foi o último dia ativo → sequência continua. Qualquer buraco
    // recomeça do 1 — streak com dia pulado não é streak.
    dias: streak.ultimoDia === ontem ? streak.dias + 1 : 1,
  };
}
