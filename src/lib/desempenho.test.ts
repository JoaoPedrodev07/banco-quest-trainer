import { describe, expect, it } from "vitest";

import { assuntosTravados } from "./desempenho";
import type { Questao, RespostaHistorico } from "@/types";

const questao = (id: string, subtopicoId: string): Questao => ({
  id,
  disciplinaId: "ti",
  ano: 2023,
  banca: "Cesgranrio",
  enunciado: "?",
  alternativas: [],
  correta: "A",
  explicacao: "",
  subtopicoId,
});

const resposta = (questaoId: string, correta: boolean, ordem: number): RespostaHistorico => ({
  questaoId,
  disciplinaId: "ti",
  concursoId: "bb-ti-2026",
  escolhida: correta ? "A" : "B",
  correta,
  data: `2026-08-${String(ordem).padStart(2, "0")}T12:00:00.000Z`,
});

const QUESTOES = [questao("q1", "sql"), questao("q2", "sql"), questao("q3", "sql")];

describe("assuntosTravados", () => {
  it("três erros seguidos travam o assunto", () => {
    const historico = [
      resposta("q1", false, 1),
      resposta("q2", false, 2),
      resposta("q3", false, 3),
    ];
    expect(assuntosTravados(historico, QUESTOES, "bb-ti-2026")).toEqual(new Set(["sql"]));
  });

  it("acertar a última destrava — a sequência olha só o fim", () => {
    const historico = [
      resposta("q1", false, 1),
      resposta("q2", false, 2),
      resposta("q3", false, 3),
      resposta("q1", true, 4),
    ];
    expect(assuntosTravados(historico, QUESTOES, "bb-ti-2026").size).toBe(0);
  });

  it("dois erros não bastam: sem a sequência mínima não há diagnóstico", () => {
    const historico = [resposta("q1", false, 1), resposta("q2", false, 2)];
    expect(assuntosTravados(historico, QUESTOES, "bb-ti-2026").size).toBe(0);
  });

  it("erro de outro concurso não conta", () => {
    const deOutro = { ...resposta("q3", false, 3), concursoId: "cebraspe-bnb-ti-2022" };
    const historico = [resposta("q1", false, 1), resposta("q2", false, 2), deOutro];
    expect(assuntosTravados(historico, QUESTOES, "bb-ti-2026").size).toBe(0);
  });
});
