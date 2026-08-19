# ADR-020 — Onda 0: fundação de produção

**Status**: aceito · primeiro passo da rota SaaS (`docs/auditoria-saas.md`)

## Contexto

A auditoria de prontidão SaaS encontrou a configuração "fail-open" (`DJANGO_DEBUG`
default ligado), SQLite sem rota para Postgres, zero CI, zero observabilidade,
throttle em memória local e nenhum runbook de deploy. Nada disso é visível ao
usuário — e é exatamente o que derruba um SaaS de uma pessoa só no primeiro
incidente.

## Decisão

1. **Fail-closed**: `DJANGO_DEBUG` passa a valer `False` por padrão. O
   desenvolvimento local liga explicitamente via `backend/.env`
   (`DJANGO_DEBUG=true`) — ambiente esquecido agora sobe SEGURO e quebra cedo
   (a `SECRET_KEY` ausente derruba o processo), em vez de subir inseguro em
   silêncio.
2. **`.env.example` dos dois lados**: `backend/.env.example` documenta toda
   variável que o settings lê; `.env.example` na raiz documenta `VITE_API_URL`
   (cujo esquecimento faz o site cair silenciosamente nos mocks).
3. **Postgres possível**: `psycopg[binary]` entra no requirements. SQLite
   continua o default de desenvolvimento; `DATABASE_URL` decide.
4. **Cache/throttle honesto**: com `REDIS_URL`, o cache default vira Redis
   (backend nativo do Django 5) — o rate limit passa a contar entre workers e
   sobreviver a restart. `NUM_PROXIES` configurável (default 0 = usa
   `REMOTE_ADDR`, imune a spoof de `X-Forwarded-For`; atrás de proxy, 1).
5. **Observabilidade**: `sentry-sdk` inicializado só quando `SENTRY_DSN`
   existe (custo zero sem ele) + `LOGGING` de console com nível por env.
6. **Docker**: `backend/Dockerfile` (gunicorn + collectstatic + usuário não-root)
   e `docker-compose.yml` na raiz (web + Postgres + Redis) — o caminho de deploy
   e o de "subir tudo local" ficam iguais.
7. **CI**: GitHub Actions roda em todo push/PR os dois lados — Django test,
   ESLint, tsc, Vitest e build de produção. Os 122+ testes deixam de depender
   de alguém lembrar.
8. **Higiene de dependência**: `anthropic` sai do requirements de produção
   (só o comando offline `gerar_aulas` usa) e vai para `requirements-dev.txt`.
9. **README** corrigido: ele ainda dizia "não há backend"; ganha o runbook de
   ambiente e deploy.

## Adendo (mesmo dia)

O GitHub Actions não executa neste repositório: é privado e a conta está sem
cota/billing de Actions (confirmado empiricamente — até um workflow de `echo`
falha com `startup_failure`). O portão de qualidade passa a ser **local**:
`.githooks/pre-push` roda tsc + Vitest + testes Django antes de todo push e
bloqueia se algo falhar. Ativação por clone: `git config core.hooksPath
.githooks`. O `ci.yml` fica no repositório de propósito — custo zero, e volta a
valer sozinho se o Actions for liberado ou o repo virar público.

## Consequências

- Quem clonar o repo precisa criar `backend/.env` (copiando o example) para
  desenvolver — o README explica. É o preço do fail-closed, e é pago uma vez.
- O Dockerfile é do backend; o frontend continua com deploy Cloudflare (nitro),
  documentado no README.
- Sentry/Redis/Postgres são opt-in por env: o modo "dois processos locais" do
  CLAUDE.md continua funcionando idêntico.
