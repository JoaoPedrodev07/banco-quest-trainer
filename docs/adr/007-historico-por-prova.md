# ADR-007 — Tentativas por prova como fotografia de evento

**Status**: aceito · Camada 2

## Contexto

A tela de Provas não diz "você já resolveu esta com 61% em julho". Refazer a
mesma prova oficial periodicamente é a régua de evolução mais honesta que um
usuário solo tem (não há ranking) — mas o app não guarda o resultado de uma
tentativa como unidade.

Derivar tentativas do `historico` não funciona: as respostas não sabem a que
sessão pertencem, e a mesma questão respondida em contextos diferentes (simulado
avulso, prova completa, flashcard) é indistinguível.

## Decisão

Novo campo persistido `tentativasProva` — **fotografia de evento, não derivado
materializado** (mesmo padrão do `ItemEdital` no backend: histórico ao lado do
estado, permitido pelo §2.3 porque o número não é reconstruível depois que o
histórico continua crescendo):

```ts
tentativasProva: { id: string; provaId: string; concursoId: string;
  data: string; acertos: number; erros: number; total: number;
  tempoSegundos: number }[]
```

- Gravada **uma vez**, quando uma sessão em modo `?prova=` chega à correção
  (ADR-005). Sessão abandonada não vira tentativa.
- A tela de Provas mostra, por caderno: última tentativa (data + %) e melhor
  tentativa, com o `n` ("61% de 34 questões") — nunca % seco (§8).
- Sem tela própria de histórico de tentativas por ora: a lista na própria carta
  da prova cobre o uso real (2–3 tentativas por prova).

## Consequências

- Entra no `merge` (padrão `[]`), no backup (v2) e no `reset`.
- `acertos/total` da tentativa nunca diverge do que a pessoa viu na tela de
  resultado naquele dia — é o registro daquilo, não um recálculo.
