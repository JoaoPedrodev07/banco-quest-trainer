import type { Concurso, Disciplina, Questao } from "@/types";

/**
 * Monta o prompt que o usuário leva para uma IA de fora (ChatGPT, Claude, Gemini)
 * ou usa para orientar a busca no YouTube.
 *
 * O app não chama LLM nenhum: não há chave de API no projeto e não vai haver. O
 * que ele faz de útil é o que a IA de fora não tem — juntar o subtópico do edital
 * com **as questões reais da banca** que já estão no acervo. Sem esse contexto a
 * IA inventa o nível de profundidade e o estilo; com ele, ela vê exatamente como
 * o assunto foi cobrado.
 *
 * O prompt pede profundidade proporcional ao peso do assunto na prova, e esse
 * peso é passado como número medido (quantas questões daquele subtópico existem
 * no acervo, de quantas no total), não como regra fixa por disciplina. Assim a
 * instrução continua verdadeira quando o acervo crescer.
 */

/** Quantas questões de exemplo entram no prompt. Mais que isso deixa o texto longo demais para colar. */
const MAX_QUESTOES_EXEMPLO = 3;

export interface ContextoPrompt {
  disciplina: Disciplina;
  topicoNome: string;
  subtopicoNome: string | null;
  subtopicoId: string;
  concurso: Concurso;
  /** Questões já classificadas neste subtópico (ou no tópico, quando não há subtópico). */
  questoes: Questao[];
  /**
   * Total de questões **da mesma disciplina**, não do acervo inteiro. O acervo
   * mistura cargos (a prova de Agente Comercial traz Informática e Vendas, que o
   * candidato de TI nunca responde), então "3 de 271" daria um peso ridículo e
   * falso. "3 de 35 questões de TI" é a proporção que o candidato de fato enfrenta.
   */
  totalDaDisciplina: number;
  /** Quantas questões da disciplina ainda não foram classificadas — o prompt não finge cobertura que não tem. */
  naoClassificadasNaDisciplina: number;
}

function alternativasEmTexto(q: Questao): string {
  return q.alternativas.map((a) => `(${a.letra}) ${a.texto}`).join("\n");
}

function questaoEmTexto(q: Questao, indice: number): string {
  const partes = [`### Questão ${indice + 1} — ${q.banca} ${q.ano}`];
  if (q.textoBase) {
    // O texto-base costuma ser longo (uma reportagem inteira serve a um bloco de
    // questões). Cortar aqui evita um prompt que não cabe em chat gratuito.
    const base = q.textoBase.length > 600 ? `${q.textoBase.slice(0, 600)}…` : q.textoBase;
    partes.push(`Texto de apoio: ${base}`);
  }
  partes.push(q.enunciado, alternativasEmTexto(q));
  partes.push(q.correta ? `Gabarito oficial: ${q.correta}` : "Questão anulada pela banca.");
  return partes.join("\n\n");
}

export function montarPromptEstudo(ctx: ContextoPrompt): string {
  const { disciplina, topicoNome, subtopicoNome, concurso, questoes } = ctx;
  const { totalDaDisciplina, naoClassificadasNaDisciplina } = ctx;
  const exemplos = questoes.slice(0, MAX_QUESTOES_EXEMPLO);

  const banca = concurso.banca
    ? `A banca é a ${concurso.banca}.`
    : "A banca ainda não foi definida — as questões de exemplo abaixo são de provas anteriores do mesmo órgão, então use o estilo delas como referência, mas não afirme que a próxima prova será igual.";

  // A ressalva sobre o que ainda não foi classificado precisa acompanhar o número,
  // senão a IA lê "1 de 35" como "assunto raro" quando na verdade pode ser
  // "ninguém etiquetou o resto ainda".
  const ressalva =
    naoClassificadasNaDisciplina > 0
      ? ` Atenção: ${naoClassificadasNaDisciplina} das ${totalDaDisciplina} questões desta disciplina ainda não foram classificadas por assunto, então esse número é um piso, não a contagem final.`
      : "";

  const peso =
    questoes.length > 0
      ? `Das ${totalDaDisciplina} questões de ${disciplina.nome} em provas anteriores, ${questoes.length} ${questoes.length === 1 ? "é" : "são"} deste assunto. Calibre a profundidade por essa proporção: assunto que aparece pouco merece uma revisão enxuta, não um tratado.${ressalva}`
      : `Nenhuma das ${totalDaDisciplina} questões de ${disciplina.nome} do acervo foi identificada como deste assunto. Seja conciso e priorize o que é mais cobrável, sem esgotar o tema.${ressalva}`;

  const blocos = [
    `Quero estudar um assunto específico para um concurso público brasileiro. Aja como um professor que prepara candidatos para esta banca.`,
    `## O que preciso estudar
- Concurso: ${concurso.nome} (${concurso.orgao})
- Cargo: ${concurso.cargo}
- Disciplina: ${disciplina.nome}
- Tópico do edital: ${topicoNome}${subtopicoNome ? `\n- Subtópico: ${subtopicoNome}` : ""}

${banca}`,
    `## Peso deste assunto na prova
${peso}`,
  ];

  if (exemplos.length > 0) {
    blocos.push(
      `## Como este assunto já foi cobrado
Estas são questões **reais** de provas anteriores, com o gabarito oficial. Use-as para calibrar profundidade, vocabulário e o tipo de pegadinha da banca.

${exemplos.map(questaoEmTexto).join("\n\n---\n\n")}`,
    );
  }

  blocos.push(
    `## O que quero de você
1. Explique o assunto do zero, assumindo que eu não sei nada dele. Use linguagem simples e exemplos do dia a dia antes de usar termo técnico.
2. Resolva cada questão de exemplo acima passo a passo, explicando **por que cada alternativa errada está errada** — é onde eu mais perco ponto.
3. Aponte as pegadinhas recorrentes da banca neste assunto.
4. Feche com um resumo de 10 linhas que eu possa reler no dia da prova.
5. No fim, sugira 3 termos de busca para eu procurar videoaula no YouTube sobre isso.

Se algum ponto do assunto costuma cair mas não aparece nas questões acima, diga isso explicitamente em vez de omitir.

## Formato da resposta
Responda em **Markdown**, com títulos (\`##\`), listas e **negrito**. Vou colar sua resposta inteira num app que renderiza Markdown, então não escreva nada fora dela (sem "claro, aqui está" no começo). Fórmulas podem ir em texto simples — evite LaTeX, porque o app não renderiza fórmula.`,
  );

  return blocos.join("\n\n");
}

/**
 * Prompt do gabarito comentado de uma questão.
 *
 * Separado do prompt de aula porque a pergunta é outra: aqui o assunto já foi
 * estudado e o que falta é entender **aquela** questão — em especial por que as
 * outras quatro alternativas estão erradas, que é o que a banca cobra e o que o
 * gabarito oficial nunca explica (a banca publica a letra, não o raciocínio).
 */
export function montarPromptGabarito(
  questao: Questao,
  disciplinaNome: string,
  banca: string | null,
): string {
  const cabecalho = banca
    ? `Esta questão é da banca ${banca}.`
    : "A banca da minha prova ainda não foi definida; esta questão é de uma prova anterior do mesmo órgão.";

  return [
    `Explique o gabarito desta questão de concurso público. Aja como um professor corrigindo a prova comigo.`,
    `## A questão
- Disciplina: ${disciplinaNome}
- Prova: ${questao.banca} ${questao.ano}

${cabecalho}

${questaoEmTexto(questao, 0)}`,
    `## O que quero de você
Responda em DUAS profundidades, nesta ordem (é o que me permite conferir rápido quando sei o assunto e mergulhar quando não sei):

**Primeira seção — \`## Em 2 linhas\`**: o assunto exato cobrado e por que a alternativa correta está correta, em no máximo 2 linhas.

**Segunda seção — \`## Explicação completa\`**:
1. Diga qual é o assunto exato cobrado — o mais específico possível, não "matemática" mas "regra de três composta".
2. Explique o raciocínio até a resposta correta, passo a passo, sem pular etapa.
3. **Para cada uma das outras alternativas, explique por que está errada.** Se alguma foi feita para induzir a um erro comum, diga qual erro é esse.
4. Diga o que eu precisaria saber de antemão para acertar esta questão em 2 minutos de prova.

${questao.correta ? "" : "Atenção: esta questão foi **anulada** pela banca e não tem gabarito oficial. Explique o que provavelmente causou a anulação, e não invente uma resposta correta.\n\n"}## Formato da resposta
Responda em **Markdown**, sem nenhum texto fora dela. Evite LaTeX — o app não renderiza fórmula.`,
  ].join("\n\n");
}

/**
 * Busca no YouTube já com banca e assunto — o outro canal de estudo, sem custo.
 *
 * O nome do subtópico no edital costuma vir com uma lista entre parênteses
 * ("Python 3.9.X aplicada para IA/ML e Analytics (bibliotecas Pandas, NumPy,
 * SciPy, ...)"). Jogar isso inteiro na busca não devolve vídeo nenhum, então o
 * parêntese sai e o texto é cortado nas primeiras palavras.
 */
export function linkYouTube(assunto: string, disciplinaNome: string, banca: string | null): string {
  const enxuto = assunto
    .replace(/\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .slice(0, 6)
    .join(" ");
  const termos = [banca, disciplinaNome, enxuto, "concurso"].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(termos)}`;
}
