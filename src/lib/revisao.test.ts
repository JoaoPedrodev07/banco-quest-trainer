import { describe, expect, it } from "vitest";

import {
  adiarRevisao,
  agendarOuRegredir,
  avancarRevisao,
  proximoIntervalo,
  semRevisoesDeDemonstracao,
} from "./revisao";
import type { RevisaoItem } from "@/types";

const AGORA = new Date("2026-08-19T12:00:00.000Z");

const revisao = (extra: Partial<RevisaoItem> = {}): RevisaoItem => ({
  id: "rev-u1-bb",
  topico: "Normalização",
  disciplinaId: "ti",
  concursoId: "bb-ti-2026",
  unidadeId: "u1",
  proximaRevisao: "2026-09-01T12:00:00.000Z",
  intervaloAtual: 15,
  ...extra,
});

describe("proximoIntervalo", () => {
  it("sobe a escada 1 → 7 → 15 → 30 e trava no teto", () => {
    expect(proximoIntervalo(1)).toBe(7);
    expect(proximoIntervalo(7)).toBe(15);
    expect(proximoIntervalo(15)).toBe(30);
    expect(proximoIntervalo(30)).toBe(30);
  });
});

describe("agendarOuRegredir", () => {
  const dados = {
    unidadeId: "u1",
    topico: "Normalização",
    disciplinaId: "ti",
    concursoId: "bb-ti-2026",
  };

  it("cria agenda nova para amanhã quando a unidade não tem revisão", () => {
    const resultado = agendarOuRegredir([], dados, AGORA);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].intervaloAtual).toBe(1);
    expect(resultado[0].proximaRevisao).toBe("2026-08-20T12:00:00.000Z");
  });

  it("REGRIDE a agenda existente para 1 dia em vez de ignorar o erro", () => {
    const resultado = agendarOuRegredir([revisao()], dados, AGORA);
    expect(resultado).toHaveLength(1); // não duplica
    expect(resultado[0].intervaloAtual).toBe(1);
    expect(resultado[0].proximaRevisao).toBe("2026-08-20T12:00:00.000Z");
  });

  it("não mexe na agenda de outro concurso, mesmo com a mesma unidade", () => {
    const deOutro = revisao({ id: "rev-u1-bnb", concursoId: "cebraspe-bnb-ti-2022" });
    const resultado = agendarOuRegredir([deOutro], dados, AGORA);
    expect(resultado).toHaveLength(2);
    expect(resultado[0]).toEqual(deOutro);
  });
});

describe("avancarRevisao", () => {
  it("avança a escada e reagenda a partir de agora", () => {
    const resultado = avancarRevisao([revisao({ intervaloAtual: 7 })], "rev-u1-bb", AGORA);
    expect(resultado[0].intervaloAtual).toBe(15);
    expect(resultado[0].proximaRevisao).toBe("2026-09-03T12:00:00.000Z");
  });
});

describe("adiarRevisao", () => {
  it("adia a partir de AGORA, não da data marcada — atrasada +1 dá amanhã", () => {
    const atrasada = revisao({ proximaRevisao: "2026-08-09T12:00:00.000Z" });
    const resultado = adiarRevisao([atrasada], "rev-u1-bb", 1, AGORA);
    expect(resultado[0].proximaRevisao).toBe("2026-08-20T12:00:00.000Z");
    // Adiar não é revisar: o intervalo da escada fica onde estava.
    expect(resultado[0].intervaloAtual).toBe(15);
  });
});

describe("semRevisoesDeDemonstracao", () => {
  it("remove só as quatro demos do protótipo, por id E tópico", () => {
    const demo = revisao({ id: "r1", topico: "APIs REST", unidadeId: undefined });
    const legitimaComIdCurto = revisao({ id: "r1", topico: "Ponteiros em C" });
    const normal = revisao();
    expect(semRevisoesDeDemonstracao([demo, legitimaComIdCurto, normal])).toEqual([
      legitimaComIdCurto,
      normal,
    ]);
  });
});
