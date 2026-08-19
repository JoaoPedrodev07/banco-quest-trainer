# ADR-009 — Trilha com fases até a data da prova

**Status**: aceito · Camada 3

## Contexto

O plano atual é uma semana genérica que se repete — não considera os dias
restantes nem tem fases. A "Trilha Estratégica" (o que o Estratégia Concursos
faz de melhor) é um roteiro até a prova: teoria → questões → revisão → reta
final. O app tem todos os insumos: dias até a prova, cobertura do edital
(`editalStatus`), incidência medida e pontos fracos.

## Decisão

Novo módulo `src/lib/trilha.ts`, **calculado na leitura** (§2.3), exibido como
seção no topo da tela de Plano:

- **Com data de prova** (oficial ou estimada — a distinção que o dashboard já
  faz acompanha o texto): divide o tempo restante em três fases proporcionais ao
  que falta, com piso e teto para não degenerar:
  - **Cobertura** — enquanto houver unidade do edital sem teoria marcada;
    termina, no mais tardar, a 30 dias da prova.
  - **Questões e pontos fracos** — treino dirigido pelo que mais cai e pelo que
    a pessoa mais erra; termina a 10 dias da prova.
  - **Reta final** — só revisão, resumos e provas completas; os últimos 10 dias.
  A trilha diz em que fase o usuário está, o que a fase pede, e o **ritmo
  necessário** ("faltam 62 unidades de teoria em 45 dias úteis de cobertura —
  ~1,4/dia"), sempre com os números que sustentam a conta.
- **Sem data de prova**: não inventa cronograma. Mostra só a fase sugerida pela
  cobertura atual do edital ("você cobriu 12% — fase de cobertura") e diz por
  que não há datas ("edital não publicado").
- O progresso de fase deriva de `editalStatus` e do histórico — sem check-off
  manual novo. A régua de "unidade coberta" é o checkbox de teoria; de "treinada",
  ≥3 respostas na unidade.
- Testes em Vitest para a divisão de fases (regra de data, erra em silêncio).

## Consequências

- Nenhum estado novo. A trilha muda sozinha quando a data ou o progresso mudam.
- Piso/teto das fases são constantes documentadas no módulo — ajustáveis sem
  refazer a lógica.
