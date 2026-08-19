# ADR-001 — Caderno de erros derivado do histórico

**Status**: aceito · Camada 1

## Contexto

O app grava, por resposta: a alternativa marcada, o raciocínio escrito **antes** do
gabarito, a autoavaliação (`bateu`/`torto`/`chutei`) e o tempo. Nenhuma tela
consolida isso. O "caderno de erros" é o recurso que aprovados mais citam nas
plataformas grandes (Qconcursos/TEC/Estratégia), e aqui ele custa só uma tela —
o dado já existe. Pior: o raciocínio escrito nunca mais é exibido fora da própria
questão, então o material mais rico do app (o registro do que a pessoa pensou)
está sendo coletado e desperdiçado.

## Decisão

Nova rota `/erros` ("Caderno de erros" na navegação), **100% derivada do
histórico na leitura** (§2.3) — nenhum estado novo no store.

- **O que entra**: questões cuja **última** resposta no concurso em foco foi
  errada. A última, não qualquer uma: quem errou em março e acertou em julho
  superou o erro, e mantê-lo no caderno puniria o progresso.
- **Aba "Raciocínio torto"**: questões cuja última resposta foi **certa** mas com
  `autoavaliacao === "torto"` — acertou por eliminação ou caminho errado. Nenhuma
  plataforma grande captura isso porque nenhuma pede o raciocínio.
- Cada item mostra: enunciado, sua alternativa × a correta, **o raciocínio que
  você escreveu**, a autoavaliação, e o `GabaritoComentado` (reaproveitado do
  simulado — inclusive o fluxo de gerar comentário via prompt).
- Agrupado por disciplina, com filtro; dentro do grupo, ordenado por mais recente.
- Atalho "Praticar este assunto" (`/questoes?assunto=`) quando a questão tem
  unidade classificada.

## Consequências

- Zero risco de divergência: mudou o histórico, mudou o caderno (é `useMemo`).
- Refazer a questão e acertar remove do caderno sozinho — comportamento desejado
  e documentado na tela ("acertou de novo? sai daqui").
- A rota lê `useAcervoDoConcurso` como todas as outras; questão que saiu do
  acervo some do caderno (mesma regra de `desempenhoPorUnidade`).
