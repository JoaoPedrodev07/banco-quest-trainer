# CLAUDE.md — Instruções do projeto para o Claude Code

> Lido automaticamente pelo Claude Code ao abrir o repositório.
> Objetivo: manter o mesmo padrão de arquitetura e as mesmas travas em qualquer sessão, sem precisar
> reexplicar o projeto toda vez.

## 1. O que é este projeto

**Foco BB 2026** — app de estudos para o concurso do **Banco do Brasil, Agente de Tecnologia (banca
Cesgranrio)**. Organiza o edital, treina questões em simulados, agenda revisões espaçadas e mostra o
progresso até a data da prova.

**Estado atual: frontend + backend Django.** O conteúdo (edital, provas, questões) vem de uma API em
`backend/` — **271 questões de caderno oficial da Cesgranrio**, importadas dos PDFs da banca. O estado
do **usuário** continua no localStorage (Zustand `persist`, chave `foco-bb-store`): não há login nem
sincronia entre dispositivos.

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
npm run dev        # http://localhost:5173
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

1. **Testes existem só no parser** (`manage.py test ingest`, 10 casos). Nasceram de um defeito real:
   questão cujas alternativas são figuras entrava com as cinco letras vazias, impossível de
   responder e sem nada avisando. O que ainda não tem cobertura e merece: `proximoIntervalo` e a
   contagem de `streak` (`useStore.ts`), ambas com regra de data que erra em silêncio. O frontend
   não tem runner de teste configurado.
2. **Classificação incompleta**: só 32 das 271 questões têm tópico do edital, todas de TI. Sem isso não
   existe análise de incidência, e o prompt de estudo (`src/lib/promptEstudo.ts`) sai sem exemplo da
   banca. É o gargalo de quase tudo.
3. **O backend não conhece concursos.** O `concursoId` é carimbado no `services/`, e o recorte por
   concurso e por cargo mora em `useAcervoDoConcurso` — um lugar só, porque escapou três vezes
   quando estava espalhado pelas telas.
4. **Populações diferentes no mesmo acervo.** As provas de Agente Comercial trazem `informatica` e
   `vendas`, que **não estão no edital de Agente de Tecnologia**. Nunca some essas disciplinas com as
   de TI numa estatística: os Conhecimentos Básicos são compartilhados, o resto não.
5. **Sem autenticação e sem sincronia entre dispositivos** — consequência direta do localStorage.
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
