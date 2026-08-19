/**
 * A costura entre as telas e os dados.
 *
 * Esta camada existe para que a origem do conteúdo seja decisão de um lugar só.
 * Ela tenta o backend (`VITE_API_URL`, padrão `http://localhost:8000/api`) e, se
 * ele não responder, cai nos mocks de `src/data/` — o app continua utilizável
 * offline, que é como ele nasceu.
 *
 * A queda para mock é **silenciosa nos dados, mas não na tela**: `acervo()`
 * devolve `online: false`, e é obrigação de quem exibe avisar que aquilo é
 * amostra. Conteúdo de exemplo apresentado como se fosse da banca é a forma mais
 * fácil de este app fazer alguém estudar errado (§2.2 do CLAUDE.md).
 */

import { CONCURSO_PADRAO } from "@/store/useStore";
import { disciplinas as disciplinasMock } from "@/data/disciplinas";
import { provas as provasMock } from "@/data/provas";
import { questoes as questoesMock } from "@/data/questoes";
import type { Acervo, Aula, ClassificacaoRevisao, Disciplina, Prova, Questao } from "@/types";

const BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:8000/api")
  .trim()
  .replace(/\/+$/, "");

// Curto de propósito: se o backend não está de pé, o usuário não pode ficar
// olhando tela vazia enquanto o navegador espera o timeout de rede.
const TIMEOUT_MS = 4000;

async function buscar<T>(caminho: string): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resposta.ok) {
    throw new Error(`GET ${caminho} devolveu HTTP ${resposta.status}`);
  }
  return (await resposta.json()) as T;
}

/** Resposta paginada do DRF. */
interface Pagina<T> {
  count: number;
  next: string | null;
  results: T[];
}

function ehPaginada<T>(valor: unknown): valor is Pagina<T> {
  return typeof valor === "object" && valor !== null && Array.isArray((valor as Pagina<T>).results);
}

/**
 * Busca uma coleção inteira, seguindo a paginação do backend.
 *
 * O simulado sorteia, filtra e ordena do lado do cliente, então ele precisa mesmo
 * de todas as questões do concurso — o que a paginação muda é que elas vêm em
 * partes, e não numa resposta de 1,6 MB.
 *
 * Aceita as duas formas de propósito: lista pura (como a API respondia antes, e
 * como os endpoints pequenos ainda podem responder) e objeto paginado. Assim o
 * frontend não quebra se subir contra um backend de versão diferente — que é
 * exatamente o cenário em que a queda para mock seria silenciosa e confusa.
 *
 * O teto de páginas existe para um `next` que aponte para si mesmo não virar
 * laço infinito no navegador do usuário.
 */
const MAX_PAGINAS = 50;

async function buscarTudo<T>(caminho: string): Promise<T[]> {
  const primeira = await buscar<T[] | Pagina<T>>(caminho);
  if (Array.isArray(primeira)) return primeira;
  if (!ehPaginada<T>(primeira)) return [];

  const itens = [...primeira.results];
  let proxima = primeira.next;
  let paginas = 1;

  while (proxima && paginas < MAX_PAGINAS) {
    // O `next` do DRF vem absoluto; `buscar` monta a URL a partir de BASE, então
    // aqui a chamada é direta.
    const resposta = await fetch(proxima, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resposta.ok) throw new Error(`GET ${proxima} devolveu HTTP ${resposta.status}`);
    const pagina = (await resposta.json()) as Pagina<T>;
    itens.push(...pagina.results);
    proxima = pagina.next;
    paginas += 1;
  }

  if (proxima) {
    console.warn(
      `[services] parei em ${MAX_PAGINAS} páginas de ${caminho}; a lista pode estar incompleta.`,
    );
  }
  return itens;
}

/**
 * POST para os endpoints de escrita.
 *
 * Diferente das leituras, aqui **não há reserva**: uma escrita que falha em
 * silêncio faria o usuário acreditar que a aula foi salva e perder o texto que
 * colou. O erro sobe para a tela decidir o que dizer.
 */
async function enviar<T>(caminho: string, corpo: unknown): Promise<T> {
  const resposta = await fetch(`${BASE}${caminho}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!resposta.ok) {
    const detalhe = await resposta.text().catch(() => "");
    throw new Error(`POST ${caminho} devolveu HTTP ${resposta.status}. ${detalhe.slice(0, 300)}`);
  }
  return (await resposta.json()) as T;
}

/**
 * Busca uma coleção com queda para mock, percorrendo todas as páginas.
 *
 * Substituiu a versão de valor único quando a API passou a paginar: todos os
 * consumidores desta camada pedem coleção, e manter as duas deixaria uma delas
 * sem uso e pronta para ser escolhida por engano — voltando a ler só a primeira
 * página sem que nada acusasse.
 */
async function comReservaLista<T>(caminho: string, reserva: T[]): Promise<T[]> {
  try {
    return await buscarTudo<T>(caminho);
  } catch (erro) {
    console.warn(`[services] backend indisponível em ${BASE}${caminho}; usando mocks.`, erro);
    return reserva;
  }
}

/** Retrato do acervo quando o backend não responde: o que existe em `src/data/`. */
function acervoLocal(): Acervo {
  return {
    online: false,
    questoes: {
      total: questoesMock.length,
      oficiais: 0,
      amostra: questoesMock.length,
      anuladas: 0,
    },
    disciplinas: disciplinasMock.length,
    provas: provasMock.length,
    editalVigente: { titulo: null, url: null, tipo: null },
  };
}

/**
 * O backend ainda é de um concurso só: ele não conhece `concursoId` e não devolve
 * esse campo. Carimbar aqui mantém a promessa da camada — as telas recebem o
 * formato final e não precisam saber que o servidor está atrasado em relação ao
 * app. Quando o backend ganhar concursos, some este `map` e nada mais muda.
 */
function comConcurso<T>(itens: T[], concursoId: string): T[] {
  return itens.map((item) => ({ concursoId, ...item }));
}

export const api = {
  // A árvore de tópicos é por edital: o backend precisa saber qual concurso
  // devolver, senão manda as árvores de todos misturadas.
  listDisciplinas: async (concursoId: string = CONCURSO_PADRAO) =>
    comConcurso(
      await comReservaLista<Disciplina>(
        `/disciplinas/?concursoId=${encodeURIComponent(concursoId)}`,
        disciplinasMock,
      ),
      concursoId,
    ),
  listQuestoes: () => comReservaLista<Questao>("/questoes/", questoesMock),
  listProvas: async () =>
    comConcurso(await comReservaLista<Prova>("/provas/", provasMock), CONCURSO_PADRAO),

  async acervo(): Promise<Acervo> {
    try {
      const meta = await buscar<Omit<Acervo, "online">>("/meta/");
      return { ...meta, online: true };
    } catch {
      return acervoLocal();
    }
  },

  /**
   * Aulas do concurso. Sem reserva de mock: aula é conteúdo que só existe depois
   * de alguém gerar e salvar, e devolver uma lista falsa faria a tela oferecer
   * "ver aula" para algo que não está gravado em lugar nenhum.
   */
  listAulas: (concursoId: string) =>
    buscarTudo<Aula>(`/aulas/?concurso_id=${encodeURIComponent(concursoId)}`),

  salvarAula: (aula: Omit<Aula, "geradoEm">) =>
    enviar<Aula>("/aulas/", {
      unidadeId: aula.unidadeId,
      concursoId: aula.concursoId,
      conteudoMarkdown: aula.conteudoMarkdown,
      modelo: aula.modelo ?? "",
      promptVersao: aula.promptVersao ?? "",
    }),

  comentarGabarito: (questaoId: string, explicacao: string) =>
    enviar<{ id: string; explicacao: string }>(
      `/questoes/${encodeURIComponent(questaoId)}/comentar/`,
      { explicacao },
    ),

  /**
   * Fila de revisão de classificação (Fase 2, `CLAUDE.md` §8). Sem reserva de
   * mock: é ferramenta de curadoria do acervo, não conteúdo de estudo — sem
   * backend não há o que revisar, e fingir uma lista vazia já resolve a tela.
   */
  listFilaRevisao: () => buscarTudo<ClassificacaoRevisao>("/classificacoes/fila-revisao/"),

  revisarClassificacao: (id: number) =>
    enviar<ClassificacaoRevisao>(`/classificacoes/fila-revisao/${id}/revisar/`, {}),
};

/**
 * Chaves do React Query. Ficam aqui, e não espalhadas pelas rotas, para que
 * invalidar cache não dependa de duas telas terem digitado a mesma string.
 */
export const chaves = {
  disciplinas: ["disciplinas"] as const,
  questoes: ["questoes"] as const,
  provas: ["provas"] as const,
  acervo: ["acervo"] as const,
  aulas: (concursoId: string) => ["aulas", concursoId] as const,
  filaRevisao: ["fila-revisao"] as const,
};
