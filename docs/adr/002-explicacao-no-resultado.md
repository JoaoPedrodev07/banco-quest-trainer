# ADR-002 — Gabarito comentado na tela de resultado

**Status**: aceito · Camada 1

## Contexto

A tela de resultado do simulado mostra só "Sua: B · Correta: D" e o enunciado.
Para rever a explicação é preciso reencontrar a questão em outro simulado. O
momento de maior abertura para aprender é logo depois de errar — e é exatamente
onde o app hoje não entrega o feedback que já possui (`questao.explicacao`).

## Decisão

Na lista de revisão do resultado, cada questão vira **expansível**:

- Fechada: o resumo atual (nº, sua letra × correta, tempo, enunciado truncado).
- Aberta: alternativas com a correta destacada, **o raciocínio que você
  escreveu**, a autoavaliação dada, e o `GabaritoComentado` — que renderiza a
  explicação existente ou oferece o fluxo de "montar gabarito comentado" na hora.
- Questões erradas começam **abertas por padrão** quando o simulado tem até 10
  questões; acima disso, todas fechadas (uma prova de 70 abriria um paredão).

## Consequências

- Reaproveita `GabaritoComentado` sem mudança de contrato — o componente já
  resolve os dois estados (tem/não tem explicação).
- O comentário gerado no resultado é salvo no acervo (mesma mutação), então
  aparece também no caderno de erros (ADR-001) e em simulados futuros.
