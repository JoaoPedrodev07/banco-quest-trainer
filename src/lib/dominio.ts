import type { Questao, RespostaHistorico } from "@/types";

/**
 * Decide, por assunto do edital, se o candidato já pode estudar pelo gabarito
 * comentado ou ainda precisa de teoria.
 *
 * A pergunta que isto responde é a que o acerto sozinho não responde: **acertou
 * sabendo, ou acertou eliminando?** As duas coisas contam igual no percentual e
 * significam coisas opostas para o cronograma — quem elimina bem passa na
 * questão e trava na próxima, porque não tem a estrutura, só o faro.
 *
 * Por isso o sinal aqui não é o acerto, é o par **acerto + raciocínio coerente**.
 * Sem raciocínio registrado a resposta não conta como evidência de domínio; ela
 * também não conta contra, porque histórico antigo (anterior ao campo existir) e
 * flashcard não têm esse dado, e tratar ausência como erro puniria quem estudou
 * antes da mudança.
 */

export type NivelDominio = "sem_dados" | "precisa_teoria" | "pode_gabarito";

export interface DominioDaUnidade {
  unidadeId: string;
  /** Respostas com raciocínio registrado — o `n` que sustenta o veredito. */
  avaliadas: number;
  /** Destas, quantas foram acerto com raciocínio coerente. */
  solidas: number;
  nivel: NivelDominio;
}

/**
 * Abaixo disto não há veredito. É o mesmo piso que o resto do projeto usa: com
 * uma ou duas respostas, "100% de domínio" descreve sorte, não conhecimento.
 */
export const MINIMO_PARA_VEREDITO = 3;

/** Fração de respostas sólidas a partir da qual o assunto dispensa teoria. */
const PISO_PARA_GABARITO = 0.7;

/**
 * Uma resposta é "sólida" quando o candidato acertou **e** o raciocínio dele
 * fecha com o gabarito.
 *
 * O veredito da IA manda sobre a autoavaliação quando existe, e é de propósito:
 * o ponto cego que este ciclo existe para achar é o candidato que se
 * superestima, e ele não vai se corrigir sozinho. Sem veredito, vale a nota
 * dele — que ainda é muito melhor que nada.
 */
function ehSolida(r: RespostaHistorico): boolean {
  if (!r.correta) return false;
  if (r.vereditoIa) return r.vereditoIa === "coerente";
  return r.autoavaliacao === "bateu";
}

export function dominioPorUnidade(
  historico: RespostaHistorico[],
  questoes: Questao[],
  concursoId: string,
): Map<string, DominioDaUnidade> {
  const unidadeDaQuestao = new Map<string, string>();
  for (const q of questoes) {
    const unidade = q.subtopicoId ?? q.topicoId;
    if (unidade) unidadeDaQuestao.set(q.id, unidade);
  }

  const porUnidade = new Map<string, DominioDaUnidade>();

  for (const r of historico) {
    if (r.concursoId !== concursoId) continue;
    // Sem raciocínio não há o que julgar: a resposta fica fora da conta em vez
    // de entrar como ponto negativo.
    if (!r.raciocinio?.trim() && !r.autoavaliacao) continue;

    const unidadeId = unidadeDaQuestao.get(r.questaoId);
    if (!unidadeId) continue;

    const atual = porUnidade.get(unidadeId) ?? {
      unidadeId,
      avaliadas: 0,
      solidas: 0,
      nivel: "sem_dados" as NivelDominio,
    };
    atual.avaliadas += 1;
    if (ehSolida(r)) atual.solidas += 1;
    porUnidade.set(unidadeId, atual);
  }

  for (const d of porUnidade.values()) {
    d.nivel =
      d.avaliadas < MINIMO_PARA_VEREDITO
        ? "sem_dados"
        : d.solidas / d.avaliadas >= PISO_PARA_GABARITO
          ? "pode_gabarito"
          : "precisa_teoria";
  }

  return porUnidade;
}

/** Texto curto para a tela, sempre acompanhado do `n` que o sustenta. */
export function rotuloDoDominio(d: DominioDaUnidade | undefined): string {
  if (!d || d.nivel === "sem_dados") {
    const n = d?.avaliadas ?? 0;
    return `Sem dados para decidir (${n} de ${MINIMO_PARA_VEREDITO} respostas com raciocínio)`;
  }
  if (d.nivel === "pode_gabarito") {
    return `Pode estudar pelo gabarito (${d.solidas} de ${d.avaliadas} com raciocínio coerente)`;
  }
  return `Precisa de teoria (${d.solidas} de ${d.avaliadas} com raciocínio coerente)`;
}
