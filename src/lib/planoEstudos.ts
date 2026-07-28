import type { Disciplina, Questao, RespostaHistorico } from "@/types";
import { desempenhoPorUnidade } from "@/lib/desempenho";
import { incidencia } from "@/lib/incidencia";

/**
 * Plano semanal de estudos.
 *
 * A distribuição **não é igual entre as disciplinas**, e essa é a única decisão
 * que importa aqui: dar um dia para cada matéria trataria Estatística (5
 * questões na prova) como Tecnologia da Informação (35), e o candidato gastaria
 * a semana no lugar errado.
 *
 * O peso de cada disciplina sai de duas medidas reais, nesta ordem:
 *
 * 1. **Quanto ela cai** — o número de questões dela no acervo de provas
 *    anteriores. É o que o edital cobra de fato, medido, não estimado.
 * 2. **Quanto você erra** — disciplina com desempenho pior ganha reforço.
 *
 * Nada aqui é configurado à mão. Um plano que o usuário precisa preencher é um
 * plano que fica desatualizado no primeiro simulado.
 */

export const DIAS_DA_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
] as const;

export interface BlocoDeEstudo {
  disciplina: Disciplina;
  /** Assunto sugerido: o tópico mais cobrado que ainda não foi dominado. */
  topicoId: string | null;
  topicoNome: string | null;
  /** Por que este assunto entrou hoje — a tela mostra, para o plano não ser oráculo. */
  motivo: string;
}

export interface DiaDoPlano {
  indice: number; // 0 = domingo, como Date.getDay()
  nome: string;
  blocos: BlocoDeEstudo[];
  descanso: boolean;
}

interface Peso {
  disciplina: Disciplina;
  questoes: number;
  taxa: number | null;
  peso: number;
}

function pesos(
  disciplinas: Disciplina[],
  questoes: Questao[],
  historico: RespostaHistorico[],
  concursoId: string,
): Peso[] {
  const desempenho = desempenhoPorUnidade(historico, questoes, concursoId);

  return disciplinas
    .map((disciplina) => {
      const daDisciplina = questoes.filter((q) => q.disciplinaId === disciplina.id);
      const respostas = desempenho.filter((d) => d.disciplinaId === disciplina.id);
      const respondidas = respostas.reduce((a, d) => a + d.respondidas, 0);
      const acertos = respostas.reduce((a, d) => a + d.acertos, 0);
      const taxa = respondidas >= 5 ? Math.round((acertos / respondidas) * 100) : null;

      // O reforço só entra com base amostral mínima. Abaixo disso, "você erra
      // muito nisso" seria conclusão tirada de duas respostas.
      const reforco = taxa === null ? 1 : 1 + (100 - taxa) / 100;

      return {
        disciplina,
        questoes: daDisciplina.length,
        taxa,
        peso: daDisciplina.length * reforco,
      };
    })
    .filter((p) => p.questoes > 0)
    .sort((a, b) => b.peso - a.peso);
}

/**
 * Distribui os blocos pelos dias.
 *
 * Reparte proporcionalmente ao peso, mas garante **pelo menos um bloco** para
 * toda disciplina que cai na prova: zerar Estatística porque ela vale 5 questões
 * faria o candidato chegar na prova sem ter visto o assunto uma vez.
 */
export function montarPlano(
  disciplinas: Disciplina[],
  questoes: Questao[],
  historico: RespostaHistorico[],
  concursoId: string,
  diasDeEstudo = 6,
  blocosPorDia = 2,
): DiaDoPlano[] {
  const ordenadas = pesos(disciplinas, questoes, historico, concursoId);
  if (ordenadas.length === 0) {
    return DIAS_DA_SEMANA.map((nome, indice) => ({ indice, nome, blocos: [], descanso: true }));
  }

  const dominados = new Set(
    desempenhoPorUnidade(historico, questoes, concursoId)
      .filter((d) => d.respondidas >= 3 && d.taxa >= 80)
      .map((d) => d.unidadeId),
  );

  // Incidência por tópico, para escolher o assunto de cada bloco.
  const porDisciplina = new Map(
    incidencia(disciplinas, questoes, new Set()).map((i) => [i.disciplina.id, i]),
  );

  const vagas = diasDeEstudo * blocosPorDia;
  const total = ordenadas.reduce((a, p) => a + p.peso, 0);

  // Uma vaga garantida por disciplina; o resto vai por peso.
  const cotas = new Map(ordenadas.map((p) => [p.disciplina.id, 1]));
  let restantes = vagas - ordenadas.length;
  for (const p of ordenadas) {
    if (restantes <= 0) break;
    const extra = Math.min(restantes, Math.round((p.peso / total) * (vagas - ordenadas.length)));
    cotas.set(p.disciplina.id, (cotas.get(p.disciplina.id) ?? 1) + extra);
    restantes -= extra;
  }

  // Constrói a fila de blocos, alternando disciplinas para não empilhar a mesma
  // matéria em dias seguidos — variar ajuda a fixar mais que blocos longos.
  const fila: BlocoDeEstudo[] = [];
  const usados = new Map<string, number>();
  let sobrou = true;
  while (sobrou) {
    sobrou = false;
    for (const p of ordenadas) {
      const cota = cotas.get(p.disciplina.id) ?? 0;
      const ja = usados.get(p.disciplina.id) ?? 0;
      if (ja >= cota) continue;
      usados.set(p.disciplina.id, ja + 1);
      sobrou = true;

      const topicos = porDisciplina.get(p.disciplina.id)?.topicos ?? [];
      // Prioriza o tópico mais cobrado que ainda não foi dominado.
      const alvo = topicos.filter((t) => !dominados.has(t.topicoId))[ja] ?? topicos[ja] ?? null;

      fila.push({
        disciplina: p.disciplina,
        topicoId: alvo?.topicoId ?? null,
        topicoNome: alvo?.nome ?? null,
        motivo:
          p.taxa !== null && p.taxa < 60
            ? `${p.taxa}% de acerto seu nesta disciplina`
            : `${p.questoes} ${p.questoes === 1 ? "questão" : "questões"} em provas anteriores`,
      });
      if (fila.length >= vagas) break;
    }
    if (fila.length >= vagas) break;
  }

  return DIAS_DA_SEMANA.map((nome, indice) => {
    // Domingo é descanso. Estudar sete dias por semana é como se abandona um
    // plano na terceira semana.
    if (indice === 0) return { indice, nome, blocos: [], descanso: true };
    const inicio = (indice - 1) * blocosPorDia;
    return { indice, nome, blocos: fila.slice(inicio, inicio + blocosPorDia), descanso: false };
  });
}
