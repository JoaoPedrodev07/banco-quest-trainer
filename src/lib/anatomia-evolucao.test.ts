import { describe, expect, it } from "vitest";

import { anatomiaDoErro, evolucaoPorJanelas } from "./estatistica";

describe("anatomiaDoErro", () => {
  const erroConvicto = { disciplinaId: "ti", correta: false, raciocinio: "achei que era X" };
  const erroChutado = { disciplinaId: "ti", correta: false };
  const acerto = { disciplinaId: "ti", correta: true, raciocinio: "sei" };

  it("separa convicção errada de chute, e acerto não entra", () => {
    const respostas = [
      ...Array.from({ length: 6 }, () => erroConvicto),
      ...Array.from({ length: 4 }, () => erroChutado),
      ...Array.from({ length: 10 }, () => acerto),
    ];
    const [ti] = anatomiaDoErro(respostas, 10);
    expect(ti.erros).toBe(10);
    expect(ti.conviccaoErrada).toBe(6);
    expect(ti.chuteErrado).toBe(4);
  });

  it("a autoavaliação 'chutei' vence o raciocínio escrito", () => {
    const respostas = Array.from({ length: 10 }, () => ({
      disciplinaId: "ti",
      correta: false,
      raciocinio: "escrevi algo",
      autoavaliacao: "chutei" as const,
    }));
    const [ti] = anatomiaDoErro(respostas, 10);
    expect(ti.chuteErrado).toBe(10);
    expect(ti.conviccaoErrada).toBe(0);
  });

  it("abaixo do mínimo de erros a disciplina fica de fora — sem dados não é diagnóstico", () => {
    expect(anatomiaDoErro(Array.from({ length: 9 }, () => erroChutado), 10)).toEqual([]);
  });
});

describe("evolucaoPorJanelas", () => {
  const AGORA = new Date("2026-08-19T12:00:00.000Z");
  const resposta = (diasAtras: number, correta: boolean) => ({
    disciplinaId: "ti",
    correta,
    data: new Date(AGORA.getTime() - diasAtras * 86_400_000).toISOString(),
  });

  it("melhora só quando os intervalos de Wilson não se sobrepõem", () => {
    const respostas = [
      // Janela anterior (31–60 dias atrás): 2 de 20 = 10%.
      ...Array.from({ length: 20 }, (_, i) => resposta(35 + (i % 20), i < 2)),
      // Janela recente (0–30): 18 de 20 = 90%.
      ...Array.from({ length: 20 }, (_, i) => resposta(1 + (i % 20), i < 18)),
    ];
    const [ti] = evolucaoPorJanelas(respostas, AGORA);
    expect(ti.tendencia).toBe("melhorou");
  });

  it("diferença pequena é 'indefinida', nunca uma seta mentirosa", () => {
    const respostas = [
      ...Array.from({ length: 20 }, (_, i) => resposta(35, i < 12)), // 60%
      ...Array.from({ length: 20 }, (_, i) => resposta(2, i < 14)), // 70%
    ];
    const [ti] = evolucaoPorJanelas(respostas, AGORA);
    expect(ti.tendencia).toBe("indefinida");
  });

  it("janela com menos que o mínimo vira null (sem dados), não zero", () => {
    const respostas = Array.from({ length: 12 }, (_, i) => resposta(2, i < 6));
    const [ti] = evolucaoPorJanelas(respostas, AGORA);
    expect(ti.recente?.respondidas).toBe(12);
    expect(ti.anterior).toBeNull();
    expect(ti.tendencia).toBe("indefinida");
  });

  it("resposta fora das duas janelas não entra em nenhuma", () => {
    const respostas = [
      ...Array.from({ length: 12 }, () => resposta(2, true)),
      ...Array.from({ length: 12 }, () => resposta(90, false)), // velha demais
    ];
    const [ti] = evolucaoPorJanelas(respostas, AGORA);
    expect(ti.anterior).toBeNull();
  });
});
