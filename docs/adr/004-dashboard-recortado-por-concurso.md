# ADR-004 — Dashboard 100% recortado pelo concurso em foco

**Status**: aceito · Camada 1 · **é conserto de bug**

## Contexto

Os quatro cartões do dashboard filtram o histórico por `concursoAtivoId`, mas os
dois gráficos não: "Acerto por disciplina" (`barData`) e "Questões nos últimos
30 dias" (`lineData`) usam `historico` inteiro. Quem usa mais de um concurso vê
números que se contradizem na mesma tela — exatamente o vazamento de recorte que
o §7.3 do CLAUDE.md mapeou três vezes em outras telas.

Além disso, os botões de "Pontos fracos" levam às telas genéricas (`/edital`,
`/questoes`) em vez do assunto específico — sendo que a tela de Revisões já faz
o deep-link certo (`?unidade=`, `?assunto=`).

## Decisão

- `barData` e `lineData` passam a usar `doConcurso` (o histórico já filtrado que
  os cartões usam).
- "Gerar aula" → `/edital?unidade=<unidadeId>`; "Praticar" →
  `/questoes?assunto=<unidadeId>` — os mesmos deep-links das Revisões.

## Consequências

- Todos os números do dashboard passam a contar a mesma população.
- Nenhuma mudança de estado ou schema; é correção de leitura.
