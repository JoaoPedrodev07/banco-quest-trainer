/**
 * Sessão de conta no cliente (ADR-021).
 *
 * O token vive numa chave PRÓPRIA do localStorage, fora do `foco-bb-store`:
 * o progresso é sincronizável e substituível; a credencial não — importar um
 * backup ou resetar o progresso não pode deslogar ninguém.
 */

const CHAVE = "foco-bb-conta";

export interface SessaoConta {
  token: string;
  email: string;
}

export function sessaoAtual(): SessaoConta | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<SessaoConta>;
    return dados.token && dados.email ? { token: dados.token, email: dados.email } : null;
  } catch {
    return null;
  }
}

export function guardarSessao(sessao: SessaoConta): void {
  localStorage.setItem(CHAVE, JSON.stringify(sessao));
}

export function limparSessao(): void {
  localStorage.removeItem(CHAVE);
}
