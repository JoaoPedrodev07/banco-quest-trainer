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

import { useQuery } from "@tanstack/react-query";

import { api, chaves } from "@/services";
import type { Disciplina, Prova, Questao } from "@/types";

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
