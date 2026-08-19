import type { CadernoSalvo, CartaoProprio, SrsDoCartao, TentativaProva } from "@/store/useStore";
import type { RespostaHistorico, RevisaoItem, StatusTopico } from "@/types";

/**
 * Exportação e importação do progresso.
 *
 * Existe porque todo o progresso vive no localStorage: limpar o navegador,
 * trocar de máquina ou usar aba anônima apaga meses de estudo sem aviso e sem
 * recuperação. Enquanto não houver conta e servidor, um arquivo que o usuário
 * guarda é a única rede de proteção honesta.
 *
 * O acervo (questões, aulas, edital) **não** entra no arquivo: aquilo vive no
 * backend e se reconstrói pelos comandos de importação. Aqui vai só o que é
 * insubstituível — o que a pessoa fez.
 */

// v2: campos da linha Ciclo de Estudo (cadernos, tentativas de prova, SRS de
// flashcard, cartões próprios, anotações). Arquivo v1 continua importável — os
// campos que ele não tem entram vazios.
export const VERSAO_BACKUP = 2;

export interface Backup {
  formato: "foco-concursos-backup";
  versao: number;
  exportadoEm: string;
  progresso: {
    concursoAtivoId: string;
    dataProva: string;
    metaDiaria: number;
    editalStatus: Record<string, StatusTopico>;
    historico: RespostaHistorico[];
    revisoes: RevisaoItem[];
    streak: { ultimoDia: string | null; dias: number };
    cadernos: CadernoSalvo[];
    tentativasProva: TentativaProva[];
    flashcardsSrs: Record<string, SrsDoCartao>;
    cartoesProprios: CartaoProprio[];
    anotacoes: Record<string, string>;
  };
}

/** O que sai no arquivo. Recebe o estado do store e devolve JSON legível. */
export function montarBackup(progresso: Backup["progresso"]): string {
  const backup: Backup = {
    formato: "foco-concursos-backup",
    versao: VERSAO_BACKUP,
    exportadoEm: new Date().toISOString(),
    progresso,
  };
  // Indentado de propósito: o arquivo é do usuário, e ele precisa poder abrir e
  // conferir o que está levando embora.
  return JSON.stringify(backup, null, 2);
}

export class ErroDeBackup extends Error {}

/**
 * Valida e devolve o progresso de um arquivo.
 *
 * Rejeita em vez de aceitar o que não reconhece: importar um JSON qualquer
 * sobrescreveria o progresso real com lixo, e o estrago seria justamente o que
 * esta feature existe para evitar.
 */
export function lerBackup(texto: string): Backup["progresso"] {
  let dados: unknown;
  try {
    dados = JSON.parse(texto);
  } catch {
    throw new ErroDeBackup("O arquivo não é um JSON válido.");
  }

  const b = dados as Partial<Backup>;
  if (b?.formato !== "foco-concursos-backup") {
    throw new ErroDeBackup(
      "Este arquivo não é um backup deste app. Nada foi alterado no seu progresso.",
    );
  }
  if (typeof b.versao !== "number" || b.versao > VERSAO_BACKUP) {
    throw new ErroDeBackup(
      `O arquivo foi gerado por uma versão mais nova do app (v${b.versao}). Atualize antes de importar.`,
    );
  }

  const p = b.progresso;
  if (!p || !Array.isArray(p.historico) || !Array.isArray(p.revisoes)) {
    throw new ErroDeBackup("O arquivo está incompleto: falta histórico ou revisões.");
  }

  return {
    concursoAtivoId: p.concursoAtivoId,
    dataProva: p.dataProva,
    metaDiaria: p.metaDiaria,
    editalStatus: p.editalStatus ?? {},
    historico: p.historico,
    revisoes: p.revisoes,
    streak: p.streak ?? { ultimoDia: null, dias: 0 },
    // Arquivo v1 não tem estes campos (§2.4): entram vazios, coerente com o
    // contrato de importação — substitui, não mescla.
    cadernos: p.cadernos ?? [],
    tentativasProva: p.tentativasProva ?? [],
    flashcardsSrs: p.flashcardsSrs ?? {},
    cartoesProprios: p.cartoesProprios ?? [],
    anotacoes: p.anotacoes ?? {},
  };
}

/** Nome do arquivo com a data, para backups sucessivos não se sobrescreverem. */
export function nomeDoArquivo(): string {
  return `foco-progresso-${new Date().toISOString().slice(0, 10)}.json`;
}
