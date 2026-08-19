# Foco BB 2026 — treino para o concurso do Banco do Brasil (Agente de TI)

App de estudos para o concurso do **Banco do Brasil · Agente de Tecnologia**, banca **Cesgranrio**.
Organiza o edital, monta simulados, agenda revisões espaçadas e acompanha o progresso até a prova.

> **Frontend + backend Django.** O conteúdo (edital, provas, 600+ questões de PDFs oficiais com
> sha256) vem da API em `backend/`; sem ela, o app cai em 30 questões de exemplo e avisa. O
> **progresso do usuário** fica no **localStorage** (sem login nem sincronia entre dispositivos —
> exporte o backup em Configurações).

## Funcionalidades

| Tela | O que faz |
|---|---|
| **Dashboard** (`/`) | dias restantes, meta diária, acerto geral, tópicos concluídos, streak |
| **Edital** (`/edital`) | árvore do edital; marca teoria / revisão / questões por subtópico |
| **Simulados** (`/questoes`) | filtra por disciplina e ano, resolve e corrige com explicação |
| **Provas** (`/provas`) | edições anteriores do concurso |
| **Revisões** (`/revisoes`) | fila de revisão espaçada (1 → 7 → 15 → 30 dias) |
| **Configurações** (`/config`) | data da prova, meta diária, tema, reset do progresso |

## Como rodar (desenvolvimento)

São dois processos. O backend é **fail-closed** (ADR-020): antes da primeira vez, crie o `.env`.

```bash
# backend (uma vez): copie o exemplo e instale
cp backend/.env.example backend/.env        # já vem com DJANGO_DEBUG=true
cd backend && python -m venv .venv && .venv/Scripts/pip install -r requirements-dev.txt
.venv/Scripts/python.exe manage.py migrate && .venv/Scripts/python.exe manage.py runserver 8000

# frontend (outro terminal)
npm install
npm run dev        # http://localhost:8080
```

Outros comandos: `npm run build` · `npm run preview` · `npm run lint` · `npm run format` ·
`npm test` · `cd backend && .venv/Scripts/python.exe manage.py test`.

## Deploy / produção

- **API completa num comando**: `docker compose up --build` (web + Postgres + Redis).
  Exige `DJANGO_SECRET_KEY` no ambiente; todas as variáveis estão documentadas em
  [`backend/.env.example`](./backend/.env.example).
- **Frontend**: build nitro com alvo Cloudflare (`npm run build` → `npx wrangler deploy`).
  **Defina `VITE_API_URL` no build** — sem ela o site publicado cai silenciosamente nos mocks
  (ver [`.env.example`](./.env.example)).
- **CI**: GitHub Actions roda testes, lint, tipos e build em todo push (`.github/workflows/ci.yml`).
- Observabilidade opt-in: `SENTRY_DSN` liga o Sentry no backend.

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
