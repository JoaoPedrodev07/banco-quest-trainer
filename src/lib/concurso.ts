import type { Concurso, StatusConcurso } from "@/types";

/** Rótulo e cor de cada status, para não espalhar `switch` pelas telas. */
export const STATUS_CONCURSO: Record<
  StatusConcurso,
  { rotulo: string; variante: "default" | "secondary" | "outline" | "destructive" }
> = {
  inscricoes_abertas: { rotulo: "Inscrições abertas", variante: "default" },
  inscricoes_encerradas: { rotulo: "Inscrições encerradas", variante: "secondary" },
  previsto: { rotulo: "Previsto", variante: "outline" },
  encerrado: { rotulo: "Encerrado", variante: "secondary" },
};

/**
 * Salário em reais. Devolve null quando não há valor divulgado — quem chama
 * decide o texto, em vez de receber um "R$ 0,00" que parece dado real.
 */
export function formatarSalario(salario: Concurso["salario"]): string | null {
  if (!salario) return null;
  return salario.valor.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

/**
 * Texto do filtro por faixa salarial. As faixas são grosseiras de propósito:
 * o salário de concurso previsto é estimativa de imprensa, e faixa estreita
 * daria a impressão de precisão que o dado não tem.
 */
export const FAIXAS_SALARIAIS = [
  { id: "todas", rotulo: "Qualquer salário", min: 0, max: Infinity },
  { id: "ate-10k", rotulo: "Até R$ 10 mil", min: 0, max: 10_000 },
  { id: "10k-20k", rotulo: "R$ 10 mil a R$ 20 mil", min: 10_000, max: 20_000 },
  { id: "acima-20k", rotulo: "Acima de R$ 20 mil", min: 20_000, max: Infinity },
] as const;

export function dentroDaFaixa(concurso: Concurso, faixaId: string): boolean {
  const faixa = FAIXAS_SALARIAIS.find((f) => f.id === faixaId);
  if (!faixa || faixa.id === "todas") return true;
  // Sem salário divulgado o concurso não pode ser afirmado dentro nem fora da
  // faixa; fica de fora do filtro estreito para não sugerir um valor que não existe.
  if (!concurso.salario) return false;
  return concurso.salario.valor >= faixa.min && concurso.salario.valor < faixa.max;
}

/** Busca textual simples sobre os campos que o usuário reconhece. */
export function combinaBusca(concurso: Concurso, termo: string): boolean {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return true;
  return [concurso.nome, concurso.orgao, concurso.cargo, concurso.banca ?? ""]
    .join(" ")
    .toLowerCase()
    .includes(alvo);
}
