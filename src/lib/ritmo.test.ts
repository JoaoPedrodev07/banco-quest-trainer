import { describe, expect, it } from "vitest";

import { tempoLiquidoSegundos } from "./ritmo";

const INICIO = "2026-08-19T10:00:00.000Z";
const minutosDepois = (min: number) => new Date(`2026-08-19T10:00:00.000Z`).getTime() + min * 60000;

describe("tempoLiquidoSegundos", () => {
  it("sem pausa nenhuma, líquido = bruto", () => {
    expect(tempoLiquidoSegundos(INICIO, 0, null, minutosDepois(30))).toBe(30 * 60);
  });

  it("desconta o acumulado de pausas anteriores", () => {
    // 30 min de sessão com 10 min pausados = 20 min de prova.
    expect(tempoLiquidoSegundos(INICIO, 10 * 60, null, minutosDepois(30))).toBe(20 * 60);
  });

  it("pausada AGORA: o relógio congela — a pausa corrente também desconta", () => {
    const pausadoEm = new Date(minutosDepois(20)).toISOString();
    // Pausou aos 20 min; 15 min depois o líquido continua 20 min.
    expect(tempoLiquidoSegundos(INICIO, 0, pausadoEm, minutosDepois(35))).toBe(20 * 60);
  });

  it("pausa corrente e acumulado somam", () => {
    const pausadoEm = new Date(minutosDepois(25)).toISOString();
    // 5 min já pausados antes + pausada dos 25 aos 40 → líquido = 25 − 5 = 20 min.
    expect(tempoLiquidoSegundos(INICIO, 5 * 60, pausadoEm, minutosDepois(40))).toBe(20 * 60);
  });

  it("nunca devolve negativo, mesmo com dado inconsistente", () => {
    expect(tempoLiquidoSegundos(INICIO, 999_999, null, minutosDepois(5))).toBe(0);
  });
});
