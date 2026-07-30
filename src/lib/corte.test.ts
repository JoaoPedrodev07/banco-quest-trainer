import { describe, expect, it } from "vitest";

import {
  COMPOSICAO_PROVA,
  LIMITE_HABILITACAO,
  TOTAL_BASICOS,
  TOTAL_ESPECIFICOS,
  TOTAL_PROVA,
  avaliarCorte,
  concorrenciaPorLista,
  projetarNota,
} from "./corte";

/**
 * Estes testes protegem números que vieram do edital, não de estimativa. Se um
 * deles quebrar, ou o edital de 2026 mudou (e aí o módulo precisa mudar junto),
 * ou alguém transcreveu errado — e transcrição errada aqui faz o app dizer
 * "aprovado" para quem foi eliminado.
 */

describe("composição da prova (edital 7.1.2)", () => {
  it("soma 70 questões", () => {
    expect(COMPOSICAO_PROVA.reduce((a, d) => a + d.questoes, 0)).toBe(70);
  });

  it("soma 100 pontos, divididos em 32,5 + 67,5", () => {
    const soma = (bloco: string) =>
      COMPOSICAO_PROVA.filter((d) => d.bloco === bloco).reduce(
        (a, d) => a + d.questoes * d.valorPorQuestao,
        0,
      );
    expect(soma("basicos")).toBeCloseTo(TOTAL_BASICOS);
    expect(soma("especificos")).toBeCloseTo(TOTAL_ESPECIFICOS);
    expect(soma("basicos") + soma("especificos")).toBeCloseTo(TOTAL_PROVA);
  });
});

/** Gabarito perfeito, usado como base para variar uma disciplina por vez. */
const tudo = Object.fromEntries(COMPOSICAO_PROVA.map((d) => [d.disciplinaId, d.questoes]));

describe("avaliarCorte", () => {
  it("nota máxima não elimina", () => {
    const r = avaliarCorte(tudo);
    expect(r.pontos).toBe(100);
    expect(r.eliminado).toBe(false);
  });

  it("elimina quem zera uma única disciplina, mesmo com nota alta", () => {
    // Zerar Inglês custa só 5 pontos — 95 no total, muito acima do piso — e
    // ainda assim elimina. É a regra que mais surpreende candidato bom.
    const r = avaliarCorte({ ...tudo, ingles: 0 });
    expect(r.pontos).toBe(95);
    expect(r.eliminado).toBe(true);
    expect(r.motivos.map((m) => m.regra)).toContain("nota zero em disciplina");
  });

  it("elimina por bloco mesmo com o total acima de 50", () => {
    // Específicos cheios (67,5) e Básicos raspando: 1 acerto em cada disciplina
    // básica dá 5,0 de 32,5 — abaixo dos 16,25 exigidos. Total = 72,5.
    const r = avaliarCorte({ ...tudo, portugues: 1, ingles: 1, matematica: 1, atualidades: 1 });
    expect(r.pontos).toBeGreaterThan(50);
    expect(r.eliminado).toBe(true);
    expect(r.motivos.map((m) => m.regra)).toContain("50% de Conhecimentos Básicos");
  });

  it("acumula os motivos em vez de parar no primeiro", () => {
    const r = avaliarCorte({});
    // Sem acerto nenhum: falha no total, nos dois blocos e nas sete zeradas.
    expect(r.motivos.length).toBe(4);
    expect(r.eliminado).toBe(true);
  });

  it("mede a folga até o piso, com sinal", () => {
    expect(avaliarCorte(tudo).folgaTotal).toBe(50);
    expect(avaliarCorte({ ...tudo, ti: 0 }).folgaTotal).toBeLessThan(0);
  });

  it("não deixa acerto acima do número de questões inflar a nota", () => {
    expect(avaliarCorte({ ...tudo, ti: 999 }).pontos).toBe(100);
  });
});

describe("projetarNota", () => {
  it("aponta as disciplinas sem histórico em vez de fingir dado", () => {
    const { semBase } = projetarNota({ ti: 0.8 });
    expect(semBase).toContain("Língua Inglesa");
    expect(semBase).not.toContain("Tecnologia da Informação");
  });

  it("projeta disciplina sem base pelo acaso, não por zero", () => {
    // Zero dispararia "nota zero em disciplina" e inventaria uma eliminação em
    // quem só ainda não respondeu questão nenhuma daquela matéria.
    const { resultado } = projetarNota({});
    expect(resultado.motivos.map((m) => m.regra)).not.toContain("nota zero em disciplina");
  });

  it("não acusa eliminação quando o bloco que falhou foi preenchido pelo app", () => {
    // O caso real que apareceu na tela: histórico só de TI e Português. O bloco
    // de Básicos afundava porque o app chutou 20% em Inglês, Matemática e
    // Atualidades — "Eliminado" que veio do preenchimento, não do candidato.
    const p = projetarNota({ ti: 0.85, portugues: 0.7 });
    expect(p.resultado.motivos.map((m) => m.regra)).toContain("50% de Conhecimentos Básicos");
    expect(p.motivosReais).toEqual([]);
    expect(p.blocosIncompletos).toContain("basicos");
  });

  it("mantém a eliminação quando o bloco que falhou tem base completa", () => {
    // Básicos completos e bem; Específicos completos e mal. A eliminação por
    // Específicos é do candidato, e precisa continuar aparecendo.
    const p = projetarNota({
      portugues: 0.9,
      ingles: 0.9,
      matematica: 0.9,
      atualidades: 0.9,
      estatistica: 0.1,
      bancarios: 0.1,
      ti: 0.1,
    });
    expect(p.motivosReais.map((m) => m.regra)).toContain("50% de Conhecimentos Específicos");
    expect(p.blocosIncompletos).toEqual([]);
  });

  it("o motivo do total fica indeterminado se qualquer bloco tiver lacuna", () => {
    const p = projetarNota({ ti: 0.2 });
    expect(p.motivosIndeterminados.map((m) => m.regra)).toContain("50% do total");
  });

  it("80% em tudo passa do piso com folga", () => {
    const taxas = Object.fromEntries(COMPOSICAO_PROVA.map((d) => [d.disciplinaId, 0.8]));
    const { resultado } = projetarNota(taxas);
    expect(resultado.eliminado).toBe(false);
    expect(resultado.pontos).toBeCloseTo(80, 0);
  });
});

describe("concorrência por lista (Anexo II, MR 158)", () => {
  it("as três listas somam as 3.000 posições da microrregião", () => {
    expect(concorrenciaPorLista().reduce((a, l) => a + l.total, 0)).toBe(3000);
  });

  it("PcD é 5% das posições, como manda o subitem 4.1.2", () => {
    expect(concorrenciaPorLista().find((l) => l.lista === "pcd")!.fatia).toBe(5);
  });

  it("habilita para a redação o triplo de vagas + cadastro de reserva", () => {
    expect(LIMITE_HABILITACAO).toBe(9000);
  });
});
