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
import type { Aula, Disciplina, Prova, Questao } from "@/types";

const SEM_DISCIPLINAS: Disciplina[] = [];
const SEM_QUESTOES: Questao[] = [];
const SEM_PROVAS: Prova[] = [];

export function useDisciplinas() {
  const consulta = useQuery({ queryKey: chaves.disciplinas, queryFn: api.listDisciplinas });
  return { disciplinas: consulta.data ?? SEM_DISCIPLINAS, carregando: consulta.isPending };
}

export function useQuestoes() {
  const consulta = useQuery({ queryKey: chaves.questoes, queryFn: api.listQuestoes });
  return { questoes: consulta.data ?? SEM_QUESTOES, carregando: consulta.isPending };
}

export function useProvas() {
  const consulta = useQuery({ queryKey: chaves.provas, queryFn: api.listProvas });
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
