import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { RespostaHistorico, RevisaoItem, StatusTopico } from "@/types";

type EditalStatus = Record<string, StatusTopico>; // subtopicoId -> status

interface StoreState {
  dataProva: string; // ISO
  metaDiaria: number;
  darkMode: boolean;
  editalStatus: EditalStatus;
  historico: RespostaHistorico[];
  revisoes: RevisaoItem[];
  streak: { ultimoDia: string | null; dias: number };

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
  { id: "r1", topico: "APIs REST", disciplinaId: "ti", proximaRevisao: new Date(Date.now() - 86400000).toISOString(), intervaloAtual: 7 },
  { id: "r2", topico: "Pix e Open Finance", disciplinaId: "bancarios", proximaRevisao: new Date(Date.now() + 2 * 86400000).toISOString(), intervaloAtual: 7 },
  { id: "r3", topico: "SQL avançado", disciplinaId: "ti", proximaRevisao: new Date(Date.now() + 5 * 86400000).toISOString(), intervaloAtual: 15 },
  { id: "r4", topico: "Concordância verbal", disciplinaId: "portugues", proximaRevisao: new Date(Date.now() - 2 * 86400000).toISOString(), intervaloAtual: 1 },
];

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      dataProva: new Date(2026, 9, 25).toISOString(),
      metaDiaria: 20,
      darkMode: false,
      editalStatus: {},
      historico: [],
      revisoes: initialRevisoes,
      streak: { ultimoDia: null, dias: 0 },

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
    { name: "foco-bb-store" },
  ),
);
