export type StatusTopico = { teoria: boolean; revisao: boolean; questoes: boolean };

export interface Subtopico {
  id: string;
  nome: string;
}

export interface Topico {
  id: string;
  nome: string;
  subtopicos: Subtopico[];
}

export interface Disciplina {
  id: string;
  nome: string;
  cor: string;
  topicos: Topico[];
  /** Cada concurso tem edital próprio; a árvore deixou de ser única. */
  concursoId: string;
}

/**
 * De onde o conteúdo veio. Existe para a tela nunca apresentar amostra como se
 * fosse documento da banca — o campo é opcional porque os mocks de `src/data/`
 * são anteriores ao backend e não têm procedência nenhuma.
 */
export interface Fonte {
  slug: string;
  tipo: "oficial" | "amostra" | "derivada";
  rotulo: string;
  titulo: string;
  url: string;
  publicadoEm: string | null;
  eOficial: boolean;
}

export interface Questao {
  id: string;
  disciplinaId: string;
  ano: number;
  banca: string;
  /** Reportagem/trecho que um bloco inteiro de questões comenta. */
  textoBase?: string;
  enunciado: string;
  alternativas: { letra: "A" | "B" | "C" | "D" | "E"; texto: string }[];
  /**
   * Formato da questão.
   *
   * `certo_errado` (padrão Cebraspe) não tem alternativas: a afirmação inteira
   * está no enunciado e o gabarito é "C" ou "E". `tipo` é o que diz à tela como
   * interpretar `correta` — sem ele, o "C" de uma questão Cebraspe seria lido
   * como a alternativa C de uma múltipla escolha.
   */
  tipo?: "multipla" | "certo_errado";
  /**
   * A prova desconta erro (cada errada anula uma certa). É regra do edital, não
   * da banca: a mesma banca aplica num concurso e não aplica em outro.
   */
  pontuacaoLiquida?: boolean;
  /** Vazio quando a questão foi anulada: a banca não divulga gabarito nesse caso. */
  correta: "A" | "B" | "C" | "D" | "E" | "";
  explicacao: string;
  provaId?: string | null;
  numeroNaProva?: number | null;
  /** Classificação no edital. Nulo enquanto a questão não foi etiquetada. */
  topicoId?: string | null;
  subtopicoId?: string | null;
  anulada?: boolean;
  fonte?: Fonte;
}

export interface Prova {
  id: string;
  concursoId: string;
  ano: number;
  banca: string;
  cargo: string;
  orgao: string;
  qtdQuestoes: number;
  /** Quantas questões dessa prova estão realmente no acervo. */
  questoesDisponiveis?: number;
  urlProva?: string;
  urlGabarito?: string;
  fonte?: Fonte;
}

/**
 * Retrato do acervo, usado para a UI dizer em que ela está se apoiando.
 * `online: false` significa que o backend não respondeu e a tela está com os
 * mocks de `src/data/` — o que precisa ficar visível, não escondido.
 */
export interface Acervo {
  online: boolean;
  questoes: { total: number; oficiais: number; amostra: number; anuladas: number };
  disciplinas: number;
  provas: number;
  editalVigente: { titulo: string | null; url: string | null; tipo: string | null };
}

export interface RespostaHistorico {
  questaoId: string;
  disciplinaId: string;
  /**
   * Em qual concurso a resposta aconteceu. É fato, não derivado (§2.3): guardar
   * aqui evita ter que descobrir o concurso pela disciplina a cada leitura — e
   * disciplina se repete entre concursos ("portugues" existe em quase todos).
   */
  concursoId: string;
  escolhida: string;
  correta: boolean;
  data: string; // ISO date
}

export interface RevisaoItem {
  id: string;
  topico: string;
  disciplinaId: string;
  concursoId: string;
  /**
   * Unidade do edital (id do subtópico, ou do tópico quando não há subdivisão).
   *
   * Opcional porque as revisões antigas guardavam só o nome do assunto como
   * texto solto — sem isso não há como abrir a revisão e mostrar o que estudar,
   * nem cruzar com as questões daquele assunto.
   */
  unidadeId?: string;
  proximaRevisao: string; // ISO date
  intervaloAtual: 1 | 7 | 15 | 30;
}

/**
 * Aula de uma unidade do edital.
 *
 * É conteúdo do acervo, não progresso do usuário: mora no backend junto com
 * provas e questões, e não no localStorage. Não tem `Fonte` porque não veio de
 * documento nenhum — é texto gerado, e quem renderiza tem que dizer isso.
 *
 * `unidadeId` é o id do subtópico, ou o do tópico quando a disciplina não tem
 * subdivisão. A tela conhece a linha do edital por um id só e não precisa saber
 * qual dos dois é.
 */
export interface Aula {
  unidadeId: string;
  concursoId: string;
  conteudoMarkdown: string;
  geradoEm: string; // ISO
  modelo?: string;
}

/** Status de um concurso no calendário público. */
export type StatusConcurso =
  "inscricoes_abertas" | "inscricoes_encerradas" | "previsto" | "encerrado";

/**
 * Um concurso do catálogo.
 *
 * `banca`, `salario`, `vagas` e `dataProva` são anuláveis de propósito: concurso
 * "previsto" quase nunca tem esses dados fechados, e preencher com um palpite
 * faria a tela afirmar como fato o que ainda é notícia. Quando `fonte.eOficial`
 * for falso, a UI precisa dizer isso — o dado veio de imprensa, não do edital.
 */
export interface Concurso {
  id: string;
  nome: string;
  orgao: string;
  cargo: string;
  banca: string | null;
  salario: { valor: number; observacao?: string } | null;
  vagas: number | null;
  status: StatusConcurso;
  dataProva: string | null; // ISO
  editalUrl: string | null;
  provaIds: string[];
  fonte: Fonte;
}
