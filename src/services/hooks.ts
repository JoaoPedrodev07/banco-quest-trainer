/**
 * Hooks de leitura do acervo.
 *
 * As telas passam por aqui em vez de importar `src/data/` direto: assim a
 * decisão "API ou mock" mora só em `services/index.ts`, e trocar o backend não
 * pede alteração em nenhuma rota.
 *
 * Os arrays de fallback são constantes de módulo, e não `?? []` no corpo do
 * hook, porque um literal novo a cada render invalida `useMemo` das rotas
 * enquanto a query não resolve — o cálculo do dashboard rodaria em loop.
 */

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, chaves } from "@/services";
import { concursoPorId } from "@/data/concursos";
import { disciplinasDoCargo } from "@/lib/incidencia";
import type {
  Aula,
  ClassificacaoRevisao,
  Concurso,
  Disciplina,
  ProblemaQuestao,
  Prova,
  Questao,
  TipoProblema,
} from "@/types";

const SEM_CONCURSOS: Concurso[] = [];
const SEM_DISCIPLINAS: Disciplina[] = [];
const SEM_QUESTOES: Questao[] = [];
const SEM_PROVAS: Prova[] = [];
const SEM_FILA_REVISAO: ClassificacaoRevisao[] = [];
const SEM_PROBLEMAS: ProblemaQuestao[] = [];

/**
 * Catálogo de concursos (ADR-015): agora vem do backend (editável no Django
 * Admin, sem deploy); o hardcoded de `src/data/concursos.ts` é a reserva de
 * mock quando o servidor não responde.
 */
export function useConcursos() {
  const consulta = useQuery({ queryKey: chaves.concursos, queryFn: api.listConcursos });
  return { concursos: consulta.data ?? SEM_CONCURSOS, carregando: consulta.isPending };
}

/**
 * Um concurso do catálogo. Enquanto a query resolve, cai no catálogo estático
 * — senão toda tela piscaria "Escolha um concurso" a cada carga.
 */
export function useConcurso(concursoId: string): Concurso | undefined {
  const { concursos } = useConcursos();
  return concursos.find((c) => c.id === concursoId) ?? concursoPorId(concursoId);
}

export function useDisciplinas(concursoId?: string) {
  const consulta = useQuery({
    queryKey: [...chaves.disciplinas, concursoId ?? ""],
    queryFn: () => api.listDisciplinas(concursoId),
  });
  return { disciplinas: consulta.data ?? SEM_DISCIPLINAS, carregando: consulta.isPending };
}

// Com `concursoId`, o backend devolve só o acervo daquele concurso (ADR-018);
// sem ele vem tudo — uso reservado à tela de Provas, que é o repositório.
export function useQuestoes(concursoId?: string) {
  const consulta = useQuery({
    queryKey: [...chaves.questoes, concursoId ?? ""],
    queryFn: () => api.listQuestoes(concursoId),
  });
  return { questoes: consulta.data ?? SEM_QUESTOES, carregando: consulta.isPending };
}

export function useProvas(concursoId?: string) {
  const consulta = useQuery({
    queryKey: [...chaves.provas, concursoId ?? ""],
    queryFn: () => api.listProvas(concursoId),
  });
  return { provas: consulta.data ?? SEM_PROVAS, carregando: consulta.isPending };
}

export function useAcervo() {
  const consulta = useQuery({ queryKey: chaves.acervo, queryFn: api.acervo });
  return { acervo: consulta.data, carregando: consulta.isPending };
}

/**
 * Aulas do concurso ativo, indexadas por unidade do edital.
 *
 * Devolve um Map para a tela do edital não varrer a lista inteira em cada uma
 * das ~100 linhas que renderiza — com busca linear por linha o custo vira
 * quadrático assim que o acervo de aulas crescer.
 */
export function useAulas(concursoId: string) {
  const consulta = useQuery({
    queryKey: chaves.aulas(concursoId),
    queryFn: () => api.listAulas(concursoId),
    // Sem backend não há aula; a tela mostra "gerar" e o erro não vira ruído.
    retry: false,
  });

  const porUnidade = useMemo(() => {
    const mapa = new Map<string, Aula>();
    for (const aula of consulta.data ?? []) mapa.set(aula.unidadeId, aula);
    return mapa;
  }, [consulta.data]);

  return { aulas: porUnidade, carregando: consulta.isPending };
}

export function useSalvarAula(concursoId: string) {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (aula: Omit<Aula, "geradoEm">) => api.salvarAula(aula),
    // Invalida em vez de escrever no cache à mão: o servidor devolve `geradoEm`,
    // e reconstruir isso no cliente daria duas verdades para a mesma aula.
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.aulas(concursoId) }),
  });
}

export function useComentarGabarito() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({ questaoId, explicacao }: { questaoId: string; explicacao: string }) =>
      api.comentarGabarito(questaoId, explicacao),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.questoes }),
  });
}

/** Fila de revisão de classificação (Fase 2, `CLAUDE.md` §8). */
export function useFilaRevisao() {
  const consulta = useQuery({
    queryKey: chaves.filaRevisao,
    queryFn: api.listFilaRevisao,
    retry: false,
  });
  return { fila: consulta.data ?? SEM_FILA_REVISAO, carregando: consulta.isPending };
}

export function useRevisarClassificacao() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.revisarClassificacao(id),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.filaRevisao }),
  });
}

/** Fila de problemas reportados nas questões (ADR-014). */
export function useProblemas() {
  const consulta = useQuery({
    queryKey: chaves.problemas,
    queryFn: api.listProblemas,
    retry: false,
  });
  return { problemas: consulta.data ?? SEM_PROBLEMAS, carregando: consulta.isPending };
}

export function useReportarProblema() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: ({
      questaoId,
      tipo,
      descricao,
    }: {
      questaoId: string;
      tipo: TipoProblema;
      descricao: string;
    }) => api.reportarProblema(questaoId, tipo, descricao),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.problemas }),
  });
}

export function useResolverProblema() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.resolverProblema(id),
    onSuccess: () => cliente.invalidateQueries({ queryKey: chaves.problemas }),
  });
}

/**
 * O acervo recortado no concurso em foco.
 *
 * Existe para a regra do recorte morar num lugar só. Cada tela reimplementando
 * "o que pertence a este concurso" é como surgem divergências caladas: o
 * dashboard contando 271 questões enquanto o simulado sorteia de 166.
 *
 * O recorte é pelas **provas do concurso** (`Concurso.provaIds`), e não por um
 * campo `concursoId` na questão, porque é a prova que pertence a um concurso —
 * a questão pertence à prova. `vazio` é verdadeiro quando o concurso existe no
 * catálogo mas não tem nada importado; a tela precisa dizer isso em vez de
 * mostrar zero como se fosse desempenho.
 */
export function useAcervoDoConcurso(concursoId: string) {
  const { disciplinas, carregando: cd } = useDisciplinas(concursoId);
  // O backend já recorta por concurso (ADR-018). O filtro client-side abaixo
  // permanece: é ele que recorta por CARGO (o backend não conhece cargo), e é a
  // defesa quando a resposta vem do mock — filtrar duas vezes é idempotente.
  const { questoes, carregando: cq } = useQuestoes(concursoId);
  const { provas, carregando: cp } = useProvas(concursoId);
  // O concurso vem do catálogo do backend (ADR-015), com fallback no estático.
  const concurso = useConcurso(concursoId);

  return useMemo(() => {
    const idsDeProva = new Set(concurso?.provaIds ?? []);

    const provasDoConcurso = provas.filter((p) => idsDeProva.has(p.id));
    const questoesDoConcurso = questoes.filter((q) => q.provaId && idsDeProva.has(q.provaId));

    // O recorte por CARGO mora aqui, e não em cada tela, porque já me escapou
    // três vezes: as provas de outro cargo do mesmo concurso entram pelos
    // Conhecimentos Básicos e trazem junto as disciplinas exclusivas delas
    // (Informática, Vendas, Matemática Financeira). Toda tela que esquecesse de
    // filtrar ofereceria matéria fora do edital do candidato — e o simulado
    // sortearia questão que ele nunca vai responder na prova.
    const escopoDoCargo = concurso
      ? disciplinasDoCargo(concurso, provasDoConcurso, questoesDoConcurso)
      : new Set<string>();

    const idsDeDisciplina = escopoDoCargo.size
      ? escopoDoCargo
      : new Set(questoesDoConcurso.map((q) => q.disciplinaId));

    const disciplinasDoConcurso = idsDeDisciplina.size
      ? disciplinas.filter((d) => idsDeDisciplina.has(d.id))
      : [];
    const questoesDoCargo = escopoDoCargo.size
      ? questoesDoConcurso.filter((q) => escopoDoCargo.has(q.disciplinaId))
      : questoesDoConcurso;

    return {
      concurso,
      disciplinas: disciplinasDoConcurso,
      questoes: questoesDoCargo,
      provas: provasDoConcurso,
      carregando: cd || cq || cp,
      vazio: !cd && !cq && !cp && questoesDoCargo.length === 0,
    };
  }, [concurso, disciplinas, questoes, provas, cd, cq, cp]);
}
