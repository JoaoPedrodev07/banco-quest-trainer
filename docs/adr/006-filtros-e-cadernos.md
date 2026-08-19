# ADR-006 — Filtro por assunto, "nunca respondi" e cadernos salvos

**Status**: aceito · Camada 2

## Contexto

A config do simulado filtra por disciplina, ano, "que errei" e "pontos fracos".
Falta o filtro mais direcionado (assunto do edital — hoje só via deep-link
`?assunto=`), falta "questões que nunca respondi" (quem já respondeu 400 das 590
quer priorizar inéditas), e nenhum conjunto de filtros é reaproveitável — o
"caderno" nomeado é a feature que faz TEC/Qconcursos grudarem no usuário.

## Decisão

- **Filtro por assunto**: um `Select` opcional de unidade do edital (tópico ou
  subtópico), populado só com unidades que têm questão classificada, respeitando
  as disciplinas marcadas. "Todos os assuntos" é o padrão.
- **"Somente questões que nunca respondi"**: checkbox, mutuamente exclusivo com
  "somente que errei" (a interseção é vazia por definição — errar exige ter
  respondido).
- **Cadernos salvos**: novo campo persistido `cadernos` (fato — criação
  explícita do usuário):

```ts
cadernos: { id: string; nome: string; concursoId: string;
  filtros: { disciplinas: string[]; ano: string; assunto: string | null;
             somenteErrei: boolean; somenteIneditas: boolean; modoFracos: boolean;
             qtd: number } }[]
```

Botão "Salvar estes filtros como caderno" na config + lista dos cadernos do
concurso em foco com "aplicar" e "excluir". O caderno guarda **filtros**, não
ids de questão: questão nova importada que casa com o filtro entra sozinha —
um caderno de ids congelaria o acervo do dia em que foi criado.

- **Filtro por banca não entra**: o recorte por concurso já fixa a banca (cada
  concurso do catálogo tem uma), então o filtro nasceria morto. Registrado aqui
  para não ser "descoberto" de novo.

## Consequências

- `cadernos` entra no `merge` com padrão `[]`, no backup (v2) e no `reset`.
- Aplicar caderno é só preencher os estados da config — sem fluxo novo de tela.
