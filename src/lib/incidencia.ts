import type { Concurso, Disciplina, Prova, Questao } from "@/types";

/**
 * Quanto cada assunto do edital caiu nas provas anteriores.
 *
 * Duas honestidades embutidas, porque este é o número que mais tenta o exagero:
 *
 * 1. **Todo total vem acompanhado do n e do que falta classificar.** Um tópico
 *    com 2 questões num acervo 90% classificado diz algo; num acervo 20%
 *    classificado não diz nada, e a diferença tem que estar visível.
 * 2. **Disciplina de outro cargo não entra.** O acervo guarda provas de mais de
 *    um cargo do mesmo concurso, e somar Informática (Agente Comercial) com
 *    Tecnologia da Informação (Agente de Tecnologia) inflaria TI com conteúdo
 *    que o candidato nunca vai responder.
 */

export interface IncidenciaTopico {
  topicoId: string;
  nome: string;
  questoes: number;
  /** Fatia da disciplina, em pontos percentuais. */
  fatia: number;
}

export interface IncidenciaDisciplina {
  disciplina: Disciplina;
  total: number;
  classificadas: number;
  naoClassificadas: number;
  topicos: IncidenciaTopico[];
}

/**
 * As disciplinas que o cargo do concurso realmente cobra.
 *
 * Deriva do dado em vez de uma lista fixa no código: são as disciplinas que
 * aparecem nas provas **daquele cargo**. Uma lista escrita à mão envelheceria em
 * silêncio na primeira prova nova importada.
 */
export function disciplinasDoCargo(
  concurso: Concurso,
  provas: Prova[],
  questoes: Questao[],
): Set<string> {
  const provasDoCargo = new Set(provas.filter((p) => p.cargo === concurso.cargo).map((p) => p.id));
  // Sem prova do cargo no acervo não há como afirmar o recorte; devolver vazio
  // faria a tela sumir com tudo, então quem chama trata isso como "sem recorte".
  if (provasDoCargo.size === 0) return new Set();

  return new Set(
    questoes.filter((q) => q.provaId && provasDoCargo.has(q.provaId)).map((q) => q.disciplinaId),
  );
}

export function incidencia(
  disciplinas: Disciplina[],
  questoes: Questao[],
  escopo: Set<string>,
): IncidenciaDisciplina[] {
  const relevantes = escopo.size ? disciplinas.filter((d) => escopo.has(d.id)) : disciplinas;

  return relevantes
    .map((disciplina) => {
      const daDisciplina = questoes.filter((q) => q.disciplinaId === disciplina.id);
      const classificadas = daDisciplina.filter((q) => q.topicoId);

      const porTopico = new Map<string, number>();
      for (const q of classificadas) {
        porTopico.set(q.topicoId!, (porTopico.get(q.topicoId!) ?? 0) + 1);
      }

      const topicos = disciplina.topicos
        .map((t) => ({
          topicoId: t.id,
          nome: t.nome,
          questoes: porTopico.get(t.id) ?? 0,
          fatia: classificadas.length
            ? Math.round(((porTopico.get(t.id) ?? 0) / classificadas.length) * 100)
            : 0,
        }))
        // Tópico sem questão nenhuma continua no edital e pode cair; some da lista
        // só para não afogar o que tem sinal. A tela diz quantos ficaram de fora.
        .filter((t) => t.questoes > 0)
        .sort((a, b) => b.questoes - a.questoes);

      return {
        disciplina,
        total: daDisciplina.length,
        classificadas: classificadas.length,
        naoClassificadas: daDisciplina.length - classificadas.length,
        topicos,
      };
    })
    .filter((d) => d.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Quantas aplicações de prova sustentam a análise.
 *
 * É o número que decide se a leitura vale como tendência ou é só a descrição de
 * um caderno. Uma prova só descreve; não prevê.
 */
export function aplicacoesDistintas(questoes: Questao[], escopo: Set<string>): number {
  const anos = new Set(
    questoes.filter((q) => !escopo.size || escopo.has(q.disciplinaId)).map((q) => q.ano),
  );
  return anos.size;
}
