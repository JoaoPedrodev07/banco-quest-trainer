# ADR-015 — Catálogo de concursos servido pelo backend

**Status**: aceito · Linha IAZAN (itens 4 e 20) · quita parte do §7.3

## Contexto

O catálogo de concursos é hardcoded em `src/data/concursos.ts` — adicionar
concurso exige deploy. A Fase 3 criou o model `Concurso` no backend, mas
deliberadamente estreito (só os 3 com prova importada) e sem os campos de
calendário (salário, vagas, url do edital). O IAZAN chama isso de "catálogo
editável no Admin em vez de hardcoded".

## Decisão

- **Model**: `Concurso` ganha `salario_valor`, `salario_observacao`, `vagas`,
  `edital_url` (todos anuláveis — concurso previsto não tem esses números
  fechados, §2.2). `Fonte` ganha `rotulo` se o serializer ainda não derivar.
- **Seed**: comando `seed_concursos` faz upsert dos 7 concursos do catálogo
  atual (com as mesmas fontes e slugs — `ehTreinoDeFormato` testa
  `fonte.slug === "treino-de-formato"` e precisa continuar verdadeiro) e
  **vincula as provas** listadas em `provaIds` via `Prova.concurso`.
- **API**: `GET /api/concursos/` devolvendo exatamente o shape do tipo
  `Concurso` do frontend (`provaIds` derivado das provas vinculadas).
- **Frontend**: `api.listConcursos()` com queda para o catálogo estático (que
  vira a reserva de mock, como disciplinas/questões); hook `useConcursos()`;
  `useAcervoDoConcurso` e as telas passam a ler do hook. `concursoPorId`
  continua existindo como acesso ao mock — só a camada `services/` o usa.
- Editar concurso passa a ser possível no **Django Admin**, sem deploy.

## Consequências

- O recorte por prova (`provaIds`) passa a depender do vínculo no banco; o seed
  garante paridade com o catálogo atual e o teste cobre isso.
- Enquanto o backend estiver fora do ar, nada muda (mock igual ao de hoje).
- O §7.3 não fecha inteiro: `useAcervoDoConcurso` ainda recorta no cliente —
  migrar o recorte pro filtro `?concurso=` da API continua sendo o passo futuro.
