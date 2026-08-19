# Foco BB 2026 — treino para o concurso do Banco do Brasil (Agente de TI)

App de estudos para o concurso do **Banco do Brasil · Agente de Tecnologia**, banca **Cesgranrio**.
Organiza o edital, monta simulados, agenda revisões espaçadas e acompanha o progresso até a prova.

> **Protótipo de frontend.** Não há backend: o conteúdo é **amostra mockada** (30 questões, 6
> disciplinas) e o progresso fica no **localStorage** do navegador. Limpar os dados do navegador apaga
> o progresso, e não há sincronia entre dispositivos.

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Dashboard** (`/`) | dias restantes, meta diária, acerto geral, tópicos concluídos, streak |
| **Edital** (`/edital`) | árvore do edital; marca teoria / revisão / questões por subtópico |
| **Simulados** (`/questoes`) | filtra por disciplina e ano, resolve e corrige com explicação |
| **Provas** (`/provas`) | edições anteriores do concurso |
| **Revisões** (`/revisoes`) | fila de revisão espaçada (1 → 7 → 15 → 30 dias) |
| **Configurações** (`/config`) | data da prova, meta diária, tema, reset do progresso |

## Como rodar

```bash
npm install
npm run dev        # http://localhost:8080
```

Outros comandos: `npm run build` (produção) · `npm run preview` · `npm run lint` · `npm run format`.

> O repositório traz `bun.lock` (veio do Lovable), mas **npm funciona normalmente** — é um projeto Vite
> padrão. Só não misture os dois gerenciadores no mesmo clone.

## Stack

**TanStack Start** (Vite + SSR, roteamento por arquivo) · **React** + **TypeScript** ·
**Zustand** com `persist` · **shadcn/ui** sobre Radix · **Tailwind** · **Recharts** · build com **nitro**.

## Documentação

- [`CLAUDE.md`](./CLAUDE.md) — instruções e travas do projeto (lido pelo Claude Code automaticamente)
- [`ARQUITETURA.md`](./ARQUITETURA.md) — fluxo de dados, domínio e o caminho para um backend real
- [`src/routes/README.md`](./src/routes/README.md) — convenções do roteamento por arquivo

## Sincronia com o Lovable

Este repositório é sincronizado com o [Lovable](https://lovable.dev) nos **dois sentidos**: o que você
edita lá vira commit aqui, e o que você commita aqui volta para o editor.

⚠️ **Nunca reescreva histórico já enviado** (`force push`, `rebase`, `amend`, `squash`) — isso quebra a
sincronia e o histórico do projeto se perde no Lovable. Para desfazer algo já publicado, use
`git revert`. Detalhes em [`AGENTS.md`](./AGENTS.md) e no `CLAUDE.md` §2.1.
