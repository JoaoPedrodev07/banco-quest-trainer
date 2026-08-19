import type { RevisaoItem } from "@/types";

/**
 * Regras da agenda de revisão espaçada (ADR-003).
 *
 * Funções puras, fora do store, por dois motivos: são regra de data — o tipo de
 * lógica que erra em silêncio (§7.1 do CLAUDE.md) — e precisam de teste; e o
 * store deve guardar fato e delegar regra, não acumular as duas coisas.
 *
 * A escada é 1 → 7 → 15 → 30 dias. Errar o assunto **regride para 1**: erro é o
 * sinal mais confiável de que o conteúdo não fixou, e uma agenda que só anda
 * para frente transforma "30 dias" em "antigo" em vez de "dominado".
 */

export type Intervalo = RevisaoItem["intervaloAtual"];

export const INTERVALO_INICIAL: Intervalo = 1;

export function proximoIntervalo(atual: Intervalo): Intervalo {
  if (atual === 1) return 7;
  if (atual === 7) return 15;
  return 30;
}

const DIA_MS = 86_400_000;

/** ISO de `dias` a partir de `agora` — sempre por aritmética de ms, nunca por setDate (§2.5). */
export function dataAposDias(dias: number, agora: Date): string {
  return new Date(agora.getTime() + dias * DIA_MS).toISOString();
}

/**
 * Um erro aconteceu na unidade: agenda revisão nova, ou **regride** a existente
 * para o intervalo inicial. Regressão não duplica a linha — muda data e
 * intervalo da que já existe, então a objeção original a reagendar ("encheria a
 * tela do mesmo tópico") não se aplica.
 */
export function agendarOuRegredir(
  revisoes: RevisaoItem[],
  dados: { unidadeId: string; topico: string; disciplinaId: string; concursoId: string },
  agora: Date,
): RevisaoItem[] {
  const existente = revisoes.find(
    (r) => r.unidadeId === dados.unidadeId && r.concursoId === dados.concursoId,
  );

  if (existente) {
    return revisoes.map((r) =>
      r.id === existente.id
        ? {
            ...r,
            intervaloAtual: INTERVALO_INICIAL,
            proximaRevisao: dataAposDias(INTERVALO_INICIAL, agora),
          }
        : r,
    );
  }

  return [
    ...revisoes,
    {
      id: `rev-${dados.unidadeId}-${dados.concursoId}`,
      topico: dados.topico,
      disciplinaId: dados.disciplinaId,
      concursoId: dados.concursoId,
      unidadeId: dados.unidadeId,
      proximaRevisao: dataAposDias(INTERVALO_INICIAL, agora),
      intervaloAtual: INTERVALO_INICIAL,
    },
  ];
}

/** "Revisado hoje": avança a escada e reagenda a partir de agora. */
export function avancarRevisao(revisoes: RevisaoItem[], id: string, agora: Date): RevisaoItem[] {
  return revisoes.map((r) => {
    if (r.id !== id) return r;
    const novo = proximoIntervalo(r.intervaloAtual);
    return { ...r, intervaloAtual: novo, proximaRevisao: dataAposDias(novo, agora) };
  });
}

/**
 * Adia a partir de **agora**, não da data marcada: adiar uma revisão atrasada
 * há 10 dias em "+1" precisa dar amanhã, não nove dias atrás.
 */
export function adiarRevisao(
  revisoes: RevisaoItem[],
  id: string,
  dias: number,
  agora: Date,
): RevisaoItem[] {
  return revisoes.map((r) =>
    r.id === id ? { ...r, proximaRevisao: dataAposDias(dias, agora) } : r,
  );
}

/**
 * As quatro revisões de demonstração do protótipo, para a migração remover.
 * Identificadas por id **e** tópico exatos: id curto como "r1" poderia, em tese,
 * colidir com algo legítimo, e apagar revisão real de usuário é o único erro
 * imperdoável desta migração.
 */
const DEMOS = new Map([
  ["r1", "APIs REST"],
  ["r2", "Pix e Open Finance"],
  ["r3", "SQL avançado"],
  ["r4", "Concordância verbal"],
]);

export function semRevisoesDeDemonstracao(revisoes: RevisaoItem[]): RevisaoItem[] {
  return revisoes.filter((r) => DEMOS.get(r.id) !== r.topico);
}
