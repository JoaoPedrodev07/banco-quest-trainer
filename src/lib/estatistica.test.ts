import { describe, expect, it } from "vitest";

import {
  assuntosPara,
  curvaDeCobertura,
  decisaoDeChute,
  diagnosticarRitmo,
  ehFraquezaReal,
  faixaDeIncidencia,
  intervaloWilson,
  simularNota,
} from "./estatistica";

/**
 * Os testes miram as fronteiras onde estatística mente calada: amostra pequena,
 * proporção perto de zero e divisão por zero. Um erro nesses pontos não quebra a
 * tela — devolve um número plausível e errado, e o candidato reorganiza semanas
 * de estudo em cima dele.
 */

describe("intervaloWilson", () => {
  it("não devolve limite negativo com proporção baixa (é o que Wald erra)", () => {
    const { min, max } = intervaloWilson(2, 35);
    expect(min).toBeGreaterThanOrEqual(0);
    expect(max).toBeLessThanOrEqual(1);
    expect(min).toBeLessThan(2 / 35);
  });

  it("fica dentro de [0,1] mesmo com todos os acertos", () => {
    const { min, max } = intervaloWilson(10, 10);
    expect(min).toBeGreaterThan(0.6);
    expect(max).toBeLessThanOrEqual(1);
  });

  it("aperta o intervalo quando a amostra cresce", () => {
    const pequeno = intervaloWilson(5, 10);
    const grande = intervaloWilson(500, 1000);
    expect(grande.max - grande.min).toBeLessThan(pequeno.max - pequeno.min);
  });

  it("devolve zero em vez de dividir por zero", () => {
    expect(intervaloWilson(0, 0)).toEqual({ min: 0, max: 0 });
  });
});

describe("faixaDeIncidencia", () => {
  it("converte proporção observada em faixa de questões na próxima prova", () => {
    const f = faixaDeIncidencia(8, 35, 70);
    expect(f.minEsperado).toBeLessThan(f.maxEsperado);
    expect(f.minEsperado).toBeGreaterThanOrEqual(0);
  });

  it("marca como incerto quando a faixa é larga demais para decidir", () => {
    // 1 questão em 5: pouquíssima base, intervalo enorme.
    expect(faixaDeIncidencia(1, 5, 70).incerto).toBe(true);
  });

  it("não marca incerto quando a base sustenta a estimativa", () => {
    expect(faixaDeIncidencia(300, 1000, 70).incerto).toBe(false);
  });
});

describe("curvaDeCobertura", () => {
  const topicos = [
    { topicoId: "a", nome: "A", questoes: 10 },
    { topicoId: "b", nome: "B", questoes: 6 },
    { topicoId: "c", nome: "C", questoes: 3 },
    { topicoId: "d", nome: "D", questoes: 1 },
  ];

  it("ordena do mais cobrado para o menos", () => {
    expect(curvaDeCobertura(topicos).map((p) => p.topicoId)).toEqual(["a", "b", "c", "d"]);
  });

  it("acumula até 100% no último assunto", () => {
    const curva = curvaDeCobertura(topicos);
    expect(curva.at(-1)!.coberturaAcumulada).toBe(100);
  });

  it("mostra o retorno decrescente: o primeiro rende mais que o último", () => {
    const curva = curvaDeCobertura(topicos);
    expect(curva[0].ganhoMarginal).toBeGreaterThan(curva.at(-1)!.ganhoMarginal);
  });

  it("diz quantos assuntos bastam para um alvo de cobertura", () => {
    const curva = curvaDeCobertura(topicos);
    expect(assuntosPara(curva, 50)).toBe(1); // A sozinho já é 50%
    expect(assuntosPara(curva, 100)).toBe(4);
  });

  it("devolve vazio sem estourar quando não há questão classificada", () => {
    expect(curvaDeCobertura([{ topicoId: "x", nome: "X", questoes: 0 }])).toEqual([]);
  });
});

describe("simularNota", () => {
  const disciplinas = [
    { questoesNaProva: 35, taxaAcerto: 0.8 },
    { questoesNaProva: 35, taxaAcerto: 0.4 },
  ];

  it("a mediana fica perto do valor esperado", () => {
    // 35*0.8 + 35*0.4 = 42
    const r = simularNota(disciplinas, { simulacoes: 3000 });
    expect(r.mediana).toBeGreaterThan(38);
    expect(r.mediana).toBeLessThan(46);
  });

  it("devolve faixa, não ponto: p15 < mediana < p85", () => {
    const r = simularNota(disciplinas, { simulacoes: 3000 });
    expect(r.p15).toBeLessThanOrEqual(r.mediana);
    expect(r.mediana).toBeLessThanOrEqual(r.p85);
  });

  it("com desconto por erro, a nota cai", () => {
    const sem = simularNota(disciplinas, { simulacoes: 3000 });
    const com = simularNota(disciplinas, { simulacoes: 3000, descontaErro: true });
    expect(com.mediana).toBeLessThan(sem.mediana);
  });

  it("é determinística quando o gerador é fixo", () => {
    const sempreAcerta = () => 0;
    const r = simularNota([{ questoesNaProva: 10, taxaAcerto: 0.5 }], {
      simulacoes: 5,
      aleatorio: sempreAcerta,
    });
    expect(r.mediana).toBe(10);
  });
});

describe("ehFraquezaReal", () => {
  it("não acusa fraqueza com amostra minúscula", () => {
    // 0 de 2 parece péssimo, mas não distingue azar de fraqueza.
    expect(ehFraquezaReal(0, 2, 0.7)).toBe(false);
  });

  it("acusa quando o teto plausível fica abaixo da média geral", () => {
    expect(ehFraquezaReal(2, 20, 0.75)).toBe(true);
  });

  it("não acusa quando o desempenho é compatível com a média", () => {
    expect(ehFraquezaReal(7, 10, 0.7)).toBe(false);
  });

  it("não acusa 1 de 3 — é aqui que o limiar fixo erra", () => {
    // O critério antigo (>=3 respondidas e <60% de acerto) chamaria 33% de
    // fraqueza. Wilson diz que a taxa real pode chegar a ~75% com essa amostra,
    // ou seja, é indistinguível da média: mandar estudar seria gastar o tempo
    // da pessoa por causa de azar em três questões.
    expect(ehFraquezaReal(1, 3, 0.7)).toBe(false);
  });

  it("acusa 0 de 3, porque nem o teto plausível alcança a média", () => {
    // Diferente do caso acima: com nenhum acerto, o teto de Wilson fica em ~47%.
    expect(ehFraquezaReal(0, 3, 0.7)).toBe(true);
  });
});

describe("diagnosticarRitmo", () => {
  const alvo = 206; // ~3min26s

  it("identifica quem corre e erra", () => {
    const amostras = Array.from({ length: 8 }, () => ({
      disciplinaId: "portugues",
      segundos: 40,
      correta: false,
    }));
    const [d] = diagnosticarRitmo(amostras, alvo);
    expect(d.perfil).toBe("correndo");
    expect(d.mensagem).toMatch(/antes de ler/);
  });

  it("identifica quem acerta mas gasta tempo demais", () => {
    const amostras = Array.from({ length: 8 }, () => ({
      disciplinaId: "matematica",
      segundos: 400,
      correta: true,
    }));
    const [d] = diagnosticarRitmo(amostras, alvo);
    expect(d.perfil).toBe("travando");
    expect(d.mensagem).toMatch(/ganhar minutos/);
  });

  it("ignora disciplina com amostra insuficiente", () => {
    const amostras = [{ disciplinaId: "ti", segundos: 30, correta: false }];
    expect(diagnosticarRitmo(amostras, alvo)).toEqual([]);
  });

  it("ordena do pior acerto para o melhor", () => {
    const amostras = [
      ...Array.from({ length: 6 }, () => ({ disciplinaId: "bom", segundos: 200, correta: true })),
      ...Array.from({ length: 6 }, () => ({ disciplinaId: "ruim", segundos: 200, correta: false })),
    ];
    expect(diagnosticarRitmo(amostras, alvo)[0].disciplinaId).toBe("ruim");
  });
});

describe("decisaoDeChute", () => {
  it("sem desconto, responder sempre compensa", () => {
    const d = decisaoDeChute(false);
    expect(d.limiar).toBe(0);
    expect(d.vantajoso(0.1)).toBe(true);
  });

  it("com desconto, o limiar é 50%", () => {
    const d = decisaoDeChute(true);
    expect(d.limiar).toBe(0.5);
    expect(d.vantajoso(0.4)).toBe(false);
    expect(d.vantajoso(0.6)).toBe(true);
  });

  it("cita a chance do chute cego na explicação", () => {
    expect(decisaoDeChute(true, 5).explicacao).toMatch(/20%/);
  });
});
