import { describe, expect, it } from "vitest";

import { avancarStreak } from "./streak";

const AGORA = new Date("2026-08-19T15:30:00.000Z");

describe("avancarStreak", () => {
  it("primeira resposta da vida começa o streak em 1", () => {
    expect(avancarStreak({ ultimoDia: null, dias: 0 }, AGORA)).toEqual({
      ultimoDia: "2026-08-19",
      dias: 1,
    });
  });

  it("responder de novo no mesmo dia não incrementa — o dia conta uma vez", () => {
    const streak = { ultimoDia: "2026-08-19", dias: 4 };
    expect(avancarStreak(streak, AGORA)).toEqual(streak);
  });

  it("mesmo dia com hora diferente ainda é o mesmo dia (comparação por slice, §2.5)", () => {
    const madrugada = new Date("2026-08-19T00:05:00.000Z");
    const streak = { ultimoDia: "2026-08-19", dias: 2 };
    expect(avancarStreak(streak, madrugada).dias).toBe(2);
  });

  it("dia seguinte incrementa a sequência", () => {
    expect(avancarStreak({ ultimoDia: "2026-08-18", dias: 4 }, AGORA)).toEqual({
      ultimoDia: "2026-08-19",
      dias: 5,
    });
  });

  it("um dia pulado recomeça do 1 — streak com buraco não é streak", () => {
    expect(avancarStreak({ ultimoDia: "2026-08-17", dias: 30 }, AGORA)).toEqual({
      ultimoDia: "2026-08-19",
      dias: 1,
    });
  });

  it("virada de mês conta como dia seguinte normal", () => {
    const primeiroDeSetembro = new Date("2026-09-01T10:00:00.000Z");
    expect(avancarStreak({ ultimoDia: "2026-08-31", dias: 7 }, primeiroDeSetembro).dias).toBe(8);
  });
});
