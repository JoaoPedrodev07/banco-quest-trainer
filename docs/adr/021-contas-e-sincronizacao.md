# ADR-021 — Onda 1: contas e sincronização de progresso

**Status**: aceito · segundo passo da rota SaaS (`docs/auditoria-saas.md`)

## Contexto

Todo o progresso vive no `localStorage` de um navegador: sem conta não há
multi-dispositivo, não há recuperação, e o produto perde o dado do cliente na
primeira limpeza de navegador. A auditoria apontou que o formato de
sincronização já existe sem querer: o backup v2 (`src/lib/backup.ts`) enumera
os 11 campos de estado do usuário.

## Decisão

**Progresso como blob por usuário, não como 8 tabelas relacionais.**

Novo app Django `contas` com um único model: `ProgressoUsuario`
(`OneToOne(User)`, `dados` JSONField no shape exato de `Backup["progresso"]`
v2, `versao_backup`, `atualizado_em`). Motivos, na ordem:

1. O cliente já serializa/desserializa esse shape (`montarBackup`/`lerBackup`/
   `aplicarBackup`) — o sync reusa código testado em vez de criar um segundo
   caminho de escrita para o mesmo dado.
2. Nenhuma feature atual precisa de query server-side dentro do progresso (as
   análises são todas calculadas no cliente, §2.3). Granularizar em tabelas é
   custo sem consumidor — quando existir um (ranking, análise agregada), a
   migração blob→tabelas é um comando que lê JSON.
3. Isolamento é trivial: um blob por usuário, impossível vazar linha alheia.

**Auth: token DRF, e-mail + senha.** `rest_framework.authtoken` — um token por
usuário, header `Authorization: Token …`. Sem sessão/cookie porque frontend e
API vivem em origens diferentes; sem JWT porque refresh/expiração é
complexidade sem requisito aqui. Endpoints: `registrar`, `entrar`, `sair`,
`eu`, `progresso` (GET/PUT) — throttle dedicado de 10/min nos de credencial
(força bruta é o ataque barato). Login com credencial errada responde
genérico, sem revelar se o e-mail existe.

**Sincronização: pull no login, push automático com debounce, conflito
explícito.**

- No login, o app compara: servidor vazio → sobe o local; local vazio → aplica
  o do servidor; ambos têm dados → **o usuário escolhe** (o contrato do backup
  sempre foi "substitui, não mescla" — mesclar históricos duplicaria respostas
  e inflaria streak, e a tela avisa).
- Depois de logado, toda mudança no store agenda um push (debounce de 4 s). O
  PUT envia a `base` (o `atualizado_em` que o cliente conhece); se o servidor
  tem algo mais novo (outro dispositivo), responde **409** e o cliente oferece
  a escolha em vez de sobrescrever calado.
- O pull aplica via `aplicarBackup` com supressão de push durante a aplicação
  (senão o pull dispararia um push do mesmo dado).

**Fora desta onda, de propósito**: reset de senha por e-mail (exige SMTP —
Onda 3/4), papéis de escrita no acervo (Onda 2), UI de conta própria — o card
"Conta e sincronização" mora em Configurações, que já é a tela de posse do
usuário.

## Consequências

- A conta é opcional: sem login o app continua 100% local, idêntico a hoje.
- `darkMode`, `pomodoro` e `simuladoAtual` ficam fora do sync (os dois
  primeiros são preferência de dispositivo; a sessão de simulado é volátil e
  sincronizá-la no meio de uma prova causaria mais dano que ajuda).
- Token no `localStorage` (chave própria): XSS rouba token — mitigado por não
  haver conteúdo de terceiros injetável hoje; reavaliar na Onda 2 quando
  houver conteúdo multi-usuário.
- LGPD: o blob contém raciocínios e anotações; exclusão de conta apaga o
  `ProgressoUsuario` em cascata. A portabilidade já existe (exportar backup).
