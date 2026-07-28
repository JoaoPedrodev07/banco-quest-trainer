"""
Cria as disciplinas do concurso a partir do conteúdo programático do edital.

Este comando NÃO inventa conteúdo: ele só garante que as disciplinas existam com
os ids que o frontend já usa (`portugues`, `ti`, ...), para que a importação de
prova tenha onde pendurar as questões. Os tópicos detalhados vêm do edital de
verdade, por `importar_edital`.

A `Fonte` criada aqui é do tipo `derivada`, nunca `oficial`: a lista de matérias
foi transcrita do edital, mas o recorte é nosso. Só o que sai direto do PDF da
banca pode se dizer oficial (§2.2 do CLAUDE.md).
"""

from django.core.management.base import BaseCommand
from django.db import transaction

from catalogo.models import Disciplina, Fonte

# id, nome, cor. Os ids são os mesmos de `src/data/disciplinas.ts` — mudar aqui
# invalida o progresso já salvo no localStorage de quem usa o app.
DISCIPLINAS = [
    ("portugues", "Língua Portuguesa", "#003399"),
    ("ingles", "Língua Inglesa", "#0055B7"),
    ("matematica", "Matemática", "#1E7B3E"),
    ("estatistica", "Probabilidade e Estatística", "#7B3EA8"),
    ("atualidades", "Atualidades do Mercado Financeiro", "#C2570C"),
    ("bancarios", "Conhecimentos Bancários", "#B78E00"),
    ("ti", "Tecnologia da Informação", "#B01F1F"),
    # Separada de "ti" de propósito. "Conhecimentos de Informática" é a seção do
    # cargo de Agente Comercial (Excel, Teams, webmail, noções de segurança); é
    # outro conteúdo, muito mais raso, e não consta do edital de Agente de
    # Tecnologia. Juntar as duas inflaria a contagem de TI com questão que o
    # candidato de TI nunca vai responder na prova dele.
    ("informatica", "Conhecimentos de Informática", "#8A6D3B"),
    # Também do cargo de Agente Comercial: atendimento, técnicas de venda e as
    # resoluções do CMN. Não consta do edital de Agente de Tecnologia.
    ("vendas", "Vendas e Negociação", "#2F6F6F"),
]

FONTE_SLUG = "estrutura-disciplinas"


class Command(BaseCommand):
    help = "Cria/atualiza as disciplinas do catálogo (idempotente)."

    def handle(self, *args, **opcoes):
        with transaction.atomic():
            fonte, _ = Fonte.objects.update_or_create(
                slug=FONTE_SLUG,
                defaults={
                    "tipo": Fonte.Tipo.DERIVADA,
                    "titulo": "Estrutura de disciplinas (transcrita do edital)",
                    "observacao": (
                        "Lista de matérias e cores da interface. O conteúdo programático "
                        "detalhado vem do PDF do edital, por `importar_edital`."
                    ),
                },
            )

            criadas = 0
            for ordem, (id_disciplina, nome, cor) in enumerate(DISCIPLINAS):
                # `fonte` só entra na criação. Depois que `importar_edital` roda, a
                # disciplina passa a apontar para o PDF oficial da banca; reescrever
                # esse vínculo aqui rebaixaria o acervo de "oficial" para "derivada"
                # a cada seed — e a tela passaria a anunciar o edital errado.
                _, nova = Disciplina.objects.update_or_create(
                    id=id_disciplina,
                    defaults={"nome": nome, "cor": cor, "ordem": ordem},
                    create_defaults={
                        "nome": nome,
                        "cor": cor,
                        "ordem": ordem,
                        "fonte": fonte,
                    },
                )
                criadas += int(nova)

        total = Disciplina.objects.count()
        self.stdout.write(
            self.style.SUCCESS(f"{total} disciplinas no catálogo ({criadas} criadas agora).")
        )
