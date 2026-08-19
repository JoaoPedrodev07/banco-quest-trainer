# ADR-012 — Teste automatizado de terminologia proibida

**Status**: aceito · Linha IAZAN (item 15)

## Contexto

O §8 do CLAUDE.md proíbe a UI de afirmar o que o corpus não sustenta — em
especial "probabilidade de cair" e variantes. Hoje isso é disciplina manual: nada
impede um refactor futuro de reintroduzir a frase. O backlog IAZAN valida a
mesma regra deles ("nunca 'lucro'") com um teste de grep — barato e permanente.

## Decisão

Teste Vitest (`src/lib/terminologia.test.ts`) que varre `src/routes` e
`src/components` (fora `ui/`, que é gerado) e **falha** se encontrar qualquer
frase da lista proibida: "probabilidade de cair", "chance(s) de cair", "certeza
de cair". A lista mora no próprio teste, comentada frase a frase com o porquê,
e cresce quando uma nova mentira estatística for identificada.

A palavra "lucro" **não** entra: o domínio aqui não é financeiro e ela aparece
legitimamente em sentido coloquial ("o que vier agora é lucro"). Banir palavra
solta geraria falso positivo; a lista é de frases que afirmam previsão.

## Consequências

- A regra mais importante do §8 deixa de depender de memória.
- Falso negativo é possível (paráfrases novas); o teste é rede, não juiz.
