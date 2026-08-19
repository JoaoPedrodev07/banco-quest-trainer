# ADR-018 — Recorte por concurso via filtro `?concurso=` do backend

**Status**: aceito · o "commit separado" que a Fase 3 pediu (§7.3)

## Contexto

A Fase 3 criou o filtro `?concurso=` na API e deixou um header
`X-Deprecation-Warning` avisando que resposta sem recorte é transitória — mas o
frontend seguiu baixando o acervo INTEIRO (590 questões, todas as provas) e
recortando no cliente via `useAcervoDoConcurso`. Com o catálogo servido pelo
backend (ADR-015), todos os 7 concursos têm provas vinculadas e o filtro
funciona para qualquer um.

## Decisão

- `api.listQuestoes(concursoId?)` e `api.listProvas(concursoId?)` passam
  `?concurso=` quando o id vem; `useQuestoes`/`useProvas` aceitam o parâmetro e
  o incluem na chave de cache; `useAcervoDoConcurso` repassa o concurso em foco.
- **O recorte client-side de `useAcervoDoConcurso` permanece**, por três
  motivos: (1) é ele que faz o recorte por **cargo** (`disciplinasDoCargo`), que
  o backend não conhece; (2) é a defesa quando a resposta vem do mock (que não
  filtra); (3) filtrar duas vezes é idempotente — o custo é zero.
- A tela de Provas continua pedindo **sem** filtro, de propósito: ela é o
  repositório completo de cadernos, não a visão do concurso em foco. É o único
  chamador restante do comportamento sem recorte.

## Consequências

- A carga típica cai de "acervo inteiro" para "as questões do concurso em foco"
  — e trocar de concurso busca só o que falta (cache por chave).
- O header de deprecação some das chamadas principais; permanece na da tela de
  Provas, que é uso consciente.
