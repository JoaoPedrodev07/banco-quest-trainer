import { disciplinas } from "@/data/disciplinas";
import { questoes } from "@/data/questoes";
import { provas } from "@/data/provas";

const delay = <T>(v: T, ms = 100): Promise<T> => new Promise((r) => setTimeout(() => r(v), ms));

export const api = {
  listDisciplinas: () => delay(disciplinas),
  listQuestoes: () => delay(questoes),
  listProvas: () => delay(provas),
};
