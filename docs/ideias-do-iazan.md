# Ideias extraídas do backlog IAZAN (ago/2026)

> **Status: todos os 8 itens aproveitáveis foram implementados** (ADRs 012–017 em
> `docs/adr/`, branch `feat/ideias-iazan`). A tabela abaixo é o registro da
> triagem original.

Análise item a item do documento "IAZAN — Status: A fazer" (25 cards de um sistema
de gestão de agência: CRM, projetos, financeiro, bugs). O que segue é a tradução
do que **se aplica ao Foco BB** — a maioria dos cards é do domínio deles e foi
descartada com o motivo registrado, para a pergunta não voltar.

## Veredito por item

| #   | Card IAZAN                                            | Veredito              | Tradução para o Foco BB                                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | MFA (TOTP)                                            | Descartar             | Sem login por decisão (§7.5). Sem conta, não há segundo fator.                                                                                                                                                                                                                                                                         |
| 2   | RLS por atribuição                                    | Descartar             | Single-user. O princípio "recorte num lugar só" já existe (`useAcervoDoConcurso`).                                                                                                                                                                                                                                                     |
| 3   | Reset de senha                                        | Descartar             | Sem conta.                                                                                                                                                                                                                                                                                                                             |
| 4   | CRUD real substituindo dado estático                  | **Aproveitar**        | Nosso equivalente é `src/data/concursos.ts` hardcoded (§7.3). O backend JÁ tem o model `Concurso` (Fase 3) — falta a API servir o catálogo e o frontend consumir.                                                                                                                                                                      |
| 5   | Máquina de estados com guards                         | Adaptar (leve)        | O padrão bom: guard que bloqueia **dizendo o campo exato que falta**. Aplicar onde houver bloqueio de fluxo (ex.: entrega de prova já lista as em branco).                                                                                                                                                                             |
| 6   | Gate G1 checklist N/7                                 | Descartar             | O edital verticalizado já é o nosso checklist com progresso.                                                                                                                                                                                                                                                                           |
| 7   | Proposta imutável + versões                           | **Aproveitar**        | Aula gerada hoje é colada POR CIMA da anterior, sem histórico. Versionar `Aula` (v1, v2…) no backend, mostrando "gerada em X, substituída em Y".                                                                                                                                                                                       |
| 8   | Saga G3 + idempotência                                | Descartar             | Sem pagamentos/eventos externos. Idempotência já é prática nossa (`agendarRevisaoPorErro` não duplica).                                                                                                                                                                                                                                |
| 9   | Motor de itens + **WIP limit**                        | **Adaptar**           | A ideia forte: limite de trabalho em andamento. Tradução: o plano/trilha avisar "não abra teoria nova com N+ revisões vencidas" — hoje o card Hoje mostra, mas nada desencoraja acumular.                                                                                                                                              |
| 10  | Bloqueio > 48h escala                                 | **Adaptar**           | Assunto "travado": errado 3+ vezes seguidas mesmo revisando = escalar de tratamento (parar de fazer questões e ir para aula/vídeo). Hoje a revisão só regride; não existe o conceito de "este assunto precisa de outra abordagem".                                                                                                     |
| 11  | Change Request                                        | Descartar             | Sem escopo contratual.                                                                                                                                                                                                                                                                                                                 |
| 12  | Gates G4–G7, rollback por outra pessoa                | Descartar             | Sem deploy/cliente. O padrão "checklist imutável por fase" já existe como `ItemEdital` (fotografia).                                                                                                                                                                                                                                   |
| 13  | Asaas / contas a receber                              | Descartar             | Sem financeiro.                                                                                                                                                                                                                                                                                                                        |
| 14  | Custos por projeto                                    | Descartar             | Idem.                                                                                                                                                                                                                                                                                                                                  |
| 15  | Terminologia validada por teste (`grep 'lucro' = 0`)  | **Aproveitar (ouro)** | Nossa regra análoga (§8): nunca exibir "probabilidade de cair", % seco sem `n`, "baixa incidência" onde é `sem_dados`. Hoje é disciplina manual — virar **teste Vitest de terminologia proibida** que varre `src/routes` e `src/components`. Barato e trava regressão para sempre.                                                     |
| 16  | Fechamento mensal D+5 + alerta de reserva mínima      | **Adaptar**           | (a) **Retrospectiva mensal de estudo** derivada na leitura: questões do mês, evolução por janela (já existe a lib), assuntos que subiram/desceram. (b) **Alerta de ritmo**: a trilha já calcula o ritmo necessário — falta o alerta "no ritmo dos últimos 14 dias você não fecha a cobertura antes da prova" (com o `n`, como sempre). |
| 17  | Bugs CRUD + SLA                                       | **Adaptar**           | Não SLA — mas **reportar problema na questão** (gabarito errado, enunciado truncado, alternativa faltando) é lacuna real. Fluxo: botão na questão → grava report no backend → fila de curadoria (mesmo padrão da `/classificacao`). Nasceu de defeito real (questões com alternativas-figura vazias, §7.1).                            |
| 18  | Reabertura preserva histórico (snapshot)              | Já temos              | `avaliarRaciocinio` não reescreve o passado; `ClassificacaoQuestao` guarda proveniência. Valida a abordagem, nada a fazer.                                                                                                                                                                                                             |
| 19  | G8 encerramento sem órfãos                            | Descartar             | Sem ciclo de encerramento equivalente.                                                                                                                                                                                                                                                                                                 |
| 20  | Catálogo editável no Admin (vs. hardcoded) + snapshot | **Aproveitar**        | O mesmo do item 4, pelo lado do backend: catálogo de concursos editável no Django Admin (o model existe), servido por API, sem deploy para adicionar concurso. O "snapshot que não afeta existentes" já é o `ItemEdital`.                                                                                                              |
| 21  | Templates versionados + snapshot do gerado            | **Adaptar**           | Os prompts (`promptEstudo.ts`) são template hardcoded. Mínimo que vale: gravar na `Aula`/explicação **qual versão do prompt** a gerou (campo `modelo` existe e vai vazio hoje) — sem isso, melhorar o prompt não diz quais aulas são da geração antiga.                                                                                |
| 22  | Provider abstrato de assinatura                       | Descartar             | Sem integração externa.                                                                                                                                                                                                                                                                                                                |
| 23  | Nota fiscal                                           | Descartar             | O padrão "falha não bloqueia o fluxo" já existe (fallback para mocks com aviso).                                                                                                                                                                                                                                                       |
| 24  | Filas pessoais com dados reais                        | Já temos (ADR-008)    | O card "Hoje" é a nossa fila. Refinamento que vale: **ação rápida inline** — "revisado hoje" e "adiar" direto do card, sem navegar.                                                                                                                                                                                                    |
| 25  | Pesquisa global                                       | **Aproveitar**        | Lacuna transversal conhecida ("sem busca de questões"). Busca por enunciado/id de questão, assunto do edital e aula — mínimo 3 caracteres, debounce, resultado abre o registro (questão → caderno de erros ou simulado do assunto; assunto → edital).                                                                                  |

## O que entra na fila (prioridade sugerida)

1. **Teste de terminologia proibida** (item 15) — meia hora de trabalho, protege a
   regra mais importante do §8 contra regressão para sempre.
2. **Pesquisa global** (item 25) — lacuna já mapeada na análise competitiva;
   escopo pequeno (a busca é client-side sobre o acervo já carregado).
3. **Reportar problema na questão** (item 17) — fecha o ciclo de qualidade do
   acervo; reusa o padrão da fila de revisão da Fase 2.
4. **Catálogo de concursos servido pelo backend** (itens 4+20) — quita a dívida
   §7.3 usando o model que a Fase 3 já criou. É o maior dos itens.
5. **Versionamento de aula + versão do prompt** (itens 7+21) — pequeno no
   backend, elimina o "colar por cima apaga".
6. **Alerta de ritmo da trilha + retrospectiva mensal** (item 16) — leitura pura
   sobre dados existentes.
7. **Assunto travado / WIP de revisões** (itens 9+10) — heurística nova de
   direção; desenhar com cuidado para não virar bronca automática.
8. **Ações rápidas no card Hoje** (item 24) — polish.

## O que o documento valida (sem trabalho novo)

- Fotografia imutável ao lado do estado vivo (IAZAN: snapshots de template/rota;
  nós: `ItemEdital`, `TentativaProva`).
- Histórico nunca reescrito (IAZAN: reopen events; nós: `avaliarRaciocinio` só na
  última tentativa).
- Guard que explica o bloqueio com o dado exato que falta.
- Substituir dado estático por fonte real **com aviso enquanto não dá** (nosso
  `AvisoAcervo`).
