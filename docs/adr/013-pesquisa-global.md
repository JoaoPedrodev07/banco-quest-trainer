# ADR-013 — Pesquisa global

**Status**: aceito · Linha IAZAN (item 25)

## Contexto

Não há como encontrar uma questão, um assunto do edital ou uma prova fora dos
fluxos de cada tela — lacuna transversal já apontada na análise competitiva
(TEC/Qconcursos vivem de achar questão rápido).

## Decisão

Paleta de busca (`cmdk`, componente `Command` do shadcn já presente) montada no
`AppLayout`, aberta por botão na navegação e por `Ctrl+K`. **Busca client-side**
sobre o acervo do concurso em foco, já carregado pelo TanStack Query — não há
endpoint novo: 600 questões filtram em microssegundos no navegador, e criar API
de busca para isso seria abstração sem necessidade.

- Entidades: assuntos do edital, provas, concursos do catálogo e questões
  (enunciado + id), mínimo de 3 caracteres, até 8 resultados por grupo.
- Destinos: assunto → `/edital?unidade=`; prova → `/questoes?prova=`; concurso
  → `/concursos/$id`; **questão → diálogo de leitura** com enunciado,
  alternativas, gabarito comentado e anotação — não existe "página da questão",
  e mandar para um simulado seria abrir treino quando a intenção é consultar.

## Consequências

- Sem estado novo, sem backend novo.
- A busca respeita o recorte por concurso/cargo (vem de `useAcervoDoConcurso`),
  então não vaza disciplina de outro cargo — de graça.
