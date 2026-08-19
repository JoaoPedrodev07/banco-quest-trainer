# ADR-019 — Pausa no simulado e análise de tempo de prova completa

**Status**: aceito · pedido direto do usuário

## Contexto

Duas dores reais de quem usa o simulado longo:

1. **Não dá para pausar.** Sair para fazer outra coisa com o simulado aberto
   infla o tempo da questão e faz o relógio da prova esgotar sozinho — o
   diagnóstico de ritmo passa a medir a vida da pessoa, não a prova.
2. **Não há análise de tempo total.** O app mede ritmo por questão, mas nunca
   responde "quanto levei para cumprir um simulado completo, e quanto eu
   *deveria* levar para caber nas 4 horas?".

## Decisão

**Pausa (mesmo padrão do Pomodoro, §2.3: guardar instantes, derivar na leitura).**

- `SimuladoAtual` ganha `pausadoEm` (ISO ou nulo) e `segundosPausados`
  (acumulado). Ações `pausarSimulado`/`retomarSimulado` no store. O tempo
  líquido é derivado: `(agora − iniciadoEm) − pausas` — função pura
  `tempoLiquidoSegundos` em `lib/ritmo.ts`, testada (regra de tempo erra em
  silêncio).
- **Pausar esconde a questão.** Sem isso, a pausa vira tempo extra de leitura
  de graça — o cronômetro para mas o olho continua na prova.
- **Auto-pausa em `pagehide` e ao sair da tela**: fechar a aba ou navegar para
  outra rota com sessão rodando pausa sozinho (o persist grava síncrono). É o
  que impede o caso original — "parei pra fazer outra coisa" — de estourar o
  relógio mesmo quando a pessoa esquece de pausar.
- Ao retomar, o cronômetro da questão desloca o início pelo tempo pausado — a
  questão não "ganha" nem "perde" segundos.
- O tempo gravado em `TentativaProva.tempoSegundos` e o do resultado passam a
  ser **líquidos** (sem pausas), congelados na entrega.

**Análise de tempo de prova completa (na Análise).**

- Novo cartão "Tempo de prova completa": lista as tentativas de prova
  (`tentativasProva`, ADR-007) com tempo líquido × alvo
  (`duracaoDaProva(total)` = n × 205 s, o ritmo real das 4h/70), o saldo
  ("sobrou 22 min" / "estourou 15 min") e a projeção honesta para 70 questões
  a partir do ritmo médio das tentativas — sempre com o `n` de tentativas e
  questões que sustenta a conta (§8).
- Sem tentativa completa registrada, o cartão diz o que falta ("resolva uma
  prova completa em Provas → Resolver") em vez de sumir.

## Consequências

- Campos novos em sessão persistida: padrão aplicado no `merge` (§2.4) —
  sessão antiga hidrata com `pausadoEm: null, segundosPausados: 0`.
- Tentativas antigas (pré-pausa) podem ter tempo inflado se a pessoa saiu com
  o simulado aberto; o cartão avisa que o tempo é o do relógio da sessão.
