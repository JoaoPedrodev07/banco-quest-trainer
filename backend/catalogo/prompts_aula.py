"""
Monta o prompt da aula de uma unidade do edital, do lado do servidor.

**Gêmeo deliberado de `src/lib/promptEstudo.ts`, não substituto dele.** O caminho
de copiar-e-colar continua existindo e continua sendo o padrão de custo zero: o
app monta o prompt, o usuário leva numa IA gratuita e cola a resposta. Este
módulo serve ao outro caminho, o de geração em lote (`manage.py gerar_aulas`),
onde a chamada sai da máquina do mantenedor e a aula já chega pronta no acervo.

Os dois montam **o mesmo pedido**, e isso é intencional: se divergirem, a aula
colada e a aula gerada passam a ensinar coisas diferentes sobre o mesmo item do
edital, e ninguém percebe olhando a tela. Mudou a regra pedagógica aqui? Mude lá
também.

O que este prompt tem de próprio, e que uma IA de fora não teria sozinha, são as
**questões reais da banca** sobre o assunto. Sem elas a IA chuta a profundidade e
o estilo; com elas, ela vê exatamente como o assunto já foi cobrado.

O peso do assunto vai como número medido — quantas questões daquela unidade
existem no acervo, de quantas da disciplina — e nunca como regra fixa por
disciplina. E vai acompanhado de quantas questões da disciplina ainda não foram
classificadas, senão "1 de 35" é lido como "assunto raro" quando pode ser só
"ninguém etiquetou o resto ainda" (`CLAUDE.md` §8: toda afirmação estatística
carrega o `n` que a sustenta).
"""

from __future__ import annotations

from dataclasses import dataclass

from catalogo.models import Disciplina, Questao, Subtopico, Topico

# Quantas questões reais entram como exemplo.
#
# São 5 aqui contra 3 em `promptEstudo.ts`, e a diferença tem motivo: lá o texto
# precisa caber num campo de chat gratuito que o usuário cola à mão, aqui vai
# direto pela API. Mais exemplo é mais contexto de estilo da banca; o teto existe
# só para o prompt não virar a maior parte do custo.
MAX_QUESTOES_EXEMPLO = 5

# Corte do texto-base. Uma reportagem inteira serve a um bloco de questões e
# sozinha passaria do tamanho do resto do prompt.
MAX_TEXTO_BASE = 600


# A instrução pedagógica é idêntica para toda unidade do edital, então vive fora
# da mensagem do usuário: assim ela entra uma vez como prefixo estável e o cache
# de prompt cobre todas as unidades da mesma rodada (só o bloco final, com o
# assunto e as questões, muda de uma chamada para a outra).
SISTEMA = """\
Você é um professor que prepara candidatos para concurso público brasileiro. \
Escreve para quem está começando o assunto do zero, sem assumir conhecimento \
prévio, e conhece o estilo da banca que vai cobrar.

## Como escrever a aula

1. Explique o assunto do zero. Use linguagem simples e um exemplo do dia a dia \
antes de introduzir cada termo técnico — o termo vem depois da ideia, nunca antes.
2. Resolva cada questão de exemplo passo a passo, explicando **por que cada \
alternativa errada está errada**. É onde o candidato mais perde ponto, e o \
gabarito oficial nunca explica: a banca publica a letra, não o raciocínio.
3. Aponte as pegadinhas recorrentes da banca neste assunto.
4. Feche com um resumo de no máximo 10 linhas, para releitura na véspera da prova.
5. Termine sugerindo 3 termos de busca para procurar videoaula no YouTube.

## Honestidade sobre o que você não sabe

- Se um ponto do assunto costuma cair mas **não** aparece nas questões de \
exemplo, diga isso explicitamente em vez de omitir.
- Não afirme que a próxima prova cobrará algo, nem dê probabilidade de um \
assunto "cair". As questões de exemplo descrevem provas passadas; não preveem a \
próxima.
- Se as questões de exemplo forem poucas ou nenhuma, diga que a amostra é \
pequena em vez de generalizar em cima dela.
- Não invente número de questão, ano de prova ou redação de edital. Trabalhe só \
com o que está no material recebido.

## Formato

Responda em **Markdown** e **nada além dele** — sem "claro, aqui está" antes, \
sem comentário depois. O texto é gravado e renderizado direto, então a primeira \
linha da resposta é a primeira linha da aula.

Use títulos (`##`), listas e **negrito**. Fórmulas em texto simples: o \
renderizador não faz LaTeX, então `x^2` e `(a+b)/2` em vez de `$\\frac{a+b}{2}$`.\
"""


@dataclass(frozen=True)
class UnidadeDoEdital:
    """Uma linha do edital com tudo que o prompt precisa para falar dela.

    A unidade é `topico` + `subtopico` opcional, e não só `subtopico`, pelo mesmo
    motivo que o model `Aula`: metade das disciplinas do edital (Português,
    Matemática, Inglês, Estatística) não tem subdivisão nenhuma, e amarrar a
    unidade ao subtópico deixaria essas disciplinas sem aula possível.
    """

    disciplina: Disciplina
    topico: Topico
    subtopico: Subtopico | None
    concurso_nome: str
    concurso_orgao: str
    concurso_cargo: str
    # Nulo quando o concurso ainda não tem banca contratada — é o caso do BB 2026.
    # O prompt precisa saber disso: com banca definida ele pede o estilo dela, sem
    # banca ele pede o estilo das provas anteriores do mesmo órgão **e proíbe
    # afirmar que a próxima prova será igual** (`CLAUDE.md` §2.2).
    banca: str | None
    questoes: list[Questao]
    total_da_disciplina: int
    nao_classificadas_na_disciplina: int

    @property
    def id(self) -> str:
        """O id que casa com a linha do edital na tela (`Aula.unidade_id`)."""
        return self.subtopico.id if self.subtopico else self.topico.id

    @property
    def nome(self) -> str:
        return self.subtopico.nome if self.subtopico else self.topico.nome


def _alternativas_em_texto(questao: Questao) -> str:
    return "\n".join(f"({a.letra}) {a.texto}" for a in questao.alternativas.all())


def _questao_em_texto(questao: Questao, indice: int) -> str:
    partes = [f"### Questão {indice + 1} — {questao.banca} {questao.ano}"]

    if questao.texto_base:
        base = questao.texto_base
        if len(base) > MAX_TEXTO_BASE:
            base = f"{base[:MAX_TEXTO_BASE]}…"
        partes.append(f"Texto de apoio: {base}")

    partes.append(questao.enunciado)

    alternativas = _alternativas_em_texto(questao)
    if alternativas:
        partes.append(alternativas)

    # Questão anulada não tem gabarito oficial, e inventar uma letra faria a aula
    # ensinar contra uma resposta que nunca existiu.
    partes.append(
        f"Gabarito oficial: {questao.correta}"
        if questao.correta
        else "Questão anulada pela banca — não há gabarito oficial."
    )
    return "\n\n".join(partes)


def montar_prompt_aula(unidade: UnidadeDoEdital) -> str:
    """A mensagem do usuário: o assunto, o peso medido dele e as questões reais."""
    exemplos = unidade.questoes[:MAX_QUESTOES_EXEMPLO]

    ressalva = ""
    if unidade.nao_classificadas_na_disciplina > 0:
        ressalva = (
            f" Atenção: {unidade.nao_classificadas_na_disciplina} das "
            f"{unidade.total_da_disciplina} questões desta disciplina ainda não foram "
            f"classificadas por assunto, então esse número é um piso, não a contagem final."
        )

    if unidade.questoes:
        quantas = len(unidade.questoes)
        verbo = "é" if quantas == 1 else "são"
        peso = (
            f"Das {unidade.total_da_disciplina} questões de {unidade.disciplina.nome} "
            f"em provas anteriores, {quantas} {verbo} deste assunto. Calibre a "
            f"profundidade por essa proporção: assunto que aparece pouco merece uma "
            f"revisão enxuta, não um tratado.{ressalva}"
        )
    else:
        peso = (
            f"Nenhuma das {unidade.total_da_disciplina} questões de "
            f"{unidade.disciplina.nome} do acervo foi identificada como deste assunto. "
            f"Seja conciso e priorize o que é mais cobrável, sem esgotar o tema — e "
            f"diga ao candidato que não há questão real deste assunto no acervo para "
            f"calibrar o nível.{ressalva}"
        )

    subtopico_linha = f"\n- Subtópico: {unidade.subtopico.nome}" if unidade.subtopico else ""

    banca_linha = (
        f"A banca é a {unidade.banca}."
        if unidade.banca
        else (
            "A banca desta prova ainda não foi definida — as questões de exemplo "
            "abaixo são de provas anteriores do mesmo órgão, então use o estilo "
            "delas como referência, mas **não afirme que a próxima prova será igual**."
        )
    )

    blocos = [
        f"""## O que preciso estudar
- Concurso: {unidade.concurso_nome} ({unidade.concurso_orgao})
- Cargo: {unidade.concurso_cargo}
- Disciplina: {unidade.disciplina.nome}
- Tópico do edital: {unidade.topico.nome}{subtopico_linha}

{banca_linha}""",
        f"""## Peso deste assunto na prova
{peso}""",
    ]

    if exemplos:
        questoes_texto = "\n\n---\n\n".join(
            _questao_em_texto(q, i) for i, q in enumerate(exemplos)
        )
        blocos.append(
            f"""## Como este assunto já foi cobrado
Estas são questões **reais** de provas anteriores, com o gabarito oficial. Use-as
para calibrar profundidade, vocabulário e o tipo de pegadinha da banca.

{questoes_texto}"""
        )

    return "\n\n".join(blocos)
