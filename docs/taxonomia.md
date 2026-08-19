# Taxonomia canônica do edital — Fase 1

> Gerado por `docs/scripts/gerar_taxonomia_md.py` a partir do banco. Fonte da verdade dos
> dados: `backend/dados_brutos/bb2023-edital.pdf`, importado por
> `manage.py importar_edital` para as tabelas `catalogo.Disciplina` / `Topico` / `Subtopico`.
> Concurso: `bb-ti-2026`. Data de geração: 2026-08-05.

## Por que não é um app novo (`backend/apps/edital/taxonomia.py`)

O brief da Fase 1 pede a árvore num módulo novo. Esse acervo já tinha `catalogo.models.Disciplina/Topico/Subtopico` — um `Topico` populado direto do PDF do edital por `manage.py importar_edital`, com `nome` guardando a redação literal do item (o `titulo_edital` que o brief pede como campo separado). Criar uma segunda árvore paralela duplicaria dado que já existe e abriria espaço pra divergência entre as duas — exatamente o que o `CLAUDE.md` §2.3 proíbe. Por isso a Fase 1 **estendeu o que já existia** em vez de recomeçar.

## Por que os slugs NÃO viraram `ti.bd.sql.joins`

O brief pede slug "legível" tipo `ti.bd.sql.joins`. Os ids atuais são posicionais — `ti-t02`, `ti-t02-s03` — e **ficam assim**, por uma razão que o brief não tinha como prever: o próprio model já documenta que esses ids **são a chave primária de propósito**, porque já existem no frontend e no localStorage do usuário (`EditalStatus` em `src/store/useStore.ts`, indexado por `subtopicoId`; revisões agendadas também apontam pra cá). Trocar o esquema de id agora não é reorganizar um detalhe interno — é invalidar o progresso de estudo que qualquer usuário já tenha salvo no navegador, sem forma de migrar (não há conta, não há como avisar quem está afetado). Isso é exatamente o tipo de dano que o `CLAUDE.md` §2.4 pede pra evitar.

O que a Fase 1 mudou foi a parte seguura de mudar: `edital_ref` (a numeração do edital, só pra referência) e `ativo_edital_vigente` (a política de deprecação abaixo) — sem tocar no id de nenhum tópico já existente.

## Regra de nomenclatura do slug (id)

- **Tópico**: `[<concurso_id>--]<disciplina_id>-t<NN>`, `NN` = posição do item dentro da
  disciplina, 2 dígitos. O prefixo do concurso só existe quando `concurso_id != "bb-ti-2026"`
  (o concurso padrão manteve os ids sem prefixo por compatibilidade com as classificações e
  o localStorage que já existiam antes de o backend separar por concurso).
- **Subtópico**: `<id do tópico pai>-s<NN>`, mesma régua.
- **Nunca renomeie um id depois de criado.** Se o edital renumerar um item (não só editar o
  texto), `manage.py importar_edital` avisa no stdout (`[atenção] ... mudou de conteúdo`) —
  isso significa que o id antigo passou a apontar pra um item diferente do edital, e quem
  decide o que fazer (reclassificar as questões daquele tópico, ou tratar como item novo) é
  humano, não o importador.
- **`nome`** é a redação literal do edital (equivalente ao `titulo_edital` do brief) — nunca
  parafraseado. **`edital_ref`** é só a numeração pra achar o item no PDF original, não é
  chave de nada.
- **`nível`** e **`pai`** (que o brief pede como campos) não existem como coluna: nível é
  qual model a linha é (`Disciplina` = 1, `Topico` = 2, `Subtopico` = 3) e pai é a FK que já
  existe (`Topico.disciplina`, `Subtopico.topico`). Adicionar coluna pra isso seria estado
  derivado duplicado — `CLAUDE.md` §2.3.

## Política de deprecação

`ativo_edital_vigente=False` no lugar de deletar. Um `Topico`/`Subtopico` some da tela de edital vigente, mas continua no banco — porque `Questao.topico`/`Questao.subtopico` apontam pra ele, e apagar acionaria o `SET_NULL` e devolveria a questão pra "sem classificação" silenciosamente. `manage.py importar_edital` já foi corrigido nesta fase: antes fazia `delete()` de toda a árvore do concurso e recriava do zero a cada reimportação — o que zerava a classificação de qualquer questão entre o delete e o recreate. Agora faz `update_or_create` por item e só marca `ativo_edital_vigente=False` no que não veio na leitura mais recente.

## Cobertura do corpus (critério de aceite da Fase 1)

Toda disciplina que aparece nas 590 questões do corpus já existe na árvore (10 disciplinas distintas em uso, 10 cadastradas). Disciplinas do corpus ausentes da árvore: nenhuma.
Verificação mais forte que a amostra de 20 questões pedida no brief: aqui é o corpus inteiro, não uma amostra — toda `Questao.disciplina_id` é FK pra uma `Disciplina` que já está na árvore, então nenhuma questão pode existir apontando pra disciplina fora dela.

## Árvore completa

### Língua Portuguesa (`portugues`)

- **`portugues-t01`** [1] Compreensão de textos — 13 questões
- **`portugues-t02`** [2] Ortografia oficial — 1 questões
- **`portugues-t03`** [3] Classe e emprego de palavras — 2 questões
- **`portugues-t04`** [4] Emprego do acento indicativo de crase — 6 questões
- **`portugues-t05`** [5] Sintaxe da oração e do período — 2 questões
- **`portugues-t06`** [6] Emprego dos sinais de pontuação — 5 questões
- **`portugues-t07`** [7] Concordância verbal e nominal — 7 questões
- **`portugues-t08`** [8] Regência verbal e nominal — 2 questões
- **`portugues-t09`** [9] Colocação dos pronomes oblíquos átonos (próclise, mesóclise e ênclise) — 7 questões

### Língua Inglesa (`ingles`)

- **`ingles-t01`** [1] Conhecimento de um vocabulário fundamental e dos aspectos gramaticais básicos para a compreensão de textos — 35 questões

### Matemática (`matematica`)

- **`matematica-t01`** [1] Números inteiros, racionais e reais; problemas de contagem — 5 questões
- **`matematica-t02`** [2] Sistema legal de medidas — 0 questões
- **`matematica-t03`** [3] Razões e proporções; divisão proporcional; regras de três simples e compostas; porcentagens — 6 questões
- **`matematica-t04`** [4] Lógica proposicional — 2 questões
- **`matematica-t05`** [5] Noções de conjuntos — 1 questões
- **`matematica-t06`** [6] Relações e funções; Funções polinomiais; Funções exponenciais e logarítmicas — 4 questões
- **`matematica-t07`** [7] Matrizes — 2 questões
- **`matematica-t08`** [8] Determinantes — 0 questões
- **`matematica-t09`** [9] Sistemas lineares — 3 questões
- **`matematica-t10`** [10] Sequências — 2 questões
- **`matematica-t11`** [11] Progressões aritméticas e progressões geométricas — 3 questões

### Probabilidade e Estatística (`estatistica`)

- **`estatistica-t01`** [1] Representação tabular e gráfica — 0 questões
- **`estatistica-t02`** [2] Medidas de tendência central (média, mediana, moda, medidas de posição, mínimo e máximo) e de dispersão (amplitude, amplitude interquartil, variância, desvio padrão e coeficiente de variação) — 1 questões
- **`estatistica-t03`** [3] Variáveis aleatórias e distribuição de probabilidade — 1 questões
- **`estatistica-t04`** [4] Teorema de Bayes — 0 questões
- **`estatistica-t05`** [5] Probabilidade condicional — 0 questões
- **`estatistica-t06`** [6] População e amostra — 0 questões
- **`estatistica-t07`** [7] Variância e covariância — 0 questões
- **`estatistica-t08`** [8] Correlação linear simples — 0 questões
- **`estatistica-t09`** [9] Distribuição binomial e distribuição normal — 1 questões
- **`estatistica-t10`** [10] Noções de amostragem e inferência estatística — 1 questões

### Atualidades do Mercado Financeiro (`atualidades`)

- **`atualidades-t01`** [1] Os bancos na Era Digital — 5 questões
  - `atualidades-t01-s01` [1.1] Atualidade, tendências e desafios — 0 questões
- **`atualidades-t02`** [2] Internet banking — 2 questões
- **`atualidades-t03`** [3] Mobile banking — 0 questões
- **`atualidades-t04`** [4] Open banking — 2 questões
- **`atualidades-t05`** [5] Novos modelos de negócios — 0 questões
- **`atualidades-t06`** [6] Fintechs, startups e big techs — 3 questões
- **`atualidades-t07`** [7] Sistema de bancos-sombra (Shadow banking) — 3 questões
- **`atualidades-t08`** [8] Funções da moeda — 6 questões
- **`atualidades-t09`** [9] O dinheiro na era digital — 5 questões
  - `atualidades-t09-s01` [9.1] blockchain, bitcoin e demais criptomoedas — 0 questões
- **`atualidades-t10`** [10] Marketplace — 1 questões
- **`atualidades-t11`** [11] Correspondentes bancários — 1 questões
- **`atualidades-t12`** [12] Arranjos de pagamentos — 1 questões
- **`atualidades-t13`** [13] Sistema de pagamentos instantâneos (PIX) — 0 questões
- **`atualidades-t14`** [14] Segmentação e interações digitais — 0 questões
- **`atualidades-t15`** [15] Transformação digital no Sistema Financeiro — 1 questões

### Conhecimentos Bancários (`bancarios`)

- **`bancarios-t01`** [1] Sistema Financeiro Nacional — 4 questões
  - `bancarios-t01-s01` [1.1] Estrutura do Sistema Financeiro Nacional — 0 questões
  - `bancarios-t01-s02` [1.2] Órgãos normativos e instituições supervisoras, executoras e operadoras — 4 questões
- **`bancarios-t02`** [2] Mercado financeiro e seus desdobramentos (mercados monetário, de crédito, de capitais e cambial) — 1 questões
- **`bancarios-t03`** [3] Moeda e política monetária — 4 questões
  - `bancarios-t03-s01` [3.1] Políticas monetárias convencionais e não-convencionais (Quantitative Easing) — 1 questões
  - `bancarios-t03-s02` [3.2] Taxa SELIC e operações compromissadas — 1 questões
  - `bancarios-t03-s03` [3.3] O debate sobre os depósitos remunerados dos bancos comerciais no Banco Central do Brasil — 0 questões
- **`bancarios-t04`** [4] Orçamento público, títulos do Tesouro Nacional e dívida pública — 2 questões
- **`bancarios-t05`** [5] Produtos Bancários — 6 questões
  - `bancarios-t05-s01` [5.1] Noções de cartões de crédito e débito, crédito direto ao consumidor, crédito rural, poupança, capitalização, previdência, consórcio, investimentos e seguros — 4 questões
- **`bancarios-t06`** [6] Noções de Mercado de capitais — 4 questões
- **`bancarios-t07`** [7] Noções de Mercado de Câmbio — 4 questões
  - `bancarios-t07-s01` [7.1] Instituições autorizadas a operar e operações básicas — 1 questões
- **`bancarios-t08`** [8] Regimes de taxas de câmbio fixas, flutuantes e regimes intermediários — 2 questões
- **`bancarios-t09`** [9] Taxas de câmbio nominais e reais — 5 questões
- **`bancarios-t10`** [10] Impactos das taxas de câmbio sobre as exportações e importações — 1 questões
- **`bancarios-t11`** [11] Diferencial de juros interno e externo, prêmios de risco, fluxo de capitais e seus impactos sobre as taxas de câmbio — 5 questões
- **`bancarios-t12`** [12] Dinâmica do Mercado — 0 questões
  - `bancarios-t12-s01` [12.1] Operações no mercado interbancário — 0 questões
- **`bancarios-t13`** [13] Mercado bancário — 2 questões
  - `bancarios-t13-s01` [13.1] Operações de tesouraria, varejo bancário e recuperação de crédito — 2 questões
- **`bancarios-t14`** [14] Taxas de juros de curto prazo e a curva de juros; taxas de juros nominais e reais — 3 questões
- **`bancarios-t15`** [15] Garantias do Sistema Financeiro Nacional — 2 questões
  - `bancarios-t15-s01` [15.1] aval — 0 questões
  - `bancarios-t15-s02` [15.2] fiança — 0 questões
  - `bancarios-t15-s03` [15.3] penhor mercantil — 0 questões
  - `bancarios-t15-s04` [15.4] alienação fiduciária — 1 questões
  - `bancarios-t15-s05` [15.5] hipoteca — 0 questões
  - `bancarios-t15-s06` [15.6] fianças bancárias — 0 questões
- **`bancarios-t16`** [16] Crime de lavagem de dinheiro — 1 questões
  - `bancarios-t16-s01` [16.1] conceito e etapas — 0 questões
  - `bancarios-t16-s02` [16.2] Prevenção e combate ao crime de lavagem de dinheiro: Lei nº 9.613/98 e suas alterações — 0 questões
  - `bancarios-t16-s03` [16.3] Circular nº 3.978, de 23 de janeiro de 2020 e Carta Circular nº 4.001, de 29 de janeiro de 2020 e suas alterações — 0 questões
- **`bancarios-t17`** [17] Autorregulação bancária e Normativos SARB — 0 questões
- **`bancarios-t18`** [18] Sigilo Bancário — 0 questões
  - `bancarios-t18-s01` [18.1] Lei Complementar nº 105/2001 e suas alterações — 0 questões
- **`bancarios-t19`** [19] Lei Geral de Proteção de Dados (LGPD) — 2 questões
  - `bancarios-t19-s01` [19.1] Lei nº 13.709, de 14 de agosto de 2018 e suas alterações — 2 questões
- **`bancarios-t20`** [20] Legislação anticorrupção — 0 questões
  - `bancarios-t20-s01` [20.1] Lei nº 12.846/2013 e Decreto nº 11.129 de 11/07/2022 — 0 questões
- **`bancarios-t21`** [21] Segurança cibernética — 1 questões
  - `bancarios-t21-s01` [21.1] Resolução CMN nº 4.893, de 26/02/2021 — 1 questões
- **`bancarios-t22`** [22] Ética aplicada — 5 questões
  - `bancarios-t22-s01` [22.1] ética, moral, valores e virtudes — 0 questões
  - `bancarios-t22-s02` [22.2] noções de ética empresarial e profissional. A gestão da ética nas empresas públicas e privadas. Código de Ética do Banco do Brasil (disponível no sítio do BB na internet) — 5 questões
- **`bancarios-t23`** [23] Política de Responsabilidade Socioambiental do Banco do Brasil (disponível no sítio do BB na internet) — 0 questões
- **`bancarios-t24`** [24] ASG (Ambiental, Social e Governança) — 1 questões
  - `bancarios-t24-s01` [24.1] Economia Sustentável — 0 questões
  - `bancarios-t24-s02` [24.2] Financiamentos — 0 questões
  - `bancarios-t24-s03` [24.3] Mercado PJ — 0 questões

### Tecnologia da Informação (`ti`)

- **`ti-t01`** [1] Aprendizagem de máquina — 2 questões
  - `ti-t01-s01` [1.1] Fundamentos básicos — 1 questões
  - `ti-t01-s02` [1.2] Noções de algoritmos de aprendizado supervisionados e não supervisionados — 0 questões
  - `ti-t01-s03` [1.3] Noções de processamento de linguagem natural — 1 questões
- **`ti-t02`** [2] Banco de Dados — 8 questões
  - `ti-t02-s01` [2.1] Banco de dados NoSQL (conceitos básicos, bancos orientados a grafos, colunas, chave/valor e documentos) — 2 questões
  - `ti-t02-s02` [2.2] MongoDB — 0 questões
  - `ti-t02-s03` [2.3] linguagem SQL2008 — 1 questões
  - `ti-t02-s04` [2.4] Conceitos de banco de dados e sistemas gerenciadores de bancos de dados (SGBD) — 2 questões
  - `ti-t02-s05` [2.5] Data Warehouse (modelagem conceitual para data warehouses, dados multidimensionais) — 0 questões
  - `ti-t02-s06` [2.6] Modelagem conceitual de dados (a abordagem entidade-relacionamento) — 2 questões
  - `ti-t02-s07` [2.7] Modelo relacional de dados (conceitos básicos, normalização) — 1 questões
  - `ti-t02-s08` [2.8] Postgre-SQL — 0 questões
- **`ti-t03`** [3] Big data — 4 questões
  - `ti-t03-s01` [3.1] Fundamentos — 1 questões
  - `ti-t03-s02` [3.2] Técnicas de preparação e apresentação de dados — 3 questões
- **`ti-t04`** [4] Desenvolvimento Mobile — 5 questões
  - `ti-t04-s01` [4.1] linguagens/frameworks: Java/Kotlin e Swift. React Native 0.59 — 3 questões
  - `ti-t04-s02` [4.2] Sistemas Android api 30 e iOS xCode 10 — 2 questões
- **`ti-t05`** [5] Estrutura de dados e algoritmos — 6 questões
  - `ti-t05-s01` [5.1] Busca sequencial e busca binária sobre arrays — 1 questões
  - `ti-t05-s02` [5.2] Ordenação (métodos da bolha, ordenação por seleção, ordenação por inserção), lista encadeada, pilha, fila e noções sobre árvore binária — 4 questões
- **`ti-t06`** [6] Ferramentas e Linguagens de Programação para manipulação de dados — 10 questões
  - `ti-t06-s01` [6.1] Ansible — 1 questões
  - `ti-t06-s02` [6.2] Java (SE 11 e EE 8) — 4 questões
  - `ti-t06-s03` [6.3] TypeScript 4.0 — 2 questões
  - `ti-t06-s04` [6.4] Python 3.9.X aplicada para IA/ML e Analytics (bibliotecas Pandas, NumPy, SciPy, Matplotlib e Scikit-learn) — 3 questões

### Conhecimentos de Informática (`informatica`)

- **`informatica-t01`** [1] Noções de sistemas operacionais – Windows 10 (32-64 bits) e ambiente Linux (SUSE SLES 15 SP2) — 0 questões
- **`informatica-t02`** [2] Edição de textos, planilhas e apresentações (ambientes Microsoft Office - Word, Excel e PowerPoint - versão O365) — 0 questões
- **`informatica-t03`** [3] Segurança da informação — 0 questões
  - `informatica-t03-s01` [3.1] fundamentos, conceitos e mecanismos de segurança — 0 questões
- **`informatica-t04`** [4] Proteção de estações de trabalho — 0 questões
  - `informatica-t04-s01` [4.1] Controle de dispostivos USB, hardening, antimalware e firewall pessoal — 0 questões
- **`informatica-t05`** [5] Conceitos de organização e de gerenciamento de informações, arquivos, pastas e programas — 0 questões
- **`informatica-t06`** [6] Redes de computadores — 0 questões
  - `informatica-t06-s01` [6.1] Conceitos básicos, ferramentas, aplicativos e procedimentos de Internet e intranet — 0 questões
- **`informatica-t07`** [7] Navegador Web (Microsoft Edge versão 91 e Mozilla Firefox versão 78 ESR), busca e pesquisa na Web — 0 questões
- **`informatica-t08`** [8] Correio eletrônico, grupos de discussão, fóruns e wikis — 0 questões
- **`informatica-t09`** [9] Redes Sociais (Twitter, Facebook, Linkedin, WhatsApp, YouTube, Instagram e Telegram) — 0 questões
- **`informatica-t10`** [10] Visão geral sobre sistemas de suporte à decisão e inteligência de negócio — 0 questões
- **`informatica-t11`** [11] Fundamentos sobre análise de dados — 0 questões
- **`informatica-t12`** [12] Conceitos de educação a distância — 0 questões
- **`informatica-t13`** [13] Conceitos de tecnologias e ferramentas multimídia, de reprodução de áudio e vídeo — 0 questões
- **`informatica-t14`** [14] Ferramentas de produtividade e trabalho a distância (Microsoft Teams, Cisco Webex, Google Hangout, Google Drive e Skype) — 0 questões

### Vendas e Negociação (`vendas`)

- **`vendas-t01`** [1] Noções de estratégia empresarial — 0 questões
  - `vendas-t01-s01` [1.1] análise de mercado, forças competitivas, imagem institucional, identidade e posicionamento — 0 questões
- **`vendas-t02`** [2] Segmentação de mercado — 0 questões
- **`vendas-t03`** [3] Ações para aumentar o valor percebido pelo cliente — 0 questões
- **`vendas-t04`** [4] Gestão da experiência do cliente — 0 questões
- **`vendas-t05`** [5] Aprendizagem e sustentabilidade organizacional — 0 questões
- **`vendas-t06`** [6] Características dos serviços — 0 questões
  - `vendas-t06-s01` [6.1] intangibilidade, inseparabilidade, variabilidade e perecibilidade — 0 questões
- **`vendas-t07`** [7] Gestão da qualidade em serviços — 0 questões
- **`vendas-t08`** [8] Técnicas de vendas — 0 questões
  - `vendas-t08-s01` [8.1] da pré-abordagem ao pós-vendas — 0 questões
- **`vendas-t09`** [9] Noções de marketing digital — 0 questões
  - `vendas-t09-s01` [9.1] geração de leads — 0 questões
  - `vendas-t09-s02` [9.2] técnica de copywriting — 0 questões
  - `vendas-t09-s03` [9.3] gatilhos mentais — 0 questões
  - `vendas-t09-s04` [9.4] Inbound marketing — 0 questões
- **`vendas-t10`** [10] Ética e conduta profissional em vendas — 0 questões
- **`vendas-t11`** [11] Padrões de qualidade no atendimento aos clientes — 0 questões
- **`vendas-t12`** [12] Utilização de canais remotos para vendas — 0 questões
- **`vendas-t13`** [13] Comportamento do consumidor e sua relação com vendas e negociação — 0 questões
- **`vendas-t14`** [14] Política de Relacionamento com o Cliente — 0 questões
  - `vendas-t14-s01` [14.1] Resolução nº 4.949, de 30 de setembro de 2021 — 0 questões
- **`vendas-t15`** [15] Resolução CMN nº 4.860, de 23 de outubro de 2020 que dispõe sobre a constituição e o funcionamento de componente organizacional de ouvidoria pelas instituições financeiras e demais instituições autorizadas a funcionar pelo Banco Central do Brasil — 0 questões
- **`vendas-t16`** [16] Lei Brasileira de Inclusão da Pessoa com Deficiência (Estatuto da Pessoa com Deficiência) — 0 questões
  - `vendas-t16-s01` [16.1] Lei nº 13.146, de 06 de julho de 2015 — 0 questões
- **`vendas-t17`** [17] Código de Proteção e Defesa do Consumidor — 0 questões
  - `vendas-t17-s01` [17.1] Lei nº 8.078/1990 (versão atualizada). ANEXO IV - CRONOGAMA EVENTOS BÁSICOS DATAS Inscrições. 23/12/2022 a 24/02/2023 Solicitação de inscrição com isenção do valor da mesma. 23/12/2022 a 03/01/2023 Resultado preliminar dos pedidos de isenção do valor de inscrição. 12/01/2023 Prazo para recurso dos(a — 0 questões

### Matemática Financeira (`matfinanceira`)

- **`matfinanceira-t01`** [1] Conceitos gerais - O conceito do valor do dinheiro no tempo; Capital, juros, taxas de juros; Capitalização, regimes de capitalização; Fluxos de caixa e diagramas de fluxo de caixa; Equivalência financeira — 0 questões
- **`matfinanceira-t02`** [2] Juros simples -Cálculo do montante, dos juros, da taxa de juros, do principal e do prazo da operação financeira — 0 questões
- **`matfinanceira-t03`** [3] Juros compostos - Cálculo do montante, dos juros, da taxa de juros, do principal e do prazo da operação financeira — 0 questões
- **`matfinanceira-t04`** [4] Sistemas de amortização - Sistema price; Sistema SAC — 0 questões

## Números

- Disciplinas: 10
- Tópicos (concurso `bb-ti-2026`): 111
- Subtópicos: 63
- Tópicos inativos (fora do edital vigente): 0
