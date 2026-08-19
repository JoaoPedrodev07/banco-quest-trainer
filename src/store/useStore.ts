import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  adiarRevisao as adiarNaLista,
  agendarOuRegredir,
  avancarRevisao,
  semRevisoesDeDemonstracao,
} from "@/lib/revisao";
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
  /** ISO de quando o relógio voltou a correr. `null` = pausado. */
  iniciadoEm: string | null;
  /**
   * Segundos já cumpridos da fase antes da pausa atual.
   *
   * Sem isto, pausar perdia o tempo decorrido e o timer recomeçava do zero —
   * "Pausar" virava "Zerar". O tempo restante é `duração - (acumulado + tempo
   * desde iniciadoEm)`, o que mantém a leitura derivada e resistente ao
   * estrangulamento de timer da aba em segundo plano.
   */
  acumuladoSegundos: number;
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
  /**
   * Grava como o candidato avaliou o próprio raciocínio depois de ver o gabarito.
   *
   * Separado de `registrarResposta` porque acontece **depois** dela, por
   * desenho: o raciocínio é escrito antes do gabarito aparecer (senão vira
   * justificativa da resposta certa, não raciocínio), e a nota só pode ser dada
   * depois. Duas gravações, dois momentos.
   */
  avaliarRaciocinio: (
    questaoId: string,
    concursoId: string,
    nota: "bateu" | "torto" | "chutei",
  ) => void;
  addRevisao: (r: RevisaoItem) => void;
  /**
   * Agenda revisão de uma unidade do edital por causa de um erro — ou, se a
   * agenda já existe, **regride o intervalo para 1 dia** (ADR-003).
   *
   * É o gatilho que faltava: a agenda existia mas só era preenchida à mão, e
   * revisão que depende de o usuário lembrar de cadastrar é revisão que não
   * acontece. Erro é o sinal mais barato e mais confiável de que o assunto não
   * está fixado — inclusive quando a agenda diz que ele estaria a 30 dias.
   */
  agendarRevisaoPorErro: (dados: {
    unidadeId: string;
    topico: string;
    disciplinaId: string;
    concursoId: string;
  }) => void;
  marcarRevisada: (id: string) => void;
  /** Empurra a revisão para daqui a `dias`, sem mexer na escada de intervalos. */
  adiarRevisao: (id: string, dias: number) => void;
  /** Remove a revisão. Ela volta sozinha no próximo erro do assunto. */
  removerRevisao: (id: string) => void;
  /**
   * Substitui o progresso pelo de um backup.
   *
   * Substitui em vez de mesclar: mesclar dois históricos duplicaria respostas e
   * inflaria o streak, e o usuário não teria como saber quais números passaram a
   * ser inventados. A tela avisa que é substituição antes de chamar.
   */
  aplicarBackup: (progresso: {
    concursoAtivoId: string;
    dataProva: string;
    metaDiaria: number;
    editalStatus: EditalStatus;
    historico: RespostaHistorico[];
    revisoes: RevisaoItem[];
    streak: { ultimoDia: string | null; dias: number };
  }) => void;
  reset: () => void;
}

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
      pomodoro: {
        fase: "foco",
        iniciadoEm: null,
        acumuladoSegundos: 0,
        ciclosConcluidos: 0,
        diaDosCiclos: null,
      },
      editalStatus: {},
      historico: [],
      // Nasce vazia (ADR-003): as revisões de demonstração do protótipo faziam
      // todo usuário novo ver agenda que ele nunca criou.
      revisoes: [],
      streak: { ultimoDia: null, dias: 0 },

      definirConcursoAtivo: (id) => set({ concursoAtivoId: id }),

      iniciarPomodoro: (fase) =>
        set((s) => ({
          pomodoro: {
            ...s.pomodoro,
            fase,
            // Trocar de fase começa do zero; retomar a mesma fase mantém o que já
            // foi cumprido.
            acumuladoSegundos: fase === s.pomodoro.fase ? s.pomodoro.acumuladoSegundos : 0,
            iniciadoEm: new Date().toISOString(),
          },
        })),

      pararPomodoro: () =>
        set((s) => {
          if (!s.pomodoro.iniciadoEm) return s;
          const decorrido = Math.floor(
            (Date.now() - new Date(s.pomodoro.iniciadoEm).getTime()) / 1000,
          );
          return {
            pomodoro: {
              ...s.pomodoro,
              acumuladoSegundos: s.pomodoro.acumuladoSegundos + Math.max(0, decorrido),
              iniciadoEm: null,
            },
          };
        }),
      // Troca manual de fase. Não conta ciclo: pular o foco pela metade não é
      // um ciclo cumprido, e inflar esse número tornaria o contador do dia
      // inútil como medida de estudo.
      alternarFasePomodoro: () =>
        set((s) => ({
          pomodoro: {
            ...s.pomodoro,
            fase: s.pomodoro.fase === "foco" ? "pausa" : "foco",
            iniciadoEm: null,
            acumuladoSegundos: 0,
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
              // Fase nova nasce zerada; sem isto ela já começaria vencida.
              acumuladoSegundos: 0,
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
      avaliarRaciocinio: (questaoId, concursoId, nota) =>
        set((s) => {
          // Atualiza a resposta mais recente daquela questão, não todas: refazer
          // a mesma questão depois é comum, e reescrever o passado apagaria
          // justamente a evidência de que o entendimento mudou.
          let alvo = -1;
          for (let i = s.historico.length - 1; i >= 0; i--) {
            const h = s.historico[i];
            if (h.questaoId === questaoId && h.concursoId === concursoId) {
              alvo = i;
              break;
            }
          }
          if (alvo < 0) return {};
          const historico = [...s.historico];
          historico[alvo] = { ...historico[alvo], autoavaliacao: nota };
          return { historico };
        }),

      addRevisao: (r) => set((s) => ({ revisoes: [...s.revisoes, r] })),

      // A regra mora em `lib/revisao.ts` (funções puras, com teste); aqui só se
      // aplica o resultado. Errar assunto já agendado REGRIDE para 1 dia.
      agendarRevisaoPorErro: (dados) =>
        set((s) => ({ revisoes: agendarOuRegredir(s.revisoes, dados, new Date()) })),
      marcarRevisada: (id) =>
        set((s) => ({ revisoes: avancarRevisao(s.revisoes, id, new Date()) })),
      adiarRevisao: (id, dias) =>
        set((s) => ({ revisoes: adiarNaLista(s.revisoes, id, dias, new Date()) })),
      removerRevisao: (id) =>
        set((s) => ({ revisoes: s.revisoes.filter((r) => r.id !== id) })),
      aplicarBackup: (progresso) => set({ ...progresso }),

      reset: () =>
        set({
          editalStatus: {},
          historico: [],
          revisoes: [],
          streak: { ultimoDia: null, dias: 0 },
        }),
    }),
    {
      name: "foco-bb-store",
      // v1: chegada do multi-concurso. Quem já usava o app tem histórico e
      // revisões sem `concursoId`; sem esta migração esses registros ficariam
      // fora de qualquer filtro por concurso e o progresso sumiria da tela —
      // presente no localStorage, invisível no app, que é o pior dos dois mundos.
      // v2: remoção das revisões de demonstração do protótipo (ADR-003). A
      // remoção em si roda no `merge` (ver abaixo o porquê); o bump documenta a
      // mudança de conteúdo do que está no disco.
      version: 2,
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
          // `acumuladoSegundos` não existia antes; sem o padrão, o cálculo do
          // tempo restante viraria NaN e o timer mostraria "NaN:NaN".
          pomodoro: { ...atual.pomodoro, ...(p.pomodoro ?? {}) },
          historico: comConcurso(p.historico ?? []),
          // As demos saem aqui, e não no `migrate`, pelo mesmo motivo do
          // concursoId acima: registro gravado sem `version` numérico nunca
          // passa pelo migrate, e é justamente o registro mais antigo — o que
          // certamente tem as demos. A remoção é idempotente (id + tópico
          // exatos), então rodar em toda hidratação não custa nada.
          revisoes: semRevisoesDeDemonstracao(
            comConcurso(p.revisoes ?? atual.revisoes) as RevisaoItem[],
          ),
        } as StoreState;
      },
      // Mantido para as próximas mudanças de formato: a partir da v1 o `version`
      // existe no disco, então daqui em diante o `migrate` funciona normalmente.
      migrate: (estado) => estado as StoreState,
    },
  ),
);
