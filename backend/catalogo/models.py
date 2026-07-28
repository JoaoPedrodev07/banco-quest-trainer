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

from django.core.validators import RegexValidator
from django.db import models

slug_validator = RegexValidator(
    r"^[a-z0-9]+(-[a-z0-9]+)*$",
    "Use apenas minúsculas, números e hífen (ex.: 'bb-ti-2023').",
)

LETRAS = [("A", "A"), ("B", "B"), ("C", "C"), ("D", "D"), ("E", "E")]


class Fonte(models.Model):
    """De onde um conteúdo veio. É o antídoto contra afirmar que amostra é oficial."""

    class Tipo(models.TextChoices):
        OFICIAL = "oficial", "Documento oficial da banca ou do órgão"
        AMOSTRA = "amostra", "Amostra escrita para o protótipo"
        DERIVADA = "derivada", "Derivada de documento oficial (resumo/reorganização)"

    slug = models.SlugField(primary_key=True, max_length=120, validators=[slug_validator])
    tipo = models.CharField(max_length=10, choices=Tipo.choices)
    titulo = models.CharField(max_length=300)
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
    id = models.SlugField(primary_key=True, max_length=80, validators=[slug_validator])
    disciplina = models.ForeignKey(Disciplina, on_delete=models.CASCADE, related_name="topicos")
    nome = models.CharField(max_length=300)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "tópico"
        verbose_name_plural = "tópicos"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return f"{self.disciplina_id} · {self.nome}"


class Subtopico(models.Model):
    id = models.SlugField(primary_key=True, max_length=100, validators=[slug_validator])
    topico = models.ForeignKey(Topico, on_delete=models.CASCADE, related_name="subtopicos")
    nome = models.CharField(max_length=300)
    ordem = models.PositiveSmallIntegerField(default=0)

    class Meta:
        verbose_name = "subtópico"
        verbose_name_plural = "subtópicos"
        ordering = ["ordem", "nome"]

    def __str__(self) -> str:
        return self.nome


class Prova(models.Model):
    id = models.SlugField(primary_key=True, max_length=80, validators=[slug_validator])
    ano = models.PositiveSmallIntegerField()
    banca = models.CharField(max_length=80)
    cargo = models.CharField(max_length=200)
    orgao = models.CharField(max_length=200)
    # Quantas questões o edital diz que a prova tem. Pode ser maior que o número
    # de questões efetivamente importadas — ver `questoes_disponiveis`.
    qtd_questoes = models.PositiveSmallIntegerField()
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
    gerado_em = models.DateTimeField(auto_now=True)
    modelo = models.CharField(
        max_length=120,
        blank=True,
        help_text="Qual IA gerou, para dar o que invalidar se o modelo mudar.",
    )

    class Meta:
        verbose_name = "aula"
        verbose_name_plural = "aulas"
        ordering = ["topico_id", "subtopico_id"]
        constraints = [
            # Uma aula por unidade do edital por concurso. Sem isto, "gerar de novo"
            # empilharia versões e a tela teria de escolher uma sem critério.
            models.UniqueConstraint(
                fields=["topico", "subtopico", "concurso_id"],
                name="aula_unica_por_unidade_com_subtopico",
                condition=models.Q(subtopico__isnull=False),
            ),
            models.UniqueConstraint(
                fields=["topico", "concurso_id"],
                name="aula_unica_por_unidade_sem_subtopico",
                condition=models.Q(subtopico__isnull=True),
            ),
        ]

    def __str__(self) -> str:
        return f"Aula de {self.subtopico_id or self.topico_id} ({self.concurso_id})"

    @property
    def unidade_id(self) -> str:
        """O id que a tela usa para casar aula com linha do edital."""
        return self.subtopico_id or self.topico_id
