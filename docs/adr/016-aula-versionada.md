# ADR-016 — Aula versionada e versão do prompt registrada

**Status**: aceito · Linha IAZAN (itens 7 e 21)

## Contexto

Colar uma aula nova **apaga** a anterior (`update_or_create`), sem histórico — a
limitação já estava mapeada. E o campo `Aula.modelo` vai sempre vazio: quando o
prompt de estudo melhorar, não haverá como saber quais aulas são da geração
antiga. O IAZAN resolve o equivalente com documentos imutáveis + versões e
snapshot de template.

## Decisão

- **Model**: `Aula` ganha `versao` (int, começa em 1), `prompt_versao` (string)
  e `substituida_em` (timestamp nulo). A aula **corrente** é a com
  `substituida_em IS NULL`; salvar de novo não sobrescreve — marca a corrente
  como substituída e cria a versão N+1. `gerado_em` vira `auto_now_add`
  (histórico não pode ter timestamp que muda). As unique constraints passam a
  valer só para a corrente.
- **API**: a listagem devolve só as correntes (o histórico fica no Admin);
  o corpo do POST aceita `promptVersao`.
- **Frontend**: `promptEstudo.ts` exporta `PROMPT_AULA_VERSAO` e
  `PROMPT_GABARITO_VERSAO` (strings curtas, bump manual a cada mudança de
  prompt — é uma linha no mesmo arquivo que se está editando);
  `AulaSubtopico` envia a versão ao salvar e exibe "versão N · salva em …".

## Consequências

- "Substituir aula" nunca mais perde texto; comparar versões fica possível
  (Admin) sem UI nova.
- Migração de dados: as aulas existentes viram versão 1 corrente — nenhum dado
  muda de significado.
