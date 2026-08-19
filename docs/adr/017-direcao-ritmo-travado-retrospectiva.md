# ADR-017 — Direção: alerta de ritmo, assunto travado, retrospectiva e ações rápidas

**Status**: aceito · Linha IAZAN (itens 9, 10, 16 e 24) · agrupado: nenhum muda arquitetura

## Contexto

Quatro refinos de direção vindos do IAZAN: WIP/escalação de bloqueio viram
heurísticas de estudo; fechamento mensal vira retrospectiva; fila pessoal ganha
ação inline.

## Decisão

1. **Alerta de ritmo na trilha**: quando a fase é cobertura e o ritmo necessário
   passa de `RITMO_ALTO` (2 unidades de teoria/dia), a trilha avisa que cobrir
   tudo pode não caber e manda priorizar por incidência. **Não** comparamos com
   um "ritmo observado de teoria": `editalStatus` não tem timestamp, e inventar
   proxy (data da 1ª questão) afirmaria medir o que não medimos.
2. **Assunto travado**: `assuntosTravados()` em `desempenho.ts` (função pura,
   testada) — unidade cujas **últimas 3 respostas** foram todas erradas. A tela
   de Revisões marca "Travado" e inverte a recomendação: aula/vídeo primeiro,
   questões depois — reerrar pela 4ª vez não é treino, é reforço do erro.
3. **Retrospectiva dos últimos 30 dias** (na Análise): questões respondidas ×
   janela anterior, dias ativos, assuntos iniciados (1ª resposta na janela).
   Derivada do histórico datado; janela sem dados diz "sem dados" (§8).
4. **Ações rápidas no card Hoje**: as até 3 revisões mais atrasadas aparecem
   individualmente com "Revisado" e "+1d" inline — resolver o dia sem sair do
   dashboard.

## Consequências

- Nenhum estado novo; tudo leitura derivada (§2.3).
- O limiar de "travado" (3 seguidas) e o `RITMO_ALTO` são constantes nomeadas —
  ajustáveis sem tocar lógica.
