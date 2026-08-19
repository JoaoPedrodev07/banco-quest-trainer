# ADRs — Linha de trabalho "Ciclo de Estudo"

Decisões de arquitetura da expansão que fecha os ciclos abertos do app (diagnóstico
completo na análise competitiva de ago/2026: o app já coleta erro, raciocínio,
autoavaliação e agenda revisões, mas as engrenagens não se conectam).

Organização em 4 camadas, implementadas em ordem — cada ADR vira um commit:

## Camada 1 — Fechar ciclos abertos (dado já existe, falta a tela)

- [ADR-001](001-caderno-de-erros.md) — Caderno de erros derivado do histórico
- [ADR-002](002-explicacao-no-resultado.md) — Gabarito comentado na tela de resultado
- [ADR-003](003-revisao-que-regride.md) — Revisão espaçada regressiva + gestão manual + fim das revisões fictícias
- [ADR-004](004-dashboard-recortado-por-concurso.md) — Dashboard 100% recortado pelo concurso em foco

## Camada 2 — Simulado com cara de prova

- [ADR-005](005-simulado-persistente.md) — Sessão persistente, grade de navegação, marcar questão, modo prova
- [ADR-006](006-filtros-e-cadernos.md) — Filtro por assunto, "nunca respondi" e cadernos salvos
- [ADR-007](007-historico-por-prova.md) — Tentativas por prova como fotografia de evento

## Camada 3 — Direção

- [ADR-008](008-plano-e-revisoes-conversam.md) — "Hoje" no dashboard e revisões dentro do plano
- [ADR-009](009-trilha-ate-a-prova.md) — Trilha com fases até a data da prova
- [ADR-010](010-flashcards-com-srs.md) — Agenda espaçada por cartão + cartões próprios

## Camada 4 — Refinos

- [ADR-011](011-refinos-de-feedback.md) — Duas profundidades de explicação, anotação por questão,
  anatomia do erro, evolução temporal e sugestão de checkbox no edital

## Linha IAZAN (extração de `docs/ideias-do-iazan.md`)

- [ADR-012](012-teste-de-terminologia.md) — Teste automatizado de terminologia proibida
- [ADR-013](013-pesquisa-global.md) — Pesquisa global (client-side, Ctrl+K)
- [ADR-014](014-reportar-problema-na-questao.md) — Reportar problema na questão + fila de curadoria
- [ADR-015](015-catalogo-de-concursos-no-backend.md) — Catálogo de concursos servido pelo backend
- [ADR-016](016-aula-versionada.md) — Aula versionada e versão do prompt registrada
- [ADR-017](017-direcao-ritmo-travado-retrospectiva.md) — Alerta de ritmo, assunto travado, retrospectiva, ações rápidas

## Formato

Cada ADR segue: **Status** · **Contexto** · **Decisão** · **Consequências**.
Todos respeitam as regras de ouro do `CLAUDE.md` (§2), em especial §2.3 (derivado
calculado na leitura, nunca materializado) e §2.4 (todo campo novo persistido
tolera ausência e tem migração).
