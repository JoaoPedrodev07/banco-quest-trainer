# ADR-005 — Sessão de simulado persistente, grade de navegação e modo prova

**Status**: aceito · Camada 2

## Contexto

A prova real do BB são 70 questões em até 5 horas. O simulado de hoje: teto de 30
questões no modo manual, sair da tela perde a sessão inteira, navegação só
Anterior/Próxima, sem como marcar questão para voltar, e a correção é sempre
imediata (a prova real não dá feedback no meio). Não dá para treinar o dia P.

## Decisão

**Sessão no store.** Novo campo persistido `simuladoAtual` (fato: a sessão em
andamento existe e tem estas respostas — não é derivado):

```ts
simuladoAtual: {
  questaoIds: string[];        // ids, nunca as questões (o acervo é do backend)
  respostas: Record<string, string>;
  tempos: Record<string, number>;
  marcadas: string[];          // "voltar depois"
  raciocinios: Record<string, string>; // modo prova: escrito antes, avaliado no fim
  idx: number;
  iniciadoEm: string;          // ISO
  provaId: string | null;
  correcao: "imediata" | "no_fim";
  concursoId: string;
} | null
```

- A tela hidrata a sessão resolvendo `questaoIds` contra o acervo; id que sumiu
  do acervo é descartado com aviso. Sessão de outro concurso não é oferecida.
- A config mostra **"Continuar simulado em andamento"** (com progresso e idade)
  ou descartar.
- **Teto sobe para 70** no modo manual.
- **Grade de navegação**: barra com um botão por questão — respondida, pulada,
  marcada, atual — clicável para saltar. Botão "marcar para voltar" na questão.
- **Modo de correção**: escolha na config. `imediata` é o fluxo atual, intocado
  (raciocínio obrigatório antes do gabarito, autoavaliação depois). `no_fim`
  simula a prova: nada de gabarito durante a sessão, raciocínio **opcional**
  (a pressão de tempo é parte do treino; quem quiser registra), autoavaliação
  feita na tela de resultado, olhando raciocínio × gabarito de uma vez.
- No modo `no_fim`, `registrarResposta` só roda **na correção** — durante a
  sessão a resposta vive em `simuladoAtual`. Gravar no clique poluiria streak e
  pontos fracos com um simulado que pode ser abandonado; a sessão persistida já
  protege contra perda. Revisões por erro também são agendadas só na correção.
- O modo `?prova=` usa `no_fim` por padrão (é o ensaio da prova real) e o
  relógio existente; o simulado montado usa `imediata` por padrão.

## Consequências

- Fechar o navegador no meio de uma prova de 70 questões deixa de custar a prova.
- `simuladoAtual` entra no `merge` do persist com padrão `null` (§2.4); **não**
  entra no backup (sessão em andamento não é progresso consolidado).
- A tela `questoes.tsx` cresce; o custo é pago uma vez e o estado continua num
  lugar só (a sessão no store, o resto local).
