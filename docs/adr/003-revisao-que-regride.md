# ADR-003 — Revisão espaçada regressiva, gestão manual e fim das revisões fictícias

**Status**: aceito · Camada 1

## Contexto

Três defeitos na agenda de revisão espaçada (1→7→15→30 dias):

1. **O intervalo nunca regride.** Errar de novo o assunto não faz nada
   (`agendarRevisaoPorErro` retorna cedo se a agenda existe). Um assunto errado
   toda semana continua caminhando para 30 dias — o oposto do que repetição
   espaçada significa. O comentário original justificava o retorno cedo para não
   *duplicar* a agenda; regressão não duplica (mesma linha, muda data/intervalo),
   então a objeção não se aplica.
2. **Não há gestão manual.** `addRevisao` existe no store e nenhuma tela chama;
   não dá para criar, adiar nem excluir revisão.
3. **Todo usuário novo nasce com 4 revisões fictícias** ("APIs REST", "Pix e
   Open Finance"…) que ele nunca criou, e `reset()` as traz de volta. Eram
   dado de demonstração do protótipo.

## Decisão

- **Regressão**: errar um assunto que já tem agenda **volta o intervalo para 1
  dia** e reagenda para amanhã. Errado é o sinal mais confiável de que o assunto
  não fixou — a agenda tem que ouvir. `marcarRevisada` continua avançando como
  hoje. A lógica de transição vira função pura exportada
  (`regredirIntervalo`/`proximoIntervalo`) com teste em Vitest — é regra de data
  que erra em silêncio (§7.1 do CLAUDE.md).
- **Gestão manual**: ações `adiarRevisao(id, dias)` e `removerRevisao(id)` no
  store, expostas na tela de Revisões (adiar +1/+7; excluir com confirmação).
  Criação manual fica de fora por ora: a criação automática por erro cobre o
  caso real, e um formulário de criação exigiria escolher unidade do edital numa
  árvore de ~100 itens — custo alto para ganho não comprovado.
- **Fim das fictícias**: `initialRevisoes` vira `[]`, `reset()` idem, e a
  migração do `persist` sobe para **version 2** removendo, uma única vez, as
  quatro revisões de demonstração (identificadas por id `r1`–`r4` **e** os
  tópicos exatos do protótipo, para nunca apagar revisão legítima de usuário).

## Consequências

- Assunto problemático agora orbita perto (1–7 dias) até ser dominado; o teto de
  30 dias volta a significar "dominado", não "antigo".
- O estado persistido muda de formato → bump de `version` + `migrate` (§2.4).
  Quem tem as fictícias no disco as perde na primeira hidratação — é o
  comportamento desejado e elas nunca foram criadas pelo usuário.
- Excluir revisão é ação destrutiva local: pede confirmação na tela, e o item
  volta naturalmente no próximo erro do assunto.
