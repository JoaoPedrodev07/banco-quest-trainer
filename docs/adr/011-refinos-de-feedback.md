# ADR-011 — Refinos de feedback: profundidade dupla, anotações, anatomia do erro, evolução

**Status**: aceito · Camada 4

## Contexto

Quatro refinos pequenos que as plataformas grandes ensinaram, mais um fecho de
ciclo no edital. Agrupados num ADR porque nenhum muda arquitetura — todos são
leitura nova sobre dado existente ou campo persistido simples.

## Decisão

1. **Duas profundidades de explicação** (padrão Estratégia): o
   `montarPromptGabarito` passa a pedir a resposta em duas seções — "## Em 2
   linhas" (para quem só confere) e "## Explicação completa" (passo a passo +
   por que cada errada está errada). O render não muda (é Markdown).

2. **Anotação privada por questão** (padrão Qconcursos): novo campo persistido
   `anotacoes: Record<questaoId, string>` (fato). Campo de nota na questão
   respondida do simulado e no caderno de erros ("pegadinha: a banca troca média
   por mediana aqui"). Entra no backup (v2), `merge` com `{}`, `reset`.

3. **Anatomia do erro** (na Análise): por disciplina com ≥10 erros registrados,
   a divisão dos erros em **convicção errada** (escreveu raciocínio e errou —
   conceito aprendido errado, pede teoria) × **chute errado** (`autoavaliacao ===
   "chutei"` ou sem raciocínio — lacuna de conteúdo, pede cobertura). Sempre com
   o `n`. *Não* fazemos análise por distrator (qual alternativa errada atrai):
   corpus de um usuário só não tem repetição por questão para isso sustentar
   conclusão — seria o número bonito e falso que o §8 proíbe.

4. **Evolução temporal** (na Análise): taxa por disciplina na janela dos últimos
   30 dias × a janela anterior (31–60 dias atrás), cada uma com intervalo de
   Wilson e `n` mínimo de 10 respostas por janela; abaixo disso a janela é
   `sem_dados` (com essas palavras, §8). Setinha de tendência só quando os
   intervalos não se sobrepõem — sobreposição é "sem mudança detectável", não
   "melhorou 3%".

5. **Sugestão de checkbox no edital**: unidade com ≥3 respostas e checkbox
   "questões" desmarcado ganha um aviso discreto "você já respondeu N questões
   daqui — marcar?" com botão que marca. Sugere, não marca sozinho: o checkbox é
   declaração consciente de estudo, não contador.

## Consequências

- `anotacoes` é o único estado novo; o resto é leitura derivada (§2.3).
- Backup sobe para **versão 2** cobrindo todos os campos novos desta linha
  (cadernos, tentativasProva, flashcardsSrs, cartoesProprios, anotacoes);
  `lerBackup` continua aceitando v1 com padrões vazios (§2.4).
