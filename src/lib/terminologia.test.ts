import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Trava de terminologia (ADR-012).
 *
 * O §8 do CLAUDE.md proíbe a UI de afirmar previsão que o corpus não sustenta.
 * Até aqui isso era disciplina manual; este teste transforma a regra em rede:
 * qualquer tela que reintroduza uma das frases abaixo quebra o CI na hora.
 *
 * A lista é de FRASES que afirmam previsão, nunca de palavras soltas — "lucro"
 * aparece legitimamente em sentido coloquial no incentivo, e bani-la geraria
 * falso positivo. Cresça a lista quando uma nova mentira estatística aparecer.
 */
const FRASES_PROIBIDAS: { padrao: RegExp; porque: string }[] = [
  {
    padrao: /probabilidade de cair/i,
    porque: "o corpus (1 aplicação do cargo-alvo) não sustenta probabilidade — só faixa com n.",
  },
  {
    padrao: /chances? de cair/i,
    porque: "mesma afirmação de previsão com outra palavra.",
  },
  {
    padrao: /certeza de cair|com certeza (vai )?cai/i,
    porque: "nenhuma análise deste app autoriza certeza sobre a próxima prova.",
  },
  {
    padrao: /garante (a |sua )?aprovação/i,
    porque: "desempenho em simulado não prevê aprovação (§2.2).",
  },
];

/** Onde a regra vale: todo texto que chega ao usuário. `ui/` é gerado pelo shadcn. */
const PASTAS_VIGIADAS = ["src/routes", "src/components"];
const IGNORAR = new Set(["ui"]);

function arquivosDeTela(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) {
      if (!IGNORAR.has(nome)) saida.push(...arquivosDeTela(caminho));
    } else if (/\.(tsx?|md)$/.test(nome) && !nome.endsWith(".test.ts")) {
      saida.push(caminho);
    }
  }
  return saida;
}

describe("terminologia proibida (§8 do CLAUDE.md)", () => {
  const arquivos = PASTAS_VIGIADAS.flatMap((p) => arquivosDeTela(join(process.cwd(), p)));

  it("encontra as telas para varrer (o teste não pode passar vazio)", () => {
    expect(arquivos.length).toBeGreaterThan(10);
  });

  for (const { padrao, porque } of FRASES_PROIBIDAS) {
    it(`nenhuma tela contém ${padrao}`, () => {
      const violacoes = arquivos
        .map((arquivo) => ({ arquivo, conteudo: readFileSync(arquivo, "utf-8") }))
        .filter(({ conteudo }) => padrao.test(conteudo))
        .map(({ arquivo }) => arquivo.replace(process.cwd(), ""));
      expect(
        violacoes,
        `frase proibida (${porque}) encontrada em: ${violacoes.join(", ")}`,
      ).toEqual([]);
    });
  }
});
