/**
 * Motor de sincronização do progresso (ADR-021).
 *
 * Regras que o desenho inteiro serve:
 * - **Pull aplica com supressão de push**: aplicar o progresso do servidor
 *   dispara o subscribe do store; sem a supressão, o pull empurraria de volta
 *   o mesmo dado que acabou de baixar.
 * - **Push nunca sobrescreve calado**: todo PUT vai com a `base` (o
 *   `atualizadoEm` que este dispositivo conhece). 409 = outro dispositivo
 *   salvou depois → o estado vira `conflito` e o USUÁRIO escolhe (o contrato
 *   do backup sempre foi "substitui, não mescla").
 * - Debounce de 4 s: responder 20 questões seguidas vira um PUT, não vinte.
 */

import { create } from "zustand";

import { limparSessao, sessaoAtual } from "@/lib/conta";
import { progressoDoEstado, type Backup } from "@/lib/backup";
import { contaApi } from "@/services";
import { useStore } from "@/store/useStore";

const DEBOUNCE_MS = 4000;

type EstadoSync = "deslogado" | "ocioso" | "sincronizando" | "conflito" | "erro";

interface SyncStore {
  estado: EstadoSync;
  email: string | null;
  ultimaSync: string | null; // ISO local de quando o último push/pull terminou
  mensagem: string | null;
  /** Carimbo do servidor que este dispositivo conhece — a `base` do próximo PUT. */
  base: string | null;
}

/** Estado do sync para a UI. Não persiste: é situação, não fato. */
export const useSyncStore = create<SyncStore>(() => ({
  estado: sessaoAtual() ? "ocioso" : "deslogado",
  email: sessaoAtual()?.email ?? null,
  ultimaSync: null,
  mensagem: null,
  base: null,
}));

let timer: ReturnType<typeof setTimeout> | null = null;
let aplicandoServidor = false;
let assinaturaIniciada = false;
let ultimaFoto = "";

function fotoAtual(): Backup["progresso"] {
  return progressoDoEstado(useStore.getState());
}

/** Aplica progresso vindo do servidor sem disparar push do próprio pull. */
function aplicarDoServidor(progresso: Backup["progresso"]) {
  aplicandoServidor = true;
  try {
    useStore.getState().aplicarBackup(progresso);
    ultimaFoto = JSON.stringify(fotoAtual());
  } finally {
    aplicandoServidor = false;
  }
}

async function empurrar(opcoes: { force?: boolean } = {}): Promise<void> {
  const sessao = sessaoAtual();
  if (!sessao) return;
  const { base } = useSyncStore.getState();
  useSyncStore.setState({ estado: "sincronizando", mensagem: null });
  try {
    const foto = fotoAtual();
    const resultado = await contaApi.salvarProgresso(sessao.token, foto, {
      base,
      force: opcoes.force,
    });
    ultimaFoto = JSON.stringify(foto);
    useSyncStore.setState({
      estado: "ocioso",
      base: resultado.atualizadoEm,
      ultimaSync: new Date().toISOString(),
    });
  } catch (erro) {
    const e = erro as Error & { status?: number };
    if (e.status === 409) {
      useSyncStore.setState({
        estado: "conflito",
        mensagem: "Outro dispositivo salvou progresso mais recente.",
      });
      return;
    }
    if (e.status === 401) {
      // Token revogado (saiu em outro dispositivo): vira estado deslogado em
      // vez de tentar para sempre.
      limparSessao();
      useSyncStore.setState({ estado: "deslogado", email: null, mensagem: null });
      return;
    }
    useSyncStore.setState({ estado: "erro", mensagem: e.message });
  }
}

/** Baixa o progresso do servidor e APLICA por cima do local (escolha explícita). */
export async function usarProgressoDoServidor(): Promise<void> {
  const sessao = sessaoAtual();
  if (!sessao) return;
  useSyncStore.setState({ estado: "sincronizando", mensagem: null });
  const servidor = await contaApi.obterProgresso(sessao.token);
  if (servidor.progresso) aplicarDoServidor(servidor.progresso);
  useSyncStore.setState({
    estado: "ocioso",
    base: servidor.atualizadoEm,
    ultimaSync: new Date().toISOString(),
  });
}

/** Sobrescreve o servidor com o local (escolha explícita — resolve conflito). */
export async function usarProgressoLocal(): Promise<void> {
  await empurrar({ force: true });
}

export function sincronizarAgora(): Promise<void> {
  if (timer) clearTimeout(timer);
  return empurrar();
}

function agendarPush() {
  if (aplicandoServidor || !sessaoAtual()) return;
  // Só agenda se o progresso de fato mudou — dark mode e pomodoro ficam fora
  // do sync (ADR-021) e não devem acordar a rede.
  const foto = JSON.stringify(fotoAtual());
  if (foto === ultimaFoto) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void empurrar(), DEBOUNCE_MS);
}

/** Liga o push automático. Idempotente — o AppLayout chama uma vez por carga. */
export function iniciarAutoSync(): void {
  if (assinaturaIniciada || typeof window === "undefined") return;
  assinaturaIniciada = true;
  ultimaFoto = JSON.stringify(fotoAtual());
  useStore.subscribe(agendarPush);
  // Fechar a aba com push pendente: tenta na hora (melhor esforço).
  window.addEventListener("pagehide", () => {
    if (timer) {
      clearTimeout(timer);
      void empurrar();
    }
  });
}

/**
 * Fluxo pós-login (ADR-021): decide entre subir o local, aplicar o do servidor
 * ou devolver o conflito para o usuário escolher.
 */
export async function aoEntrar(email: string): Promise<"aplicado" | "enviado" | "conflito"> {
  useSyncStore.setState({ email, estado: "sincronizando", mensagem: null });
  const sessao = sessaoAtual();
  if (!sessao) throw new Error("sessão não gravada");

  const servidor = await contaApi.obterProgresso(sessao.token);
  useSyncStore.setState({ base: servidor.atualizadoEm });

  const local = fotoAtual();
  const localVazio =
    local.historico.length === 0 &&
    local.revisoes.length === 0 &&
    Object.keys(local.editalStatus).length === 0;

  if (!servidor.progresso) {
    await empurrar({ force: true });
    return "enviado";
  }
  if (localVazio) {
    aplicarDoServidor(servidor.progresso);
    useSyncStore.setState({ estado: "ocioso", ultimaSync: new Date().toISOString() });
    return "aplicado";
  }
  // Dois progressos reais: ninguém decide isso por você (substitui, não mescla).
  useSyncStore.setState({
    estado: "conflito",
    mensagem: "Há progresso salvo na conta E neste navegador. Escolha qual vale.",
  });
  return "conflito";
}

export function aoSair(): void {
  if (timer) clearTimeout(timer);
  ultimaFoto = "";
  useSyncStore.setState({
    estado: "deslogado",
    email: null,
    base: null,
    ultimaSync: null,
    mensagem: null,
  });
}
