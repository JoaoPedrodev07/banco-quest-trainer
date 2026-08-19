# ADR-008 — "Hoje" no dashboard e revisões dentro do plano

**Status**: aceito · Camada 3

## Contexto

O app tem duas mecânicas de agendamento que se ignoram: o plano semanal (blocos
por disciplina) e a agenda de revisão espaçada. O plano manda estudar tópico novo
enquanto há revisões vencidas — que são o estudo de maior retorno do dia. E o
dashboard, tela de abertura, não responde a pergunta que o usuário faz ao abrir o
app: _o que eu faço agora?_

## Decisão

- **Card "Hoje" no dashboard**, primeiro conteúdo depois do cabeçalho, montado
  na leitura (§2.3), em ordem de prioridade:
  1. Revisões vencidas do concurso (contagem + link para `/revisoes`);
  2. Simulado em andamento (ADR-005), com "continuar";
  3. Meta diária: `respondidasHoje / metaDiaria` com barra;
  4. O primeiro bloco do plano de hoje ainda não atacado, com os atalhos dele.
- **O plano abre com as revisões do dia**: no card do dia atual, antes dos
  blocos, uma faixa "Revisar primeiro: N assuntos vencidos" com link. A função
  `montarPlano` não muda — revisão vencida é dado volátil (muda ao longo do dia)
  e entrar na montagem estática do plano criaria um plano que mente à tarde.

## Consequências

- Nenhum estado novo; só leitura composta do que já existe.
- O dashboard passa a ter uma ação primária clara em vez de só métricas.
