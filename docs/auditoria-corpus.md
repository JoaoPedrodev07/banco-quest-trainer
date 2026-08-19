# Auditoria de corpus — Fase 0

> Gerado para o brief "Motor de Incidência e Raio-X de Banca" (`CLAUDE.md` §8).
> Só leitura: nenhum dado ou código de produto foi alterado para produzir este documento.
> Todo número abaixo vem de um script reproduzível em `docs/scripts/`, listado ao lado da seção.
> Data da auditoria: 2026-08-05.

## 0. Achado que precede tudo: o corpus é maior do que o `CLAUDE.md` registra

O `CLAUDE.md` (§7.2 e o texto de abertura) afirma **271 questões, 32 classificadas**. O banco atual tem:

- **590 questões**, não 271.
- **232 com tópico atribuído**, não 32.
- **9 provas**, cobrindo **3 concursos diferentes** (Banco do Brasil, Banco do Nordeste, Banestes) e
  **3 bancas** (Cesgranrio, Cebraspe, FGV) — não só Cesgranrio/BB.

Isso não é uma correção que este documento aplica sozinho (Fase 0 é só leitura), mas precisa ficar
registrado: os números de dívida no `CLAUDE.md` datam de um estado anterior do acervo e devem ser
atualizados por decisão consciente, não silenciosamente.

Script: `docs/scripts/auditoria_corpus.py` (seção 1 e 2 da saída).

## 1. Inventário de provas

| id | órgão | cargo | ano | banca | edital diz | extraídas | divergência | pontuação líquida | fonte (tipo) |
|---|---|---|---|---|---|---|---|---|---|
| bb-ti-2023 | Banco do Brasil | Escriturário — Agente de Tecnologia | 2023 | Cesgranrio | 70 | 69 | -1 | não | oficial |
| bb-comercial-a-2023 | Banco do Brasil | Escriturário — Agente Comercial | 2023 | Cesgranrio | 70 | 67 | -3 | não | oficial |
| bb-comercial-b-2023 | Banco do Brasil | Escriturário — Agente Comercial | 2023 | Cesgranrio | 70 | 67 | -3 | não | oficial |
| bb-comercial-c-2023 | Banco do Brasil | Escriturário — Agente Comercial | 2023 | Cesgranrio | 70 | 67 | -3 | não | oficial |
| bb-2021-a | Banco do Brasil | Escriturário — Agente Comercial | 2021 | Cesgranrio | 70 | 68 | -2 | não | oficial |
| bb-2021-b | Banco do Brasil | Escriturário — Agente Comercial | 2021 | Cesgranrio | 70 | 68 | -2 | não | oficial |
| bb-2021-c | Banco do Brasil | Escriturário — Agente Comercial | 2021 | Cesgranrio | 70 | 67 | -3 | não | oficial |
| cebraspe-bnb-ti-2022 | Banco do Nordeste | Especialista Técnico — Analista de Sistemas | 2022 | Cebraspe | 60 | 60 | 0 | **sim** | oficial |
| fgv-banestes-ti-2021 | Banestes | Analista TI — Desenvolvimento de Sistemas | 2021 | FGV | 60 | 57 | -3 | não | oficial |

- **Todas as 9 fontes de prova são `oficial`** (sha256 registrado em todas). Há também **1 fonte
  `derivada`** no acervo (não associada a prova — provavelmente ligada a uma `Aula`; não investigado
  nesta fase porque `Aula` está fora do escopo de "prova/questão").
- **Nenhuma prova é `amostra`** — o corpus inteiro de provas é oficial, não mock.
- **Divergência edital vs. extraído**: toda prova perdeu de 1 a 3 questões na extração (nunca zero,
  exceto a do BNB). É consistente com os descartes registrados em `Ingestao` (seção 3).
- **Achado de metadado, não de conteúdo**: `bb-comercial-a/b/c-2023` têm `Fonte.titulo` idêntico —
  as três dizem `"(caderno tipo 1)"` — apesar de serem PROVA A, PROVA B e PROVA C (confirmado: o
  texto `**AGENTE COMERCIAL - PROVA A**` etc. aparece literalmente dentro do enunciado #4 de cada
  uma). Verificação por conteúdo mostrou que **não há duplicação** — comparando as 67 questões que
  aparecem nos três cadernos pelo mesmo `numero_na_prova`, 0/67 têm enunciado idêntico A↔B, e apenas
  1/67 idêntico A↔C (provável coincidência de um item que não variou entre cadernos). Mesmo teste em
  `bb-2021-a/b/c`: 0/67 idênticos. **São de fato 3 cadernos com conteúdo próprio da mesma aplicação**,
  só o rótulo de `Fonte.titulo` está errado/genérico.
  Script: `docs/scripts/auditoria_corpus_duplicidade.py`.
- **Observação para a Fase 4 (não é ação desta fase)**: `bb-comercial-a/b/c-2023` são 3 cadernos da
  **mesma aplicação** (mesmo cargo, mesmo ano, mesma banca, mesma data), e o mesmo vale para
  `bb-2021-a/b/c`. Se o motor de incidência contar "dispersão" como "número de provas distintas em
  que o tópico apareceu" usando o `id` da prova como unidade, uma aplicação com 3 cadernos pesa até
  3× mais que uma aplicação com 1 caderno só — não é sobre o tópico ser mais recorrente, é sobre
  quantos cadernos aquela aplicação específica publicou.

## 2. Inventário de questões

Total: **590 questões**.

| métrica | contagem |
|---|---|
| Com enunciado não-vazio | 590 / 590 |
| Com enunciado vazio | 0 |
| Tipo `multipla` | 530 |
| Tipo `certo_errado` | 60 |
| `multipla` com as 5 alternativas presentes | 530 / 530 |
| `multipla` com alternativas incompletas (1–4) | 0 |
| `multipla` sem nenhuma alternativa | 0 |
| `multipla` com as 5 alternativas presentes mas **todas com texto vazio** (bug de figura, ver `CLAUDE.md` §7.1) | 0 |
| Com gabarito preenchido | 586 / 590 |
| Sem gabarito | 4 |
| — das quais anuladas (esperado) | 4 |
| — das quais sem gabarito e **não** anuladas (inesperado) | 0 |
| Com tópico atribuído | 232 / 590 (39%) |
| Com subtópico atribuído | 56 / 590 (9%) |
| **Sem tópico atribuído** | **358 / 590 (61%)** |
| Com `texto_base` preenchido | 89 / 590 |
| Enunciado cita "o texto acima/a seguir/apresentado" etc. mas `texto_base` vazio (heurística regex) | 1 |

Leitura: o bug histórico de alternativas-vazias-por-figura (citado no `CLAUDE.md` §7.1 como motivação
dos testes do parser) **não aparece nos dados atuais** — 0 questões com as 5 alternativas vazias. As
28 rodadas de `Ingestao` registradas mostram esse caso sendo **descartado antes de persistir**
(seção 3), não gravado como questão quebrada. Isso é evidência de que a proteção já funciona — não
prova que funcionará para todo PDF futuro.

O achado "texto-base referenciado mas ausente" é **heurística por regex**, não uma verificação
confiável: só pega os enunciados que citam o texto-base com uma das 5 formulações testadas. Não
serve para afirmar "só existe 1 caso" — serve para dizer "há pelo menos 1 caso confirmado por esse
padrão específico".

Script: `docs/scripts/auditoria_corpus.py` (seção 2).

## 3. Buracos de parsing

### 3a. Descartes já registrados pelo próprio pipeline (fonte confiável)

A tabela `Ingestao` guarda o log de cada rodada de importação, incluindo o que foi descartado e por
quê. Isto é o dado mais confiável desta seção — não é heurística, é o registro do que o parser
recusou:

**28 rodadas de ingestão registradas, 55 descartes no total:**

| motivo | ocorrências |
|---|---|
| alternativas ausentes: A, B, C, D, E | 32 |
| gabarito tem, caderno não | 18 |
| alternativas ausentes: B | 2 |
| alternativas sem texto (A, B, C, D) — questão depende de figura | 1 |
| alternativas sem texto (A, B, C, D, E) — questão depende de figura | 1 |
| alternativas sem texto (A, B, D) — questão depende de figura | 1 |

Leitura: a maioria dos descartes (32) é questão cujo caderno de prova não trouxe alternativas para
extrair (não é falha do parser, é o PDF de origem sem esse conteúdo naquela página — típico de
questão só-com-figura que o pipeline nem tenta reconstruir). O segundo maior motivo (18, "gabarito
tem, caderno não") é o inverso: o gabarito oficial referencia um número de questão que não existe no
caderno de prova extraído — sinal de descompasso entre os dois PDFs de origem (prova e gabarito), não
de erro de leitura de texto.

As 3 rodadas com `status=erro` (0 detectadas, 0 importadas) não têm `prova` associada — falharam
antes de identificar qual prova estavam processando. Não investigado a fundo nesta fase (é log de
execução passada, não dado do acervo atual).

### 3b. Sinais heurísticos direto no texto persistido (menos confiável — ver ressalvas)

Três checagens por regex sobre `enunciado` e `texto_base` de todas as 590 questões:

- **Caractere de encoding quebrado** (`�`, mojibake UTF-8/Latin-1): **0 ocorrências**.
- **Espaçamento suspeito de tabela virada em linha** (4+ espaços repetidos): **0 ocorrências**.
- **Enunciado "parece truncado"** (não termina em pontuação): **338 / 590 (57%)**.

O terceiro número **é majoritariamente falso-positivo** — verificado por amostragem manual de 15
casos (script `docs/scripts/auditoria_corpus_sample.py`). A maioria das questões marcadas são
**enunciados de completar** no estilo Cesgranrio, que terminam propositalmente em preposição/verbo
porque a alternativa completa a frase — ex.: `"...a forma verbal destacada expressa a noção de"`,
`"...according to the second paragraph, the concept of robotic soccer players emerged"`. Isso é o
formato normal da banca, não falha de extração. **Não é seguro reportar "338 questões com parsing
truncado"** — o número mede "não termina em pontuação forte", que é um proxy ruim para truncamento
real neste corpus.

Dentro dessa mesma amostra de 15, porém, **2 casos mostraram corrupção real e distinta**: fórmulas
matemáticas com subscrito/sobrescrito perdido na extração —
`bb-2021-a-q17` (*"determine o termo T 2021 da sequência de Fibonacci, sabendo que T = m e 2018 T =
p. 2020 p  m"*, provavelmente T₂₀₂₁ / T₂₀₁₈ / T₂₀₂₀ com posição de subscrito embaralhada) e
`bb-2021-a-q26` (*"aplicar uma nova taxa sobre C , mas sem ultrapassar a taxa anu2 al máxima... sobre
C ? 2"*, "anual" com um dígito de subscrito solto no meio).

Buscando esse padrão especificamente (dígito colado a letras, restrito às disciplinas com fórmula —
`matematica`, `matfinanceira`, `estatistica`, `ti`): **18 questões** com o padrão, sendo a maior parte
(`no 1o`, `da 4a`, `do 4o`, `na 7a`) provavelmente indicador ordinal (º/ª) perdido na extração —
`"1o"` no lugar de `"1º"` — e a menor parte (`P2 e`, `T1 e`, `A1 e`) provavelmente nome de variável
com subscrito achatado (`P₂` → `P2`), que é **cosmético, não necessariamente quebra a legibilidade**.
Não dá para separar automaticamente qual dos 18 é cosmético e qual é como `q17`/`q26` (onde a
sequência de números fica confusa o bastante para atrapalhar resolver a questão) sem leitura manual
de cada uma — **nenhum dos dois subtotais é reportado como número confiável**, só a lista completa
de 18 IDs fica registrada no script para quem for revisar.

- **"Alternativas fora de ordem"**: não verificável — o `Meta.ordering` do model `Alternativa`
  reordena por letra em toda consulta ao banco, então a ordem de gravação original não é recuperável
  a partir do estado atual dos dados.
- **"Blocos de código destruídos"**: não verificável por regex sem amostragem manual sistemática de
  todas as 131 questões de `ti` — nenhum número é reportado para não estimar.

Scripts: `docs/scripts/auditoria_corpus.py` (seção 3), `auditoria_corpus_sample.py` (validação da
heurística de truncamento), `auditoria_corpus_formula.py` (padrão letra-dígito-letra).

## 4. Distribuição por prova / ano / disciplina

**Por ano:** 2021 → 260 · 2022 → 60 · 2023 → 270

**Por disciplina (total no acervo):**

| disciplina | questões | classificadas (tópico) |
|---|---|---|
| ti | 131 | 35 |
| informatica | 90 | 0 |
| vendas | 90 | 0 |
| bancarios | 70 | 55 |
| portugues | 64 | 45 |
| ingles | 40 | 35 |
| matematica | 35 | 28 |
| atualidades | 35 | 30 |
| matfinanceira | 30 | 0 |
| estatistica | 5 | 4 |

**Por banca:** Cesgranrio → 473 · Cebraspe → 60 · FGV → 57

**Tópicos cadastrados:** 111 · **Subtópicos:** 63 · **Disciplinas:** 10

### O recorte real de "BB / Agente de Tecnologia" (escopo desta linha de trabalho, `CLAUDE.md` §8)

A disciplina `ti` tem 131 questões no acervo, mas **espalhadas em 3 concursos diferentes**:

| prova | questões `ti` | concurso | edital compatível com BB/TI? |
|---|---|---|---|
| cebraspe-bnb-ti-2022 | 60 | Banco do Nordeste | **não** — edital Cebraspe (MVC, DevOps, contêineres, TDD), ver `CLAUDE.md` §7.7 |
| fgv-banestes-ti-2021 | 37 | Banestes | **não** — outro órgão, outro edital |
| bb-ti-2023 | 34 | Banco do Brasil, Agente de Tecnologia | **sim** — é a prova alvo |

A **única prova do cargo exato** que este brief tem como escopo (`bb-ti-2023`) contribui **34
questões de TI** para o acervo de 131 rotuladas `ti` — as outras 97 (74%) são de editais que o
`CLAUDE.md` §7.7 já identifica como incompatíveis com a árvore de tópicos do BB.

Dentro dessas 34, **31 já têm tópico atribuído (91%)** — a classificação de TI não está no estado que
o `CLAUDE.md` §7.2 descreve ("32 de 271, gargalo de quase tudo"); para o recorte que este brief
efetivamente visa, ela está quase completa. O gargalo real de classificação está em `informatica` e
`vendas` (90 + 90 = 180 questões, 0 classificadas) — mas essas disciplinas pertencem ao cargo Agente
Comercial, **fora do edital de Agente de Tecnologia** (`CLAUDE.md` §7.4), então classificá-las contra
a árvore de TI não é o problema que a Fase 1/2 deveria resolver.

`bb-ti-2023` (a prova completa, 69 questões) se divide assim: `ti` 34 · `portugues` 10 · `ingles` 5 ·
`matematica` 5 · `atualidades` 5 · `estatistica` 5 · `bancarios` 5 — o padrão de Conhecimentos Básicos
(35 questões) + Conhecimentos Específicos de TI (34 questões) descrito no edital.

Script: `docs/scripts/auditoria_corpus_escopo_ti.py`.

## 5. O que este corpus NÃO permite afirmar

- **Não permite calcular "dispersão" (nº de provas distintas) para o edital de TI do BB com qualquer
  significância.** Existe **uma única prova oficial** do cargo Agente de Tecnologia no acervo
  (`bb-ti-2023`, 34 questões de TI). Um subtópico que aparece 3 vezes nessa prova tem dispersão =
  1/1 = 100% por definição — não porque é recorrente entre provas, mas porque só há uma prova para
  comparar. A fórmula de `dispersao` da Fase 4 do brief não tem o que medir ainda neste escopo.
- **Não permite afirmar frequência do edital vigente com amostra representativa.** n=34 questões de
  TI é pequeno demais para distinguir "tópico realmente frequente na banca" de "tópico que calhou de
  aparecer nesta única aplicação". Qualquer `score` de incidência calculado agora estaria descrevendo
  uma prova, não um padrão da banca.
- **Não permite comparar Cesgranrio (BB) com Cebraspe (BNB) ou FGV (Banestes) para "raio-X de banca"
  de TI** sem antes separar por concurso — misturar as 3 no mesmo cálculo de "como a banca escreve
  questão de TI" atribuiria a uma banca padrões de outra.
- **Não permite estimar taxa de anulação por banca com confiança**: só há dados de anulação para
  quem já tem `correta` vazio + `anulada=True`, e o n por banca (473 Cesgranrio, 60 Cebraspe, 57 FGV)
  é pequeno demais para generalizar "a banca X anula mais que a banca Y" a partir de 1–2 provas por
  banca.
- **Não permite tratar as 358 questões sem tópico (61% do acervo total) como "não vão ser
  classificadas"** — a maior parte delas (180 de `informatica`/`vendas`) está fora do escopo de TI
  por desenho, não por atraso; mas 97 são de `ti` de outros concursos (Cebraspe/FGV) que a Fase 1/2
  também não deveria forçar contra a árvore do BB (dívida do `CLAUDE.md` §7.7). Só uma fatia pequena
  do "sem tópico" é de fato dívida de classificação dentro do escopo desta linha de trabalho.
- **Não permite confirmar ou descartar corrupção de fórmula/subscrito em escala** — os 18 casos do
  padrão letra-dígito-letra (seção 3b) não foram lidos um a um; o número é "candidatos a revisar", não
  "questões confirmadamente quebradas".
- **Não permite afirmar que a extração de blocos de código ou tabelas está intacta** — não há
  verificação automática capaz de confirmar isso com os dados atuais; ficou marcado como não
  verificável, não como "sem problema".

## Scripts desta auditoria

Todos em `docs/scripts/`, standalone (`python arquivo.py` de dentro de `backend/`, com o venv
ativado), escrevem saída em UTF-8 num `.txt` ao lado para evitar problemas de codepage do console:

- `auditoria_corpus.py` — inventário de provas/questões, descartes de ingestão, distribuição.
- `auditoria_corpus_sample.py` — validação manual da heurística de truncamento.
- `auditoria_corpus_formula.py` — padrão de subscrito/ordinal corrompido.
- `auditoria_corpus_duplicidade.py` — checagem de conteúdo duplicado entre cadernos A/B/C.
- `auditoria_corpus_escopo_ti.py` — recorte de disciplina `ti` por prova/concurso.
