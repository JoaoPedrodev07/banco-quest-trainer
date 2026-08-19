# ADR-014 — Reportar problema na questão

**Status**: aceito · Linha IAZAN (item 17, adaptado)

## Contexto

O acervo vem de parser de PDF, e defeito de importação já aconteceu (questões
com alternativas-figura vazias, §7.1). Quando o usuário percebe gabarito errado
ou enunciado truncado durante o estudo, hoje não há para onde reportar — o
defeito se perde. O IAZAN resolve o equivalente com módulo de bugs + fila; a
nossa versão é o mesmo padrão da fila de classificação da Fase 2.

## Decisão

- **Backend**: model `ProblemaQuestao` (questão FK, tipo enum —
  `gabarito_errado`, `enunciado_incompleto`, `alternativa_faltando`,
  `classificacao_errada`, `outro` —, descrição, criado_em, resolvido_em).
  Endpoints: `POST /api/questoes/<id>/reportar/` e
  `GET /api/problemas/` (só os abertos) + ação `resolver`. Sem autenticação,
  como todo endpoint de escrita atual (mesma ressalva documentada do `AulaViewSet`).
- **Frontend**: botão "Reportar problema" junto do gabarito (resultado do
  simulado e caderno de erros) com diálogo tipo+descrição; a fila aparece como
  seção na tela `/classificacao` — que já é a tela de curadoria do acervo — com
  ação "resolver".
- Reportar **não** altera a questão: é sinal para curadoria, nunca correção
  automática (corrigir gabarito por report sem conferir o PDF violaria o §2.2).

## Consequências

- Fecha o ciclo de qualidade do acervo com o padrão que a Fase 2 já criou.
- Report duplicado da mesma questão é permitido (dois sinais > um), a fila
  agrupa por questão.
