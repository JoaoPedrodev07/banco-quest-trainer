# Arquitetura — Foco BB 2026

> O **como** técnico. O **o quê** e as travas estão no [`CLAUDE.md`](./CLAUDE.md).

## 1. O problema, em uma frase

Quem estuda para concurso precisa saber **o que já cobriu do edital**, **onde erra mais** e **o que
revisar hoje** — três perguntas que exigem cruzar o edital, o histórico de respostas e o calendário.

Isso impõe as forças que moldam o código:

1. **O progresso é do usuário e não pode sumir** → persistência local, tolerante a schema antigo.
2. **A verdade é o histórico, não o resumo** → estatística é derivada, calculada na leitura.
3. **O conteúdo hoje é amostra** → a fronteira de dados precisa estar isolada para o backend entrar depois.
4. **O projeto sincroniza com o Lovable** → o histórico do git é parte do produto, não detalhe (ver
   `CLAUDE.md` §2.1).

## 2. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | **TanStack Start** (Vite + SSR) | roteamento por arquivo com type-safety de ponta a ponta |
| UI | **shadcn/ui** sobre Radix | acessibilidade pronta; componentes ficam no repo, editáveis |
| Estilo | **Tailwind** + variáveis CSS | modo escuro por token, sem cor cravada |
| Estado | **Zustand + persist** | store pequeno, sem boilerplate; persistência é uma linha |
| Gráficos | **Recharts** | dashboard de desempenho |
| Build/Deploy | **nitro** (alvo padrão: Cloudflare) | já embutido no preset do Lovable |

## 3. Fluxo de dados

```
src/data/*.ts          (mock: disciplinas, questoes, provas)
      │
      ├─────────────► src/services/index.ts   ← A COSTURA para o backend real
      │                    (Promise + delay artificial)
      │                              ⚠️  existe, mas as rotas ainda NÃO passam por aqui
      ▼
src/routes/*.tsx       (telas: importam o mock DIRETO hoje)
      │
      │  fato do usuário (resposta dada, tópico marcado, revisão feita)
      ▼
src/store/useStore.ts  ──persist──►  localStorage["foco-bb-store"]
      │
      │  leitura + useMemo
      ▼
  estatística derivada (acerto %, streak, progresso do edital, faltam N dias)
```

**A regra que sustenta o desenho:** o store guarda **o que aconteceu**; a tela calcula **o que isso
significa**. Trocar a fórmula do streak não deve exigir migração de dado.

## 4. Domínio

Vocabulário único em `src/types/index.ts` — importe daqui, não redeclare:

| Tipo | O que é |
|---|---|
| `Disciplina` → `Topico` → `Subtopico` | árvore do edital; o **subtópico** é a unidade de progresso |
| `StatusTopico` | `{ teoria, revisao, questoes }` — três frentes por subtópico |
| `Questao` | enunciado, 5 alternativas (A–E), gabarito e explicação |
| `RespostaHistorico` | resposta dada + acerto + data ISO — **o fato bruto** |
| `RevisaoItem` | tópico agendado com `intervaloAtual` ∈ `1 \| 7 \| 15 \| 30` |
| `Prova` | edição anterior do concurso (ano, banca, cargo) |

### Revisão espaçada
`proximoIntervalo` avança `1 → 7 → 15 → 30` e para em 30. Ao marcar revisado, a próxima data é
`hoje + intervaloNovo`. É a regra mais fácil de quebrar sem perceber — e a que mais merece teste.

### Streak
Conta dia corrido: se a última resposta foi **ontem**, incrementa; se foi antes, reinicia em 1; se foi
hoje, não mexe. Comparação por `toISOString().slice(0, 10)` — comparar ISO completo inclui hora e
quebra a contagem.

## 5. Rotas

| Arquivo | URL | Papel |
|---|---|---|
| `__root.tsx` | — | shell (`<Outlet />`, tema, layout) |
| `index.tsx` | `/` | dashboard: contagem regressiva, meta diária, progresso, streak |
| `edital.tsx` | `/edital` | árvore do edital com marcação por subtópico |
| `questoes.tsx` | `/questoes` | simulado: configura → resolve → resultado (máquina de 3 etapas) |
| `provas.tsx` | `/provas` | provas anteriores |
| `revisoes.tsx` | `/revisoes` | fila de revisões vencidas e futuras |
| `config.tsx` | `/config` | data da prova, meta, tema, reset |

`routeTree.gen.ts` é **gerado** pelo plugin — nunca editar. Convenções completas em
`src/routes/README.md`.

## 6. Quando entrar backend

O caminho de menor atrito, na ordem:

1. Rotas passam a consumir `services/` em vez de `data/` (sem mudar telas).
2. `services/` troca mock por `fetch` real — a assinatura das funções não muda.
3. Store passa a guardar **só preferência local**; histórico e revisões migram para o servidor.
4. Aí sim: autenticação e sincronia entre dispositivos.

Fazer (1) **antes** de precisar do backend é barato e deixa a troca trivial depois.
