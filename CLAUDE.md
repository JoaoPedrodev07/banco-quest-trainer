# CLAUDE.md — Instruções do projeto para o Claude Code

> Lido automaticamente pelo Claude Code ao abrir o repositório.
> Objetivo: manter o mesmo padrão de arquitetura e as mesmas travas em qualquer sessão, sem precisar
> reexplicar o projeto toda vez.

## 1. O que é este projeto

**Foco BB 2026** — app de estudos para o concurso do **Banco do Brasil, Agente de Tecnologia (banca
Cesgranrio)**. Organiza o edital, treina questões em simulados, agenda revisões espaçadas e mostra o
progresso até a data da prova.

**Estado atual: frontend + backend Django.** O conteúdo (edital, provas, questões) vem de uma API em
`backend/` — **590 questões**, importadas dos PDFs de 9 provas oficiais (todas com sha256 registrado).
O acervo não é só Cesgranrio/BB: cobre 3 concursos — Banco do Brasil (Cesgranrio, 473 questões, cargos
Agente de Tecnologia e Agente Comercial), Banco do Nordeste (Cebraspe, 60) e Banestes (FGV, 57). Da
prova exata deste projeto — BB, Agente de Tecnologia (`bb-ti-2023`) — só 69 questões são dela; as
outras 6 provas Cesgranrio são de Agente Comercial (§7.4) e as de Cebraspe/FGV são de outro órgão
(§7.7). O estado do **usuário** continua no localStorage (Zustand `persist`, chave `foco-bb-store`):
desde o ADR-021 há **conta opcional** (token DRF) que sincroniza o progresso entre dispositivos — sem login o app segue 100% local.

Os mocks de `src/data/` ainda existem, mas só como **reserva**: quando o backend não responde, a tela
cai neles e o `AvisoAcervo` avisa que aquilo é conteúdo de exemplo.

O app é **multi-concurso**: `src/data/concursos.ts` é o catálogo, e `concursoAtivoId` no store diz qual
está em foco.

Para rodar, são dois processos:

```bash
cd backend && .venv/Scripts/python.exe manage.py runserver 8000
npm run dev
```

Origem: gerado no [Lovable](https://lovable.dev), com **sincronização de mão dupla** ativa (ver §2.1).

## 2. Regras de ouro (NUNCA quebre)

### 2.1 Nunca reescreva o histórico do git

`force push`, `rebase`, `amend` ou `squash` de commits **já enviados** quebram a sincronia com o
Lovable e o usuário **perde o histórico do projeto** lá (ver `AGENTS.md`). Esta regra vale mesmo quando
o histórico ficaria "mais bonito": aqui, histórico feio e íntegro é melhor que histórico limpo e
quebrado. Precisa desfazer algo já enviado? Use `git revert`, que cria um commit novo.

> Consequência prática: a branch conectada (`main`) precisa ficar **sempre em estado funcional**, porque
> tudo que chega nela aparece no editor do Lovable.

### 2.2 Dado mockado é dado de mentira — e a UI precisa saber disso

As 30 questões, 6 disciplinas e provas em `src/data/` são **exemplos**, não o edital real. Nunca
escreva na tela nada que afirme que o conteúdo é oficial, que a estatística é confiável ou que o
desempenho prevê aprovação. Quando o número vier de amostra pequena, diga isso.

### 2.3 Nada de estado derivado duplicado no store

O store (`src/store/useStore.ts`) guarda **fato**, não conclusão: respostas dadas, tópicos marcados,
revisões agendadas. Acerto percentual, streak exibido, progresso do edital e "questões hoje" são
**calculados na leitura** (`useMemo` na rota). Guardar derivado gera divergência silenciosa quando o
histórico muda.

### 2.4 localStorage é frágil — trate como tal

O usuário pode limpar o navegador e perder tudo. Toda leitura do store precisa aguentar dado **ausente
ou de uma versão anterior do schema** (campo novo = `?? valorPadrão`). Ao mudar o formato de algo já
persistido, adicione `version` + `migrate` no `persist` — nunca assuma que o que está gravado tem o
formato de hoje.

### 2.5 Datas: mês em JavaScript começa no zero

`new Date(2026, 9, 25)` é **25/10/2026**, não setembro. É a data padrão da prova no store. Prefira ISO
(`"2026-10-25"`) ao criar data nova, e compare sempre por `slice(0, 10)` quando a intenção for "mesmo
dia" — comparar ISO completo inclui hora e quebra a contagem de streak.

## 3. Arquitetura

```
src/
  routes/       # rotas = telas (file-based routing do TanStack Start)
  components/   # AppLayout (shell) + ui/ (shadcn — 46 componentes gerados)
  store/        # Zustand + persist — ÚNICA fonte do estado do usuário
  data/         # mocks: disciplinas, questoes, provas (o "banco de dados" de hoje)
  services/     # API falsa (Promise com delay) — a COSTURA para o backend real
  types/        # contratos TypeScript compartilhados
  lib/          # utilidades (cn) + captura de erro do Lovable
```

**A costura para o backend (importante).** `src/services/index.ts` decide entre API e mock, e
`src/services/hooks.ts` expõe isso às telas via TanStack Query. **As rotas consomem `services/`** —
nenhuma importa `src/data/` direto. Não espalhe `fetch` pelas telas: tudo que vier do servidor entra
por aqui, inclusive o carimbo de `concursoId` enquanto o backend não conhece concursos.

**Backend** (`backend/`, Django + DRF): `catalogo/` guarda edital, provas e questões; `ingest/` importa
PDF da banca (pdfplumber + parser da Cesgranrio). Todo conteúdo aponta para uma `Fonte` com tipo
(`oficial`/`amostra`/`derivada`) e sha256 do PDF — é o que permite à UI cumprir o §2.2. Comandos:
`seed_catalogo`, `importar_edital`, `importar_prova`, `classificar_questoes` (todos com `--dry-run`
onde faz sentido).

**Rotas.** Roteamento por arquivo — leia `src/routes/README.md` antes de criar rota nova. `__root.tsx`
é o shell de todas as páginas; `routeTree.gen.ts` é **gerado**, nunca edite à mão. Não crie
`src/pages/` nem `app/layout.tsx` (convenções de Next/Remix que não valem aqui).

**Build.** `vite.config.ts` usa `@lovable.dev/vite-tanstack-config`, que **já traz** TanStack Start,
React, Tailwind, tsConfigPaths, nitro e o alias `@`. **Não adicione esses plugins manualmente** — duplicar
quebra o app.

## 4. Como trabalhar

```bash
npm install        # bun.lock veio do Lovable; npm funciona (bun não está instalado nesta máquina)
npm run dev        # http://localhost:8080 (porta do preset do Lovable, não a 5173 padrão do Vite)
npm run build      # build de produção (nitro)
npm run lint       # ESLint
npm run format     # Prettier
```

1. Entenda a tela antes de mudar: cada rota concentra seu próprio estado local (`useState`) e só toca o
   store para **fato persistente**.
2. Mudou tipo em `src/types/`? Procure todos os usos — não há teste para pegar a regressão (§6).
3. Commit direto na `main`. Sem PR (projeto solo), mas **sem reescrever histórico** (§2.1).
4. Conventional Commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.

## 5. Padrões de código

- **TypeScript estrito.** `any` é exceção justificada. Tipos vêm de `src/types/`; não duplique.
- **Domínio em português** (`Disciplina`, `Questao`, `Revisao`, `Topico`, `metaDiaria`) — o assunto é
  concurso brasileiro e o código fica perto do vocabulário do usuário. Termos técnicos consagrados
  seguem em inglês (`store`, `router`, `props`).
- **UI só do shadcn** (`src/components/ui/`). Precisa de um componente novo? Gere pelo shadcn em vez de
  escrever Radix na mão — mantém acessibilidade e estilo consistentes.
- **Tailwind com os tokens do tema** (`src/styles.css`). Nada de cor solta em hex: o modo escuro depende
  das variáveis CSS e quebra com valor cravado.
- **`cn()` para classe condicional** (`src/lib/utils.ts`), nunca template string concatenada.
- Estado de servidor não existe hoje; quando existir, entra por `services/`.

## 6. O que NÃO fazer

- Não reescrever histórico já enviado (§2.1) — é a regra que mais dói quebrar.
- Não editar `src/routeTree.gen.ts` (arquivo gerado).
- Não adicionar plugins que o `@lovable.dev/vite-tanstack-config` já inclui.
- Não guardar no store o que dá para calcular (§2.3).
- Não afirmar na UI que dado mockado é oficial (§2.2).
- Não criar `src/pages/` — o roteamento é por arquivo em `src/routes/`.

## 7. Dívidas conhecidas (contexto, não tarefa)

Não saia consertando por conta própria; é o mapa do que está pendente por decisão.

1. **Testes: backend no parser e na API; frontend em Vitest nas regras de data e estatística.**
   `manage.py test` (38 casos) e `npm test` (84 casos). Toda regra de data que errava em
   silêncio virou função pura testada: `proximoIntervalo` (`lib/revisao.ts`, ADR-003), trilha
   (`lib/trilha.ts`) e a contagem de `streak` (`lib/streak.ts`) — o §7.1 original está quitado.
2. **Classificação incompleta, mas não do jeito que parece à primeira vista**: 232 das 590 questões
   têm tópico do edital (39%). Olhando só o recorte que importa para o cargo de Agente de Tecnologia
   — a prova `bb-ti-2023`, 34 questões de TI — a classificação já está em 31/34 (91%): não é mais o
   gargalo. O gargalo real está em `informatica`/`vendas` (180 questões, 0% classificado), mas essas
   disciplinas são do cargo Agente Comercial, **fora do edital de TI** (§7.4) — classificá-las contra
   a árvore de TI seria o mesmo erro do §7.7. Sem exemplo real de TI classificado o prompt de estudo
   (`src/lib/promptEstudo.ts`) ainda sofre, mas o motivo não é falta de dado bruto, é a Fase 2 da
   linha de trabalho do §8 ainda não ter fechado a fila de revisão. Detalhe completo em
   `docs/auditoria-corpus.md`.
3. **Concursos: quitado em três etapas.** O backend conhece concursos (Fase 3), serve o catálogo
   (`GET /api/concursos/`, ADR-015) e recorta questões/provas por `?concurso=` (ADR-018). O que
   RESTA no cliente é deliberado: o recorte por **cargo** (`disciplinasDoCargo`) continua em
   `useAcervoDoConcurso` — um lugar só, porque escapou três vezes quando estava espalhado — e a
   tela de Provas pede sem filtro de propósito (é o repositório completo de cadernos).
4. **Populações diferentes no mesmo acervo.** As provas de Agente Comercial trazem `informatica` e
   `vendas`, que **não estão no edital de Agente de Tecnologia**. Nunca some essas disciplinas com as
   de TI numa estatística: os Conhecimentos Básicos são compartilhados, o resto não.
5. **Autenticação e sincronia: parcialmente quitado (ADR-021).** Conta opcional com sync do progresso (blob no shape do backup v2). Ainda sem: reset de senha por e-mail (exige SMTP) e papéis de escrita no acervo (Onda 2).
6. **Sem LLM em tempo de execução, por decisão.** O app monta prompts para o usuário levar a uma IA
   gratuita de fora; não há chave de API e não deve haver. Vale para aula, gabarito comentado e
   classificação (`manage.py prompt_classificacao`). O que protege não é confiar na IA — é
   `classificar_questoes` recusar o que não fecha com o edital.
7. **O edital é GLOBAL, e isso trava o multi-concurso.** `Disciplina` e sua árvore de tópicos não
   pertencem a concurso nenhum: são compartilhadas. Enquanto só o BB tinha edital importado, não
   incomodou. Agora incomoda: as questões da Cebraspe (BNB) são de MVC, DevOps, contêineres, TDD e
   requisitos — **nada disso existe no edital do BB**, cujo TI é aprendizado de máquina, banco de
   dados, big data, mobile, estrutura de dados e linguagens. Classificá-las contra a árvore do BB é
   impossível para a maioria, e forçar produziria estatística falsa.

   O conserto é `Disciplina` passar a pertencer a um concurso, com uma árvore por edital. Até lá,
   prova de outro órgão entra como **treino de formato**: serve para sentir o estilo da banca, não
   para alimentar a análise de incidência.

## 8. Linha de trabalho ativa: Motor de Incidência e Raio-X de Banca

Expansão em execução por fases (0→6), uma fase por sessão, cada uma com critério de aceite
verificável. Não avance para a fase seguinte com a anterior vermelha — em especial, **não faça a
Fase 4 (motor de incidência) antes da Fase 2 (classificação) estar ≥95%**: análise sobre corpus
pouco classificado produz número bonito e falso, que é o problema que esta linha existe para
resolver.

**Escopo**: foco exclusivo BB / Agente de TI. O suporte multi-concurso (BNB, §7.7) permanece
funcional mas não é alvo de investimento nesta sequência.

**Fase 0 já rodou** (`docs/auditoria-corpus.md`, `docs/scripts/`). Achado que muda o plano da Fase 4:
existe **uma única prova oficial** do cargo-alvo (`bb-ti-2023`, 34 questões de TI) — o componente
`dispersao` do score de incidência (nº de provas distintas) não tem o que medir ainda nesse escopo.
Ler a seção 5 do relatório ("o que este corpus não permite afirmar") antes de desenhar a Fase 4.

**Fase 1 já rodou** (`docs/taxonomia.md`). Não nasceu um app novo: a árvore Disciplina > Tópico >
Subtópico já existia em `catalogo.models` (populada do PDF do edital por `manage.py
importar_edital`), então a Fase 1 estendeu esse modelo em vez de duplicá-lo — `Topico`/`Subtopico`
ganharam `edital_ref` e `ativo_edital_vigente`. **Os ids dos tópicos não foram renomeados para o
esquema `ti.bd.sql.joins` que o brief sugeria** — eles já são chave primária usada no localStorage
do usuário (`EditalStatus` em `useStore.ts`); trocar o esquema invalidaria progresso de estudo já
salvo, sem forma de migrar. Motivo completo em `docs/taxonomia.md`. Também corrigido um bug real
encontrado no caminho: `importar_edital` apagava e recriava a árvore a cada reimportação, o que
zerava (via `SET_NULL`) a classificação de toda `Questao` já revisada — agora é upsert, e tópico
que sai do edital vira `ativo_edital_vigente=False`, nunca é deletado.

**Fase 2 já rodou.** Novo model `ClassificacaoQuestao` (`catalogo/models.py`) guarda proveniência
(confiança, origem, justificativa, revisão humana) por classificação — `Questao.topico`/`subtopico`
continuam existindo como cache da classificação primária corrente, escritos só pelos comandos de
classificação (`classificar_questoes`, `classificar_heuristica`, `importar_classificacao_llm`), que
são o único caminho de escrita dos dois lados (ver docstring do model — é disciplina de escrita
única, não sincronização por sinal). Camada heurística (`catalogo/classificacao.py`) cobre termo-
âncora específico o bastante pra não ser ambíguo, restrita à disciplina `ti` do concurso alvo.
Exportação/importação de classificação por IA externa em `exportar_classificacao_llm` /
`importar_classificacao_llm` — a segunda rejeita slug inexistente, disciplina incompatível, schema
inválido e chave duplicada no arquivo, e sempre grava `origem=llm_externa`,
`revisada_por_humano=False`. Fila de revisão em `GET /api/classificacoes/fila-revisao/` (+ ação
`revisar`) e na tela `/classificacao`. `manage.py cobertura_classificacao` reporta o recorte
`bb-ti-2023`/`ti` em **100%** (34/34) — bateu o critério de aceite (≥95%) nesse escopo; o corpus
inteiro segue em 39% porque a maior parte fora do escopo (`informatica`/`vendas` do Agente Comercial,
TI de outros concursos) não deveria mesmo ser forçada contra esta árvore (§7.4, §7.7).

**Fase 3 já rodou.** Novos models `Banca`, `Concurso`, `Edital`, `ItemEdital` + `Prova.concurso`
(FK, `SET_NULL`). Escopo deliberadamente estreito: só existe `Concurso` para os 3 que já têm prova
real no backend (`bb-ti-2026`, `fgv-banestes-ti-2021`, `cebraspe-bnb-ti-2022`) — os outros 3 do
catálogo do frontend (`src/data/concursos.ts`: TCE-SP, TCE-RJ, ATI-PE) não têm prova nenhuma
importada, são card de calendário com dado de imprensa, e migrar isso pro backend é escopo maior
que "eliminar o recorte de prova" (o problema real do §7.3). `Prova.banca`/`Questao.banca`
continuam `CharField` — não virou FK pra `Banca` nesta fase (590 linhas em uso por filtro/admin/tipo
do frontend, sem necessidade imediata). `ItemEdital` é fotografia congelada de `Topico` por versão
de edital (mesmo padrão de `ClassificacaoQuestao`: não é duplicação proibida pelo §2.3, é histórico
ao lado do estado atual) — hoje só existe 1 versão (`docs/auditoria-corpus.md` já avisava disso).
API: `?concurso=<slug>` em `/api/questoes/` e `/api/provas/`; sem o parâmetro devolve tudo (igual
antes) com header `X-Deprecation-Warning`. **O frontend não foi tocado nesta fase** — `useAcervoDoConcurso`
continua fazendo o recorte sozinho; migrar o frontend pro filtro do backend é o "commit separado"
que o próprio brief pede, fica para quando for a vez. Migration testada em cópia do banco antes de
aplicar na real (0 provas órfãs, 590 questões preservadas, 111 tópicos = 111 `ItemEdital`).

**Fases**: 0 auditoria de corpus (só leitura, gera `docs/auditoria-corpus.md`) → 1 taxonomia
canônica do edital (`slug` estável e imutável por tópico, 3 níveis) → 2 classificação de 100% do
corpus (heurística + exportação para IA externa + fila de revisão humana) → 3 modelar `Concurso`
e `Edital` nativamente no backend (dívida do §7.3) → 4 motor de incidência (score por subtópico,
zerado se fora do edital vigente) → 5 diff de editais + perfil histórico da banca → 6 UI (mapa de
incidência, "onde estudar agora", raio-X da banca, diff de edital) + Vitest no frontend (dívida do
§7.1).

**Restrições adicionais desta linha** (somam-se às regras de ouro do §2):

- Não preencher lacuna de dado (questão, edital, prova) com conhecimento geral do modelo. Se a
  informação não está no PDF ingerido, o campo fica nulo e é sinalizado.
- Todo score/derivado desta linha (incidência, classificação automática) segue o §2.3: calculado
  na leitura, nunca materializado sem cache explícito e invalidável.
- Toda afirmação estatística exibida ao usuário carrega o `n` que a sustenta — sem exceção, e sem
  exibir probabilidade de "cair" em porcentagem (o corpus não sustenta essa precisão).
- Classificação com `origem=llm_externa` e `revisada_por_humano=False` nunca alimenta o motor de
  incidência com peso cheio.
- Importador de classificação/taxonomia rejeita slug que não exista na árvore — nunca cria tópico
  na marra durante import.
- `n < 3` num subtópico é faixa `sem_dados`, não "baixa incidência" — ausência de evidência é
  diferente de evidência de baixa incidência, e a UI precisa dizer isso com essas palavras.
- Trabalho em branch, PR pequeno, um por fase (mais estrito que o §4.3, que permite commit direto
  na `main` para o resto do projeto).

## 9. Linha executada: Ciclo de Estudo (ago/2026, branch `feat/ciclo-de-estudo`)

Onze ADRs em `docs/adr/` (leia antes de mexer nessas áreas), implementados em 4 camadas:
caderno de erros (`/erros`), explicação no resultado do simulado, revisão espaçada que
**regride** ao errar (regras puras em `src/lib/revisao.ts`), dashboard recortado por concurso,
sessão de simulado persistente com grade e modo prova (`simuladoAtual` no store), filtros por
assunto/inéditas + cadernos salvos, tentativas por prova (fotografia de evento), card "Hoje",
trilha com fases (`src/lib/trilha.ts`), flashcards com SRS por cartão + cartões próprios,
anotação por questão, anatomia do erro e evolução por janelas (`src/lib/estatistica.ts`).

Estado persistido novo (todos com padrão vazio no `merge`, backup v2): `simuladoAtual`,
`cadernos`, `tentativasProva`, `flashcardsSrs`, `cartoesProprios`, `anotacoes`. O `persist`
está na **version 2** — as 4 revisões de demonstração do protótipo foram removidas e não
existem mais; `revisoes` nasce vazio.

## 10. Linha executada: IAZAN (ago/2026, branch `feat/ideias-iazan`)

Extração de um backlog de outro projeto (`docs/ideias-do-iazan.md` tem a triagem
item a item; ADRs 012–017 em `docs/adr/`): teste Vitest de terminologia proibida
(`src/lib/terminologia.test.ts` — trava as frases que o §8 veta), pesquisa global
Ctrl+K (`BuscaGlobal.tsx`, client-side), reportar problema na questão + fila de
curadoria em `/classificacao` (model `ProblemaQuestao`), **catálogo de concursos
servido pelo backend** (`GET /api/concursos/`, `manage.py seed_concursos`,
`useConcursos`/`useConcurso` — `src/data/concursos.ts` virou reserva de mock;
editar concurso é Django Admin), aula versionada com `prompt_versao` (regravar
nunca apaga), assunto travado (3 erros seguidos → mudar de abordagem), alerta de
ritmo na trilha, retrospectiva de 30 dias e ações rápidas no card Hoje.
