"""
Modelos do catálogo de conteúdo: edital, provas e questões.

Duas escolhas que valem explicar:

1. **Chave primária é slug, não inteiro.** Os IDs (`ti`, `port-1-1`, `bb-ti-2023`)
   já existem no frontend e no localStorage do usuário. Mantê-los como PK deixa a
   troca de mock por API invisível para quem já tem progresso salvo.

2. **Todo conteúdo aponta para uma `Fonte`.** Sem isso a UI não tem como saber se
   uma questão veio do PDF oficial da banca ou de uma amostra escrita à mão — e o
   §2.2 do CLAUDE.md proíbe apresentar amostra como se fosse edital real.
"""

from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models

slug_validator = RegexValidator(
    r"^[a-z0-9]+(-[a-z0-9]+)*$",
    "Use apenas minúsculas, números e hífen (ex.: 'bb-ti-2023').",
)

LETRAS = [("A", "A"), ("B", "B"), ("C", "C"), ("D", "D"), ("E", "E")]


class TipoQuestao(models.TextChoices):
    """Formato da questão. É o que separa Cebraspe do resto.

    `MULTIPLA` — cinco alternativas, uma correta. Cesgranrio, FGV, IBFC.
    `CERTO_ERRADO` — uma afirmação para julgar. Cebraspe.

    O certo/errado **não** é modelado como duas alternativas (C e E) de propósito.
    Alternativa existe para guardar texto de opção, e em certo/errado não há texto
    nenhum: a afirmação inteira está no enunciado. Criar duas linhas vazias só
    para caber no formato antigo faria toda tela ter de saber ignorá-las.

    A diferença que mais importa não é o formato, é a **pontuação**: na Cebraspe
    cada erro anula um acerto. Uma taxa calculada como nas outras bancas mentiria
    sobre a nota — ver `Prova.pontuacao_liquida`.
    """

    MULTIPLA = "multipla", "Múltipla escolha (A–E)"
    CERTO_ERRADO = "certo_errado", "Certo ou errado"


class Fonte(models.Model):
    """De onde um conteúdo veio. É o antídoto contra afirmar que amostra é oficial."""

    class Tipo(models.TextChoices):
        OFICIAL = "oficial", "Documento oficial da banca ou do órgão"
        AMOSTRA = "amostra", "Amostra escrita para o protótipo"
        DERIVADA = "derivada", "Derivada de documento oficial (resumo/reorganização)"

    slug = models.SlugField(primary_key=True, max_length=120, validators=[slug_validator])
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    titulo = models.CharField(max_length=300)
    # Rótulo curto que a tela exibe ("Imprensa — a confirmar", "Concurso
    # encerrado — treino de formato"). Vazio = a tela usa o nome do tipo. Veio
    # com o catálogo de concursos (ADR-015): o rótulo do frontend carregava
    # nuance que `get_tipo_display` não tem.
    rotulo = models.CharField(max_length=120, blank=True)
    url = models.URLField(max_length=500, blank=True, help_text="Endereço do documento de origem.")
    # sha256 do arquivo baixado: prova que o que está no banco veio daquele PDF,
    # e detecta quando a banca republica o documento com outro conteúdo.
    sha256 = models.CharField(max_length=64, blank=True)
    publicado_em = models.DateField(null=True, blank=True)
    obtido_em = models.DateTimeField(auto_now_add=True)
    observacao = models.TextField(blank=True)

    class Meta:
        verbose_name = "fonte"
        verbose_name_plural = "fontes"
        ordering = ["titulo"]

    def __str__(self) -> str:
        return f"{self.titulo} ({self.get_tipo_display()})"

    @property
    def e_oficial(self) -> bool:
        return self.tipo == self.Tipo.OFICIAL


class Banca(models.Model):
    """Banca organizadora. Tabela pequena de propósito — hoje só existe pra
    `Concurso.banca` apontar pra algo tipado em vez de repetir a string livre
    que `Prova.banca`/`Questao.banca` já usam.

    **Deliberadamente não normalizei `Prova.banca`/`Questao.banca` pra FK aqui**
    (Fase 3 do `CLAUDE.md` §8): são 590 linhas em uso por filtro de API, admin e
    o contrato de tipos do frontend (`Questao.banca: string`), e nada nesta fase
    precisa que sejam FK — o valor livre já é vocabulário controlado na prática
    (Cesgranrio/Cebraspe/FGV, sempre grafado igual). Normalizar sem necessidade
    imediata é o tipo de troca que este projeto evita (`CLAUDE.md` regra geral
    de não adicionar abstração além do que a tarefa pede).
    """

    slug = models.SlugField(primary_key=True, max_length=60, validators=[slug_validator])
    nome = models.CharField(max_length=120)

    class Meta:
        verbose_name = "banca"
        verbose_name_plural = "bancas"
        ordering = ["nome"]

    def __str__(self) -> str:
        return self.nome


class StatusConcurso(models.TextChoices):
    """Espelha `StatusConcurso` de `src/types/index.ts` — não são valores
    inventados aqui, são os que a tela já usa."""

    INSCRICOES_ABERTAS = "inscricoes_abertas", "Inscrições abertas"
    INSCRICOES_ENCERRADAS = "inscricoes_encerradas", "Inscrições encerradas"
    PREVISTO = "previsto", "Previsto"
    ENCERRADO = "encerrado", "Encerrado"


class Concurso(models.Model):
    """Fase 3 do `CLAUDE.md` §8 — o backend passa a saber o que é um concurso,
    em vez de `concurso_id` ser só uma string carimbada em `Topico`/`Aula` e o
    recorte por concurso morar inteiro em `useAcervoDoConcurso` no frontend.

    **Escopo deliberadamente estreito**: só existe linha aqui para os concursos
    que já têm prova de verdade no backend (`bb-ti-2026`, `fgv-banestes-ti-2021`,
    `cebraspe-bnb-ti-2022`). Os outros três do catálogo do frontend
    (`src/data/concursos.ts`) — TCE-SP, TCE-RJ, ATI-PE — não têm nenhuma prova
    importada, são só um card de calendário com dado de imprensa; migrar esse
    calendário pro backend é escopo maior do que "eliminar o recorte de prova"
    (o problema real do §7.3), fica pra quando o backend precisar servir
    conteúdo desses concursos de verdade.

    `banca` e `data_prova` são anuláveis de propósito: o BB 2026 está sem
    contrato de banca definido, e cravar um valor aqui seria o mesmo erro que
    o §2.2 já proíbe na tela — afirmar como fato o que ainda é "a confirmar".
    """

    slug = models.SlugField(primary_key=True, max_length=80, validators=[slug_validator])
    nome = models.CharField(max_length=200)
    orgao = models.CharField(max_length=200)
    cargo = models.CharField(max_length=200)
    banca = models.ForeignKey(
        Banca, on_delete=models.PROTECT, related_name="concursos", null=True, blank=True
    )
    data_prova = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=24, choices=StatusConcurso.choices)
    fonte = models.ForeignKey(Fonte, on_delete=models.PROTECT, related_name="concursos")
    # Campos de calendário (ADR-015) — o que o catálogo hardcoded do frontend
    # guardava. Anuláveis de propósito: concurso previsto não tem esses números
    # fechados, e preencher com palpite é o que o §2.2 proíbe.
    salario_valor = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    salario_observacao = models.CharField(max_length=300, blank=True)
    vagas = models.PositiveIntegerField(null=True, blank=True)
    edital_url = models.URLField(max_length=500, blank=True)
    # Ordem de exibição no catálogo: o concurso-alvo primeiro, treinos por último.
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "concurso"
        verbose_name_plural = "concursos"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class Disciplina(models.Model):
    id = models.SlugField(primary_key=True, max_length=60, validators=[slug_validator])
    nome = models.CharField(max_length=160)
    # Hex é aceito aqui porque a cor identifica a disciplina no gráfico e não faz
    # parte do tema (o §5 do CLAUDE.md veta hex solto no Tailwind, não no dado).
    cor = models.CharField(max_length=7, help_text="Cor da disciplina no gráfico, em hex.")
    ordem = models.PositiveSmallIntegerField(default=0)
    fonte = models.ForeignKey(Fonte, on_delete=models.PROTECT, related_name="disciplinas")

    class Meta:
        verbose_name = "disciplina"
        verbose_name_plural = "disciplinas"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class Topico(models.Model):
    """Um item do conteúdo programático.

    **O tópico pertence a um concurso, a disciplina não.** "Tecnologia da
    Informação" é a mesma disciplina em qualquer edital; o que muda entre editais
    é o que ela cobra. No BB é aprendizado de máquina, banco de dados, big data,
    mobile e estrutura de dados; no BNB (Cebraspe) é MVC, DevOps, contêineres,
    TDD e requisitos. Sem separar por concurso, importar o segundo edital
    apagaria a árvore do primeiro — e, pior, misturar as duas faria o plano de
    estudos mandar o candidato do BB estudar DevOps.
    """

    id = models.SlugField(primary_key=True, max_length=120, validators=[slug_validator])
    disciplina = models.ForeignKey(Disciplina, on_delete=models.CASCADE, related_name="topicos")
    # Slug do concurso no catálogo do frontend (`src/data/concursos.ts`), como em
    # `Aula.concurso_id`. O backend ainda não modela concurso como tabela.
    concurso_id = models.SlugField(max_length=80, validators=[slug_validator], default="bb-ti-2026")
    # Redação literal do edital para este item — é o "titulo_edital" que a análise
    # de incidência cita, guardado aqui em vez de campo duplicado (ver docs/taxonomia.md).
    nome = models.CharField(max_length=300)
    ordem = models.PositiveSmallIntegerField(default=0)
    # Referência de numeração do edital (ex.: "6" para o 6º item de TI). Não é chave
    # de nada — é só o que a UI mostra pra achar o item no PDF original.
    edital_ref = models.CharField(max_length=20, blank=True)
    # Falso quando o item saiu do edital vigente numa reimportação. O tópico continua
    # no banco (nunca é deletado) porque `Questao.topico` aponta pra ele — apagar
    # anularia classificação já feita. Ver docs/taxonomia.md, "política de deprecação".
    ativo_edital_vigente = models.BooleanField(default=True)

    class Meta:
        verbose_name = "tópico"
        verbose_name_plural = "tópicos"
        ordering = ["ordem", "nome"]
        indexes = [models.Index(fields=["concurso_id", "disciplina"])]

    def __str__(self) -> str:
        return f"{self.disciplina_id} · {self.nome}"


class Subtopico(models.Model):
    id = models.SlugField(primary_key=True, max_length=100, validators=[slug_validator])
    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="subtopicos")
    nome = models.CharField(max_length=300)
    ordem = models.PositiveSmallIntegerField(default=0)
    # Mesmo par de campos do Topico, e pela mesma razão — ver acima.
    edital_ref = models.CharField(max_length=20, blank=True)
    ativo_edital_vigente = models.BooleanField(default=True)

    class Meta:
        verbose_name = "subtópico"
        verbose_name_plural = "subtópicos"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class Edital(models.Model):
    """Uma versão publicada do conteúdo programático de um concurso.

    Existe separado de `Fonte` só pelo que `Fonte` não tem: a quem pertence
    (`concurso`) e se é a versão vigente. sha256/URL/data de publicação
    continuam só em `Fonte` — repetir esses três campos aqui seria o mesmo dado
    guardado duas vezes (`CLAUDE.md` §2.3), e `Fonte` já é o lugar certo.

    `versao` fica em 1 pra todo edital importado até hoje porque só existe uma
    versão de cada um no acervo (`docs/auditoria-corpus.md`, seção 5) — bump de
    versão é problema da Fase 5 (diff de editais), que compara duas versões
    reais. Não simule uma segunda aqui.
    """

    concurso = models.ForeignKey(Concurso, on_delete=models.CASCADE, related_name="editais")
    versao = models.PositiveSmallIntegerField(default=1)
    fonte = models.ForeignKey(Fonte, on_delete=models.PROTECT, related_name="editais")
    eh_vigente = models.BooleanField(default=True)

    class Meta:
        verbose_name = "edital"
        verbose_name_plural = "editais"
        ordering = ["-versao"]
        constraints = [
            # Um vigente por concurso — é o que a tela usa pra saber qual
            # conteúdo programático mostrar sem ambiguidade.
            models.UniqueConstraint(
                fields=["concurso"],
                condition=models.Q(eh_vigente=True),
                name="um_edital_vigente_por_concurso",
            )
        ]

    def __str__(self) -> str:
        return f"{self.concurso_id} v{self.versao}"


class ItemEdital(models.Model):
    """Fotografia de um `Topico` no momento em que este `Edital` foi importado.

    **Por que isto duplica `numeracao_original`/`redacao_literal` de
    `Topico.edital_ref`/`Topico.nome`, de propósito.** `Topico` guarda o estado
    *atual* — `importar_edital` sobrescreve `nome` a cada reimportação. Este
    registro é histórico e não muda depois de criado: é o que permite à Fase 5
    (diff de editais) comparar a redação de uma versão contra a seguinte mesmo
    depois que `Topico.nome` já foi atualizado pela versão nova. Sem o
    congelamento, a versão antiga do texto já teria sido perdida quando a
    segunda versão existir. Mesmo padrão de `ClassificacaoQuestao` guardando
    proveniência ao lado de `Questao.topico` (Fase 2).
    """

    edital = models.ForeignKey(Edital, on_delete=models.CASCADE, related_name="itens")
    topico = models.ForeignKey(Topico, on_delete=models.PROTECT, related_name="itens_edital")
    numeracao_original = models.CharField(max_length=20)
    redacao_literal = models.TextField()
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "item do edital"
        verbose_name_plural = "itens do edital"
        ordering = ["ordem"]
        constraints = [
            models.UniqueConstraint(fields=["edital", "topico"], name="item_edital_unico_por_topico")
        ]

    def __str__(self) -> str:
        return f"{self.edital_id} · {self.numeracao_original} {self.topico.nome[:40]}"


class Prova(models.Model):
    id = models.SlugField(primary_key=True, max_length=80, validators=[slug_validator])
    # Nulo enquanto uma prova nova ainda não foi ligada a um concurso — ver
    # docstring de `Concurso` sobre o recorte deliberadamente estreito da Fase 3.
    concurso = models.ForeignKey(
        Concurso, on_delete=models.SET_NULL, related_name="provas", null=True, blank=True
    )
    ano = models.PositiveSmallIntegerField()
    banca = models.CharField(max_length=80)
    cargo = models.CharField(max_length=200)
    orgao = models.CharField(max_length=200)
    # Quantas questões o edital diz que a prova tem. Pode ser maior que o número
    # de questões efetivamente importadas — ver `questoes_disponiveis`.
    qtd_questoes = models.PositiveSmallIntegerField()
    # A Cebraspe desconta: cada questão errada anula uma certa. Uma taxa de acerto
    # calculada como nas outras bancas ("acertos / respondidas") mente sobre a
    # nota — quem acerta 40 e erra 30 de 70 não tem 57%, tem 10 pontos líquidos.
    # O dado fica na prova, e não numa lista de bancas no código, porque a regra é
    # do edital: a mesma banca aplica desconto num concurso e não aplica em outro.
    pontuacao_liquida = models.BooleanField(
        default=False,
        help_text="Se marcado, cada erro anula um acerto (padrão Cebraspe).",
    )
    url_prova = models.URLField(max_length=500, blank=True)
    url_gabarito = models.URLField(max_length=500, blank=True)
    aplicada_em = models.DateField(null=True, blank=True)
    fonte = models.ForeignKey(Fonte, on_delete=models.PROTECT, related_name="provas")

    class Meta:
        verbose_name = "prova"
        verbose_name_plural = "provas"
        ordering = ["-ano", "orgao"]

    def __str__(self) -> str:
        return f"{self.orgao} {self.ano} — {self.cargo}"

    @property
    def questoes_disponiveis(self) -> int:
        """Questões realmente no banco. Divergir de `qtd_questoes` é normal e
        precisa aparecer na tela: importação parcial não é prova completa."""
        return self.questoes.count()


class Questao(models.Model):
    id = models.SlugField(primary_key=True, max_length=120, validators=[slug_validator])
    disciplina = models.ForeignKey(Disciplina, on_delete=models.PROTECT, related_name="questoes")
    prova = models.ForeignKey(
        Prova, on_delete=models.CASCADE, related_name="questoes", null=True, blank=True
    )
    # A classificação tem dois níveis porque o edital tem dois. `topico` é o que
    # sempre dá para preencher: várias disciplinas (Português, Matemática, Inglês,
    # Estatística) não têm subdivisão nenhuma no edital, e amarrar a classificação
    # só a `subtopico` tornava essas disciplinas impossíveis de etiquetar — que é
    # exatamente onde a análise de incidência estava travada.
    topico = models.ForeignKey(
        Topico, on_delete=models.SET_NULL, related_name="questoes", null=True, blank=True
    )
    # Grão fino, quando o edital oferece. Fica coerente com `topico` pelo save().
    subtopico = models.ForeignKey(
        Subtopico, on_delete=models.SET_NULL, related_name="questoes", null=True, blank=True
    )
    numero_na_prova = models.PositiveSmallIntegerField(null=True, blank=True)
    ano = models.PositiveSmallIntegerField()
    banca = models.CharField(max_length=80)
    # Texto de apoio (a reportagem, o gráfico ou o trecho que várias questões da
    # seção comentam). Fica em campo próprio, e não colado no enunciado, porque a
    # mesma matéria serve a um bloco inteiro de questões: repetir dentro do
    # enunciado esconderia que é o mesmo texto e inflaria o acervo.
    texto_base = models.TextField(blank=True)
    enunciado = models.TextField()
    # Fica vazio quando a questão foi anulada: a banca não divulga gabarito para
    # anulada, e inventar uma letra faria a tela corrigir contra uma resposta que
    # nunca existiu.
    tipo = models.CharField(
        max_length=12, choices=TipoQuestao.choices, default=TipoQuestao.MULTIPLA
    )
    # Em múltipla escolha guarda a letra (A–E); em certo/errado, "C" ou "E".
    # A colisão de letras é aparente: `tipo` diz como interpretar, e sem ele o
    # "C" de uma questão Cebraspe seria lido como a alternativa C.
    correta = models.CharField(max_length=1, choices=LETRAS, blank=True)
    explicacao = models.TextField(blank=True)
    # Questão anulada pela banca continua valendo como estudo, mas não pode entrar
    # em estatística de acerto como se tivesse resposta única.
    anulada = models.BooleanField(default=False)
    fonte = models.ForeignKey(Fonte, on_delete=models.PROTECT, related_name="questoes")
    criada_em = models.DateTimeField(auto_now_add=True)
    atualizada_em = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "questão"
        verbose_name_plural = "questões"
        ordering = ["-ano", "prova_id", "numero_na_prova"]
        constraints = [
            models.UniqueConstraint(
                fields=["prova", "numero_na_prova"],
                name="questao_unica_por_numero_na_prova",
                condition=models.Q(prova__isnull=False, numero_na_prova__isnull=False),
            )
        ]
        indexes = [models.Index(fields=["disciplina", "ano"])]

    @property
    def eh_certo_errado(self) -> bool:
        return self.tipo == TipoQuestao.CERTO_ERRADO

    def clean(self):
        """Impede os dois estados incoerentes que o formato novo torna possíveis.

        Sem isto, uma questão certo/errado com gabarito "B" passaria batida e a
        tela corrigiria contra uma resposta que o candidato nem pode marcar.
        """
        from django.core.exceptions import ValidationError

        if self.eh_certo_errado and self.correta not in {"C", "E", ""}:
            raise ValidationError(
                {"correta": "Em certo/errado o gabarito só pode ser 'C', 'E' ou vazio (anulada)."}
            )

    def save(self, *args, **kwargs):
        # Um subtópico já implica o tópico dele. Derivar aqui, em vez de confiar em
        # quem grava, evita o caso em que a questão aparece sob um subtópico mas
        # some da contagem do tópico pai — divergência que só apareceria na tela de
        # análise, como um total que não bate com a soma das partes.
        if self.subtopico_id and not self.topico_id:
            self.topico_id = self.subtopico.topico_id
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.id} — {self.enunciado[:60]}"


class Alternativa(models.Model):
    questao = models.ForeignKey(Questao, on_delete=models.CASCADE, related_name="alternativas")
    letra = models.CharField(max_length=1, choices=LETRAS)
    texto = models.TextField()

    class Meta:
        verbose_name = "alternativa"
        verbose_name_plural = "alternativas"
        ordering = ["letra"]
        constraints = [
            models.UniqueConstraint(fields=["questao", "letra"], name="alternativa_unica_por_letra")
        ]

    def __str__(self) -> str:
        return f"({self.letra}) {self.texto[:50]}"


class Aula(models.Model):
    """Texto explicativo de uma unidade do edital, gerado por IA e guardado uma vez.

    Fica no acervo, junto com provas e questões, e não no localStorage: aula é
    conteúdo (igual para qualquer um que abrir aquele assunto), não progresso do
    usuário.

    **Não tem `Fonte` de propósito.** `Fonte` responde "de qual documento oficial
    isto veio", e a resposta aqui é "de nenhum" — é texto derivado. Quem renderiza
    tem a obrigação de avisar que o conteúdo é gerado e precisa ser conferido
    contra o edital; é o §2.2 do CLAUDE.md aplicado a um tipo de dado que a regra
    não previa quando foi escrita.

    A unidade é `topico` + `subtopico` opcional, e não só `subtopico`, porque
    metade das disciplinas do edital não tem subdivisão nenhuma (Português,
    Matemática, Inglês, Estatística). Amarrar a aula a `subtopico` deixaria essas
    disciplinas sem aula possível — o mesmo erro que travava a classificação.
    """

    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="aulas")
    subtopico = models.ForeignKey(
        Subtopico, on_delete=models.CASCADE, related_name="aulas", null=True, blank=True
    )
    # O backend ainda não modela concursos; o id vem do catálogo do frontend
    # (`src/data/concursos.ts`). Guardar como texto mantém a aula ligada ao
    # concurso certo sem inventar uma tabela que ninguém mais usa hoje.
    concurso_id = models.SlugField(max_length=80, validators=[slug_validator])
    conteudo_markdown = models.TextField()
    # auto_now_add, não auto_now: a partir do versionamento (ADR-016) cada linha
    # é histórico, e histórico não pode ter timestamp que muda a cada save.
    gerado_em = models.DateTimeField(auto_now_add=True)
    modelo = models.CharField(
        max_length=120,
        blank=True,
        help_text="Qual IA gerou, para dar o que invalidar se o modelo mudar.",
    )
    # Versionamento (ADR-016): salvar de novo NÃO sobrescreve — marca a corrente
    # como substituída e cria a versão seguinte. "Substituir aula" apagava o
    # texto anterior sem volta.
    versao = models.PositiveSmallIntegerField(default=1)
    prompt_versao = models.CharField(
        max_length=40,
        blank=True,
        help_text="Versão do prompt que gerou (PROMPT_AULA_VERSAO no frontend). "
        "É o que permite saber quais aulas são de uma geração antiga do prompt.",
    )
    substituida_em = models.DateTimeField(
        null=True, blank=True, help_text="Nulo = esta é a versão corrente."
    )

    class Meta:
        verbose_name = "aula"
        verbose_name_plural = "aulas"
        ordering = ["topico_id", "subtopico_id", "-versao"]
        constraints = [
            # Uma aula CORRENTE por unidade do edital por concurso (as demais são
            # histórico). Sem isto, a tela teria de escolher entre versões sem
            # critério.
            models.UniqueConstraint(
                fields=["topico", "subtopico", "concurso_id"],
                name="aula_corrente_unica_com_subtopico",
                condition=models.Q(subtopico__isnull=False, substituida_em__isnull=True),
            ),
            models.UniqueConstraint(
                fields=["topico", "concurso_id"],
                name="aula_corrente_unica_sem_subtopico",
                condition=models.Q(subtopico__isnull=True, substituida_em__isnull=True),
            ),
        ]

    def __str__(self) -> str:
        return f"Aula de {self.subtopico_id or self.topico_id} ({self.concurso_id})"

    @property
    def unidade_id(self) -> str:
        """O id que a tela usa para casar aula com linha do edital."""
        return self.subtopico_id or self.topico_id


class TipoProblema(models.TextChoices):
    GABARITO_ERRADO = "gabarito_errado", "Gabarito errado"
    ENUNCIADO_INCOMPLETO = "enunciado_incompleto", "Enunciado incompleto ou truncado"
    ALTERNATIVA_FALTANDO = "alternativa_faltando", "Alternativa faltando ou vazia"
    CLASSIFICACAO_ERRADA = "classificacao_errada", "Assunto/classificação errada"
    OUTRO = "outro", "Outro"


class ProblemaQuestao(models.Model):
    """Problema reportado pelo usuário numa questão (ADR-014).

    O acervo vem de parser de PDF e defeito de importação já aconteceu (questão
    com alternativas-figura vazias). Este registro é o **sinal para curadoria**,
    nunca correção automática: mudar gabarito por report sem conferir o PDF
    violaria o §2.2. A fila (resolvido_em nulo) aparece na tela de curadoria,
    junto da fila de classificação da Fase 2.

    Report duplicado da mesma questão é permitido de propósito — dois sinais
    valem mais que um.
    """

    questao = models.ForeignKey(Questao, on_delete=models.CASCADE, related_name="problemas")
    tipo = models.CharField(max_length=24, choices=TipoProblema.choices)
    descricao = models.TextField(blank=True)
    criado_em = models.DateTimeField(auto_now_add=True)
    resolvido_em = models.DateTimeField(
        null=True, blank=True, help_text="Nulo = ainda na fila de curadoria."
    )

    class Meta:
        verbose_name = "problema de questão"
        verbose_name_plural = "problemas de questão"
        ordering = ["-criado_em"]
        indexes = [models.Index(fields=["resolvido_em"])]

    def __str__(self) -> str:
        return f"{self.questao_id} · {self.get_tipo_display()}"


class OrigemClassificacao(models.TextChoices):
    HUMANA = "humana", "Humana"
    HEURISTICA = "heuristica", "Heurística (termo-âncora)"
    LLM_EXTERNA = "llm_externa", "IA externa (não embutida no app)"


class NivelCognitivo(models.TextChoices):
    MEMORIZACAO = "memorizacao", "Memorização"
    COMPREENSAO = "compreensao", "Compreensão"
    APLICACAO = "aplicacao", "Aplicação"
    ANALISE = "analise", "Análise"


class FormatoItem(models.TextChoices):
    CONCEITUAL = "conceitual", "Conceitual"
    LEITURA_DE_CODIGO = "leitura_de_codigo", "Leitura de código"
    CALCULO = "calculo", "Cálculo"
    INTERPRETACAO_DE_CASO = "interpretacao_de_caso", "Interpretação de caso"
    COMANDO_SINTAXE = "comando_sintaxe", "Comando/sintaxe"


class ClassificacaoQuestao(models.Model):
    """Registro de classificação de uma questão contra a árvore do edital.

    **Por que isto não substitui `Questao.topico`/`Questao.subtopico`.** Aquele
    par é a classificação primária *corrente* — é o que toda tela, filtro e
    comando já existentes leem hoje, e reescrevê-los para juntar com esta tabela
    era troca grande demais para uma fase só. Esta tabela é o histórico completo
    com proveniência: uma questão pode ter mais de uma linha aqui (até 2-3
    tópicos tocados), mas só uma com `eh_primaria=True`, e é essa que os
    comandos de classificação (`classificar_questoes`, `classificar_heuristica`,
    `importar_classificacao_llm`) espelham em `Questao.topico`/`subtopico` no
    mesmo `save()`. Só esses comandos escrevem dos dois lados — não é
    sincronização automática por sinal, é disciplina de um único caminho de
    escrita, porque `CLAUDE.md` §2.3 proíbe dois lugares guardando a mesma
    conclusão sem um jeito claro de saber qual manda.
    """

    questao = models.ForeignKey(Questao, on_delete=models.CASCADE, related_name="classificacoes")
    topico = models.ForeignKey(Topico, on_delete=models.PROTECT, related_name="classificacoes")
    subtopico = models.ForeignKey(
        Subtopico, on_delete=models.PROTECT, related_name="classificacoes", null=True, blank=True
    )
    eh_primaria = models.BooleanField(default=True)
    nivel_cognitivo = models.CharField(max_length=20, choices=NivelCognitivo.choices, blank=True)
    formato_item = models.CharField(max_length=25, choices=FormatoItem.choices, blank=True)
    confianca = models.FloatField(
        default=1.0,
        validators=[MinValueValidator(0.0), MaxValueValidator(1.0)],
        help_text="0.0–1.0. Só é 1.0 de verdade quando origem=humana.",
    )
    origem_classificacao = models.CharField(max_length=12, choices=OrigemClassificacao.choices)
    # Obrigatório quando origem != humana — ver clean(). Classificação automática
    # sem justificativa é opaca demais pra entrar na fila de revisão com sentido.
    justificativa = models.TextField(blank=True)
    revisada_por_humano = models.BooleanField(default=False)
    revisada_em = models.DateTimeField(null=True, blank=True)
    criada_em = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "classificação de questão"
        verbose_name_plural = "classificações de questão"
        ordering = ["-criada_em"]
        constraints = [
            # No máximo uma classificação primária por questão — é o que
            # `Questao.topico` espelha; duas primárias tornariam ambíguo qual
            # delas o resto do app deveria refletir.
            models.UniqueConstraint(
                fields=["questao"],
                condition=models.Q(eh_primaria=True),
                name="uma_classificacao_primaria_por_questao",
            ),
        ]
        indexes = [models.Index(fields=["origem_classificacao", "revisada_por_humano"])]

    def clean(self):
        from django.core.exceptions import ValidationError

        erros: dict[str, str] = {}
        if self.origem_classificacao != OrigemClassificacao.HUMANA and not self.justificativa.strip():
            erros["justificativa"] = "obrigatória quando a origem não é humana."
        if self.subtopico_id and self.subtopico.topico_id != self.topico_id:
            erros["subtopico"] = "não pertence ao tópico informado."
        if erros:
            raise ValidationError(erros)

    def __str__(self) -> str:
        marca = "primária" if self.eh_primaria else "secundária"
        return f"{self.questao_id} → {self.subtopico_id or self.topico_id} ({marca}, {self.origem_classificacao})"
