# ADR-010 — Agenda espaçada por cartão e cartões próprios

**Status**: aceito · Camada 3

## Contexto

Cada sessão de flashcards sorteia 20 cartões aleatórios do zero: o cartão errado
agora tem a mesma chance de voltar que qualquer outro — isso é recordação
aleatória, não espaçada. E não existe cartão próprio: o "verso" é sempre um
conjunto de alternativas de questão, que serve mal para definição e lei seca.

## Decisão

- **SRS por cartão**: novo campo persistido `flashcardsSrs`
  (`Record<cartaoId, { intervalo: 1|7|15|30; proxima: string }>`) — fato do
  julgamento, não derivado. "Não lembrei" → intervalo 1 (regride, ADR-003);
  "Lembrei" → avança na mesma escada 1→7→15→30 das revisões. Mesma escada de
  propósito: duas curvas de esquecimento no mesmo app seria pretensão de
  precisão que não temos.
- **Baralho com prioridade**: primeiro os cartões **vencidos** (proxima ≤ hoje),
  depois os **novos** (sem registro), completando 20. Cartão em dia não entra —
  revisar antes da hora é o desperdício que o SRS existe para evitar. A config
  mostra a composição ("8 vencidos + 12 novos").
- **Cartões próprios**: novo campo persistido `cartoesProprios`
  (`{ id, frente, verso, disciplinaId, concursoId }[]`), com criação/exclusão na
  própria tela (frente/verso + disciplina). Entram no mesmo baralho e no mesmo
  SRS. **Não** alimentam `historico` — não são questões do acervo, e contá-los
  como resposta inflaria as estatísticas de questão (§2.2 na veia). O julgamento
  deles só move o SRS.
- Cartão-questão continua alimentando `historico` e agendando revisão por erro,
  como hoje.

## Consequências

- `flashcardsSrs` e `cartoesProprios` entram no `merge` (padrões `{}`/`[]`), no
  backup (v2) e no `reset`.
- `flashcardsSrs` cresce um registro por cartão julgado (teto prático: nº de
  questões do acervo + cartões próprios — algumas centenas, ok para localStorage).
- Cartão próprio excluído deixa órfão no `flashcardsSrs`; a leitura ignora ids
  sem cartão correspondente (mesma tolerância do §2.4).
