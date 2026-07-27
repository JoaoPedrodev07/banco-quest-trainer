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
}

export interface Questao {
  id: string;
  disciplinaId: string;
  ano: number;
  banca: string;
  enunciado: string;
  alternativas: { letra: "A" | "B" | "C" | "D" | "E"; texto: string }[];
  correta: "A" | "B" | "C" | "D" | "E";
  explicacao: string;
}

export interface Prova {
  id: string;
  ano: number;
  banca: string;
  cargo: string;
  orgao: string;
  qtdQuestoes: number;
}

export interface RespostaHistorico {
  questaoId: string;
  disciplinaId: string;
  escolhida: string;
  correta: boolean;
  data: string; // ISO date
}

export interface RevisaoItem {
  id: string;
  topico: string;
  disciplinaId: string;
  proximaRevisao: string; // ISO date
  intervaloAtual: 1 | 7 | 15 | 30;
}
