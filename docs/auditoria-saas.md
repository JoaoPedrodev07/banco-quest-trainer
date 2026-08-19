# Auditoria de prontidão SaaS (ago/2026)

Levantamento de tudo que falta para o Foco BB virar um produto multi-usuário
pago. Feito por leitura direta do código, com evidência por arquivo. Versão
resumida — o plano completo (com precificação e marketing) está no relatório
publicado da sessão.

## O que JÁ está pronto (e não precisa refazer)

- O produto pedagógico: simulado com raciocínio antes do gabarito, SRS que
  regride, trilha, caderno de erros, análise honesta — é o diferencial, e está
  testado (84 testes frontend + 38 backend).
- Backend modelado com procedência (`Fonte` + sha256), concursos, aulas
  versionadas, filas de curadoria.
- `gunicorn` e `whitenoise` já no requirements; `SECRET_KEY` derruba o processo
  se faltar com `DEBUG=False`; rate limit existe (frágil, mas existe).
- O formato de sync já está desenhado sem querer: `src/lib/backup.ts`
  (`Backup["progresso"]`, v2) enumera exatamente os 11 campos de estado do
  usuário — é o payload da futura conta.

## Os 10 bloqueadores, em ordem

1. **Não existe usuário.** Sem `AUTH_USER_MODEL`, login ou token em lugar
   nenhum. Auth é o pré-requisito de todo o resto.
2. **Progresso 100% no localStorage** (`useStore.ts`, chave `foco-bb-store`).
   11 campos precisam virar tabelas por-usuário: `historico`, `revisoes`,
   `editalStatus`, `streak`, `simuladoAtual`, `cadernos`, `tentativasProva`,
   `flashcardsSrs`, `cartoesProprios`, `anotacoes`, preferências.
3. **Escrita anônima sobre acervo global**: `POST/DELETE /api/aulas/`,
   `/comentar/`, `/reportar/`, `revisar`, `resolver` — tudo `AllowAny`
   (`settings.py:128`); as docstrings admitem. Num SaaS, o usuário A sobrescreve
   a aula e a explicação que o usuário B vê. A tela `/classificacao` (curadoria)
   está no menu de todo mundo.
4. **Direito de uso comercial do acervo não resolvido.** Questões extraídas de
   PDFs de Cesgranrio/Cebraspe/FGV; `Fonte` guarda procedência mas não licença.
   É o risco que não se corrige com código — precisa de parecer jurídico antes
   de cobrar.
5. **Deploy inexistente e configuração fail-open**: sem Dockerfile, sem CI, sem
   `.env.example`; `DJANGO_DEBUG` default `True` — env incompleta sobe insegura
   sem acusar. `VITE_API_URL` não documentado: esquecê-lo faz o site pago cair
   silenciosamente nos 30 mocks.
6. **SQLite sem caminho para Postgres**: `dj-database-url` presente, driver
   ausente; `db.sqlite3` gitignorado — deploy limpo sobe sem acervo.
7. **Sem pagamento**: nenhuma referência a gateway, plano, trial ou entitlement.
8. **Sem e-mail nem recuperação de acesso**: nenhum `EMAIL_BACKEND`; a rede é o
   JSON manual do backup.
9. **Observabilidade cega**: telemetria de erro só funciona dentro do editor
   Lovable; sem Sentry, `LOGGING` ou analytics.
10. **Sem camada legal/pública**: sem Termos, Privacidade/LGPD, landing ou
    onboarding; `robots.txt` libera tudo e a meta description diz "plataforma
    pessoal".

Menções: throttle em `LocMemCache` com `X-Forwarded-For` spoofável; acervo
inteiro (~1,6 MB) baixado por sessão sem cache de borda; header
`X-Deprecation-Warning` vazando; `anthropic` no requirements de produção.

## Rota sugerida (4 ondas, cada uma entregável sozinha)

- **Onda 0 — Fundação** — **✅ executada (ADR-020)**: `.env.example` dos dois
  lados + README de deploy; `psycopg` (Postgres via `DATABASE_URL`);
  `backend/Dockerfile` + `docker-compose.yml` (web+Postgres+Redis); CI no
  GitHub Actions (Django test + eslint + tsc + vitest + build); Sentry opt-in +
  `LOGGING`; Redis para o throttle + `NUM_PROXIES`; fail-closed
  (`DJANGO_DEBUG` default `False`; dev usa `backend/.env`).
- **Onda 1 — Contas e sync**: auth (allauth ou simplejwt + e-mail), modelos
  por-usuário espelhando o schema do backup v2, sync do store (o `merge` do
  zustand vira reconciliação), migração assistida do localStorage → conta no
  primeiro login.
- **Onda 2 — Papéis e escrita**: aulas/explicações ganham dono e visibilidade
  (minha × curada/oficial), curadoria vira papel de staff, `/classificacao` sai
  do menu do assinante, rate limit por usuário.
- **Onda 3 — Cobrança e legal**: gateway (Stripe ou Mercado Pago/Asaas), planos
  + entitlement, Termos/Privacidade/LGPD (base legal, exclusão de conta,
  portabilidade — o backup já dá a portabilidade), parecer sobre o acervo.
- **Onda 4 — Growth**: landing pública, onboarding, analytics (PostHog ou
  Plausible), e-mails transacionais e de ciclo de vida.
