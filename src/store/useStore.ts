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

/**
 * Estado do pomodoro.
 *
 * Guarda **quando a fase começou**, não quantos segundos faltam. O tempo restante
 * é derivado na leitura (§2.3): gravar o contador faria o timer congelar quando a
 * aba perde o foco e o navegador estrangula os timers, e ainda divergiria entre
 * duas abas abertas. Com o instante de início, qualquer tela chega ao mesmo
 * número sozinha.
 */
export interface Pomodoro {
  fase: "foco" | "pausa";
  /** ISO do início da fase atual. `null` = parado. */
  iniciadoEm: string | null;
  /** Ciclos de foco concluídos, e em que dia — para zerar sozinho na virada. */
  ciclosConcluidos: number;
  diaDosCiclos: string | null;
}

export const DURACAO_POMODORO = { foco: 25 * 60, pausa: 5 * 60 } as const;

interface StoreState {
  dataProva: string; // ISO
  metaDiaria: number;
  darkMode: boolean;
  concursoAtivoId: string;
  pomodoro: Pomodoro;
  editalStatus: EditalStatus;
  historico: RespostaHistorico[];
  revisoes: RevisaoItem[];
  streak: { ultimoDia: string | null; dias: number };

  definirConcursoAtivo: (id: string) => void;
  iniciarPomodoro: (fase: "foco" | "pausa") => void;
  pararPomodoro: () => void;
  alternarFasePomodoro: () => void;
  concluirFasePomodoro: () => void;
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
  pomodoro: Pomodoro;
}> &
  Record<string, unknown>;

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      dataProva: new Date(2026, 9, 25).toISOString(),
      metaDiaria: 20,
      darkMode: false,
      concursoAtivoId: CONCURSO_PADRAO,
      pomodoro: { fase: "foco", iniciadoEm: null, ciclosConcluidos: 0, diaDosCiclos: null },
      editalStatus: {},
      historico: [],
      revisoes: initialRevisoes,
      streak: { ultimoDia: null, dias: 0 },

      definirConcursoAtivo: (id) => set({ concursoAtivoId: id }),

      iniciarPomodoro: (fase) =>
        set({ pomodoro: { ...get().pomodoro, fase, iniciadoEm: new Date().toISOString() } }),
      pararPomodoro: () => set({ pomodoro: { ...get().pomodoro, iniciadoEm: null } }),
      // Troca manual de fase. Não conta ciclo: pular o foco pela metade não é
      // um ciclo cumprido, e inflar esse número tornaria o contador do dia
      // inútil como medida de estudo.
      alternarFasePomodoro: () =>
        set((s) => ({
          pomodoro: {
            ...s.pomodoro,
            fase: s.pomodoro.fase === "foco" ? "pausa" : "foco",
            iniciadoEm: null,
          },
        })),
      concluirFasePomodoro: () =>
        set((s) => {
          const hoje = new Date().toISOString().slice(0, 10);
          const virouODia = s.pomodoro.diaDosCiclos !== hoje;
          const foiFoco = s.pomodoro.fase === "foco";
          return {
            pomodoro: {
              // Alterna sozinho, mas não inicia a próxima fase: quem decide
              // quando a pausa começa é o usuário, não o relógio.
              fase: foiFoco ? "pausa" : "foco",
              iniciadoEm: null,
              ciclosConcluidos: foiFoco
                ? virouODia
                  ? 1
                  : s.pomodoro.ciclosConcluidos + 1
                : s.pomodoro.ciclosConcluidos,
              diaDosCiclos: foiFoco ? hoje : s.pomodoro.diaDosCiclos,
            },
          };
        }),
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
          // Estado gravado antes do pomodoro existir não tem esse campo; sem o
          // padrão aqui a tela quebraria ao ler `pomodoro.fase` de undefined.
          pomodoro: p.pomodoro ?? atual.pomodoro,
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
