import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RespostaHistorico, RevisaoItem, StatusTopico } from "@/types";

type EditalStatus = Record<string, StatusTopico>; // subtopicoId -> status

/**
 * O concurso que existia antes do app virar multi-concurso. Todo registro já
 * gravado no navegador de quem usava o app é dele — é o valor que a migração
 * usa para preencher o `concursoId` que esses registros não têm.
 */
export const CONCURSO_PADRAO = "bb-ti-2026";

interface StoreState {
  dataProva: string; // ISO
  metaDiaria: number;
  darkMode: boolean;
  concursoAtivoId: string;
  editalStatus: EditalStatus;
  historico: RespostaHistorico[];
  revisoes: RevisaoItem[];
  streak: { ultimoDia: string | null; dias: number };

  definirConcursoAtivo: (id: string) => void;
  setDataProva: (d: string) => void;
  setMeta: (n: number) => void;
  toggleDark: () => void;
  toggleStatus: (subtopicoId: string, campo: keyof StatusTopico) => void;
  registrarResposta: (r: RespostaHistorico) => void;
  addRevisao: (r: RevisaoItem) => void;
  marcarRevisada: (id: string) => void;
  reset: () => void;
}

const proximoIntervalo = (atual: 1 | 7 | 15 | 30): 1 | 7 | 15 | 30 => {
  if (atual === 1) return 7;
  if (atual === 7) return 15;
  return 30;
};

const initialRevisoes: RevisaoItem[] = [
  {
    id: "r1",
    topico: "APIs REST",
    disciplinaId: "ti",
    concursoId: CONCURSO_PADRAO,
    proximaRevisao: new Date(Date.now() - 86400000).toISOString(),
    intervaloAtual: 7,
  },
  {
    id: "r2",
    topico: "Pix e Open Finance",
    disciplinaId: "bancarios",
    concursoId: CONCURSO_PADRAO,
    proximaRevisao: new Date(Date.now() + 2 * 86400000).toISOString(),
    intervaloAtual: 7,
  },
  {
    id: "r3",
    topico: "SQL avançado",
    disciplinaId: "ti",
    concursoId: CONCURSO_PADRAO,
    proximaRevisao: new Date(Date.now() + 5 * 86400000).toISOString(),
    intervaloAtual: 15,
  },
  {
    id: "r4",
    topico: "Concordância verbal",
    disciplinaId: "portugues",
    concursoId: CONCURSO_PADRAO,
    proximaRevisao: new Date(Date.now() - 2 * 86400000).toISOString(),
    intervaloAtual: 1,
  },
];

/**
 * Estado gravado por uma versão anterior do app: tudo que a migração precisa
 * tolerar. Os campos são opcionais porque a v0 não tinha `concursoId` em lugar
 * nenhum, e `unknown` seria pior — obrigaria cast a cada acesso.
 */
type EstadoPersistidoAntigo = Partial<{
  historico: Partial<RespostaHistorico>[];
  revisoes: Partial<RevisaoItem>[];
  concursoAtivoId: string;
}> &
  Record<string, unknown>;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      dataProva: new Date(2026, 9, 25).toISOString(),
      metaDiaria: 20,
      darkMode: false,
      concursoAtivoId: CONCURSO_PADRAO,
      editalStatus: {},
      historico: [],
      revisoes: initialRevisoes,
      streak: { ultimoDia: null, dias: 0 },

      definirConcursoAtivo: (id) => set({ concursoAtivoId: id }),
      setDataProva: (d) => set({ dataProva: d }),
      setMeta: (n) => set({ metaDiaria: n }),
      toggleDark: () => {
        const next = !get().darkMode;
        set({ darkMode: next });
        if (typeof document !== "undefined") {
          document.documentElement.classList.toggle("dark", next);
        }
      },
      toggleStatus: (subId, campo) =>
        set((s) => {
          const cur = s.editalStatus[subId] ?? { teoria: false, revisao: false, questoes: false };
          return { editalStatus: { ...s.editalStatus, [subId]: { ...cur, [campo]: !cur[campo] } } };
        }),
      registrarResposta: (r) =>
        set((s) => {
          const hoje = new Date().toISOString().slice(0, 10);
          const ultimo = s.streak.ultimoDia;
          let dias = s.streak.dias;
          if (ultimo !== hoje) {
            const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            dias = ultimo === ontem ? dias + 1 : 1;
          }
          return {
            historico: [...s.historico, r],
            streak: { ultimoDia: hoje, dias },
          };
        }),
      addRevisao: (r) => set((s) => ({ revisoes: [...s.revisoes, r] })),
      marcarRevisada: (id) =>
        set((s) => ({
          revisoes: s.revisoes.map((r) => {
            if (r.id !== id) return r;
            const novo = proximoIntervalo(r.intervaloAtual);
            return {
              ...r,
              intervaloAtual: novo,
              proximaRevisao: new Date(Date.now() + novo * 86400000).toISOString(),
            };
          }),
        })),
      reset: () =>
        set({
          editalStatus: {},
          historico: [],
          revisoes: initialRevisoes,
          streak: { ultimoDia: null, dias: 0 },
        }),
    }),
    {
      name: "foco-bb-store",
      // v1: chegada do multi-concurso. Quem já usava o app tem histórico e
      // revisões sem `concursoId`; sem esta migração esses registros ficariam
      // fora de qualquer filtro por concurso e o progresso sumiria da tela —
      // presente no localStorage, invisível no app, que é o pior dos dois mundos.
      version: 1,
      // A normalização mora no `merge`, e não no `migrate`, por um detalhe do
      // zustand que só aparece em quem já usava o app: ele só chama `migrate`
      // quando o valor gravado tem `version` NUMÉRICO —
      //
      //     if (typeof valorGravado.version === 'number' && valorGravado.version !== options.version)
      //
      // A build anterior não declarava `version`, então gravou `{version: undefined}`
      // e o `JSON.stringify` apagou a chave. Para esses registros o `migrate`
      // nunca roda, e o `concursoId` nunca chegaria — o progresso continuaria no
      // disco, mas invisível para qualquer filtro por concurso.
      //
      // `merge` roda em toda hidratação, com ou sem `version`, então é o único
      // ponto que alcança os dois casos.
      merge: (persistido, atual) => {
        const p = (persistido ?? {}) as EstadoPersistidoAntigo;
        const comConcurso = <T extends { concursoId?: string }>(itens: T[]) =>
          itens.map((item) => ({ ...item, concursoId: item.concursoId ?? CONCURSO_PADRAO }));

        return {
          ...atual,
          ...(p as object),
          concursoAtivoId: p.concursoAtivoId ?? CONCURSO_PADRAO,
          historico: comConcurso(p.historico ?? []),
          revisoes: comConcurso(p.revisoes ?? atual.revisoes),
        } as StoreState;
      },
      // Mantido para as próximas mudanças de formato: a partir da v1 o `version`
      // existe no disco, então daqui em diante o `migrate` funciona normalmente.
      migrate: (estado) => estado as StoreState,
    },
  ),
);
