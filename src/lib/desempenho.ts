import type { Questao, RespostaHistorico } from "@/types";

/**
 * Desempenho por unidade do edital (subtópico, ou tópico quando não há
 * subdivisão).
 *
 * Tudo aqui é **calculado na leitura** a partir do histórico de respostas, nunca
 * guardado no store (§2.3 do CLAUDE.md): taxa de acerto é conclusão, não fato, e
 * guardar conclusão diverge em silêncio assim que o histórico muda.
 */

export interface DesempenhoUnidade {
  unidadeId: string;
  disciplinaId: string;
  respondidas: number;
  acertos: number;
  taxa: number; // 0–100
}

/**
 * Mínimo de questões respondidas para uma unidade poder ser chamada de "fraca".
 *
 * Com uma ou duas respostas, 0% de acerto é ruído: erra-se a primeira questão de
 * qualquer assunto. Três é pouco, mas é o mínimo em que a taxa começa a dizer
 * algo — e o acervo classificado por unidade ainda é pequeno, então exigir mais
 * deixaria a lista sempre vazia.
 */
export const MINIMO_PARA_JULGAR = 3;

/** Abaixo disto a unidade entra na lista de fracas. */
export const LIMITE_TAXA_FRACA = 60;

export function desempenhoPorUnidade(
  historico: RespostaHistorico[],
  questoes: Questao[],
  concursoId?: string,
): DesempenhoUnidade[] {
  const porId = new Map(questoes.map((q) => [q.id, q]));
  const acumulado = new Map<
    string,
    { disciplinaId: string; respondidas: number; acertos: number }
  >();

  for (const resposta of historico) {
    // Histórico de outro concurso não entra: disciplina se repete entre concursos
    // e a mistura inflaria a contagem de um assunto que nem é do edital atual.
    if (concursoId && resposta.concursoId !== concursoId) continue;

    const questao = porId.get(resposta.questaoId);
    // Questão que saiu do acervo, ou que ainda não foi classificada, não tem
    // unidade a que pertencer — some da análise em vez de virar um grupo "outros"
    // que ninguém sabe interpretar.
    const unidadeId = questao?.subtopicoId ?? questao?.topicoId;
    if (!questao || !unidadeId) continue;

    const atual = acumulado.get(unidadeId) ?? {
      disciplinaId: questao.disciplinaId,
      respondidas: 0,
      acertos: 0,
    };
    atual.respondidas += 1;
    if (resposta.correta) atual.acertos += 1;
    acumulado.set(unidadeId, atual);
  }

  return [...acumulado.entries()].map(([unidadeId, d]) => ({
    unidadeId,
    disciplinaId: d.disciplinaId,
    respondidas: d.respondidas,
    acertos: d.acertos,
    taxa: Math.round((d.acertos / d.respondidas) * 100),
  }));
}

/** As unidades com pior desempenho, da pior para a menos pior. */
export function pontosFracos(
  historico: RespostaHistorico[],
  questoes: Questao[],
  concursoId?: string,
  limite = 5,
): DesempenhoUnidade[] {
  return desempenhoPorUnidade(historico, questoes, concursoId)
    .filter((d) => d.respondidas >= MINIMO_PARA_JULGAR && d.taxa < LIMITE_TAXA_FRACA)
    .sort((a, b) => a.taxa - b.taxa || b.respondidas - a.respondidas)
    .slice(0, limite);
}

/** Só os ids, para a tela do edital destacar as linhas sem recalcular por linha. */
export function unidadesFracas(
  historico: RespostaHistorico[],
  questoes: Questao[],
  concursoId?: string,
): Set<string> {
  return new Set(pontosFracos(historico, questoes, concursoId, Infinity).map((d) => d.unidadeId));
}
