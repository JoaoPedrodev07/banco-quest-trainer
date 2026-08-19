import { describe, expect, it } from "vitest";

import { montarTrilha } from "./trilha";

const AGORA = new Date("2026-08-19T12:00:00.000Z");

const base = { agora: AGORA, unidadesTotais: 100, unidadesCobertas: 20, unidadesTreinadas: 5 };

describe("montarTrilha", () => {
  it("longe da prova e com edital descoberto: fase de cobertura, com ritmo", () => {
    // 2026-10-25 está a 67 dias de 19/08 → 37 dias de cobertura para 80 unidades.
    const t = montarTrilha({ ...base, dataProva: "2026-10-25T12:00:00.000Z" });
    expect(t.faseAtual).toBe("cobertura");
    expect(t.diasRestantes).toBe(67);
    expect(t.ritmoNecessario).toBeCloseTo(80 / 37, 1);
  });

  it("a 30 dias ou menos da prova, muda para questões mesmo com cobertura pendente", () => {
    const t = montarTrilha({ ...base, dataProva: "2026-09-15T12:00:00.000Z" }); // 27 dias
    expect(t.faseAtual).toBe("questoes");
    expect(t.ritmoNecessario).toBeNull();
  });

  it("cobertura completa antecipa a fase de questões, longe da prova", () => {
    const t = montarTrilha({
      ...base,
      unidadesCobertas: 100,
      dataProva: "2026-12-01T12:00:00.000Z",
    });
    expect(t.faseAtual).toBe("questoes");
  });

  it("os últimos 10 dias são reta final, sempre", () => {
    const t = montarTrilha({ ...base, dataProva: "2026-08-27T12:00:00.000Z" }); // 8 dias
    expect(t.faseAtual).toBe("reta_final");
  });

  it("prova já passada não conta dias negativos", () => {
    const t = montarTrilha({ ...base, dataProva: "2026-08-01T12:00:00.000Z" });
    expect(t.diasRestantes).toBe(0);
    expect(t.faseAtual).toBe("reta_final");
  });

  it("sem data: não inventa cronograma — fase pela cobertura, sem dias nem ritmo", () => {
    const pouca = montarTrilha({ ...base, dataProva: null });
    expect(pouca.faseAtual).toBe("cobertura");
    expect(pouca.diasRestantes).toBeNull();
    expect(pouca.ritmoNecessario).toBeNull();

    const bastante = montarTrilha({ ...base, unidadesCobertas: 75, dataProva: null });
    expect(bastante.faseAtual).toBe("questoes");
  });

  it("edital vazio não divide por zero", () => {
    const t = montarTrilha({
      agora: AGORA,
      dataProva: null,
      unidadesTotais: 0,
      unidadesCobertas: 0,
      unidadesTreinadas: 0,
    });
    expect(t.faseAtual).toBe("cobertura");
  });
});
