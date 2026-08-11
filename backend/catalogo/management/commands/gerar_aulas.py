"""
Gera, em lote, a aula de cada unidade do edital e grava no acervo.

## Por que este comando existe, se o `CLAUDE.md` §7.6 diz "sem LLM"

O §7.6 proíbe **LLM em tempo de execução**: nada de chave de API no caminho do
usuário, nada de custo por clique, nada de tela que trava esperando um modelo
responder. Essa regra continua de pé e este comando não a toca — ele roda na
máquina do mantenedor, lê a chave de `backend/.env`, e o que chega ao usuário é
texto já gravado no banco. O app continua sem saber que existe uma IA.

O que muda é só quem faz o trabalho braçal. Antes: o app montava o prompt, o
usuário levava numa IA gratuita e colava a resposta de volta, uma unidade por
vez. Esse caminho **continua existindo** (`AulaSubtopico.tsx`) e continua sendo o
de custo zero. Este comando é o atalho para preencher o edital inteiro de uma vez.

## Proveniência

`Aula.modelo` guarda qual modelo gerou. É o que separa aula gerada por este
comando (`modelo` preenchido) de aula colada à mão pelo usuário (`modelo` vazio,
que é o que `AulaSubtopico` grava) — sem isso não haveria como invalidar em massa
o que um modelo específico escreveu, que é justamente o motivo de o campo existir.

Aula **não tem `Fonte`**, de propósito: `Fonte` responde "de qual documento
oficial isto veio" e a resposta aqui é "de nenhum". Quem renderiza avisa que o
conteúdo é gerado — `AvisoGerado` já faz isso na tela, e é o §2.2 aplicado a um
tipo de dado que a regra não previa quando foi escrita.

## Uso

    # ver o que seria gerado, sem gastar nada e sem tocar na rede
    manage.py gerar_aulas --dry-run

    # gerar só a disciplina de TI, 5 unidades, para conferir o resultado
    manage.py gerar_aulas --disciplina ti --limite 5

    # o edital todo do concurso alvo (pula o que já existe; pode rodar de novo)
    manage.py gerar_aulas

A chave vai em `backend/.env` como `ANTHROPIC_API_KEY=...` — `config/settings.py`
já carrega esse arquivo, então ela nunca precisa ficar no shell nem no código.
"""

from __future__ import annotations

import os

from django.core.management.base import BaseCommand, CommandError

from catalogo.models import Aula, Concurso, Disciplina, Questao, Subtopico, Topico
from catalogo.prompts_aula import SISTEMA, UnidadeDoEdital, montar_prompt_aula

CONCURSO_PADRAO = "bb-ti-2026"
MODELO_PADRAO = "claude-opus-5"

# Teto de saída por aula. Precisa de folga: no Claude Opus 5 o raciocínio conta
# dentro de `max_tokens` junto com o texto, e uma aula cortada no meio é pior que
# aula nenhuma — por isso o comando recusa (em vez de gravar) o que vier truncado.
MAX_TOKENS = 32000

# USD por 1M de tokens (entrada, saída), só para o relatório de custo no fim.
# Número de referência: se estiver desatualizado, o relatório erra, o gasto não.
PRECO_POR_MILHAO = {
    "claude-opus-5": (5.0, 25.0),
    "claude-sonnet-5": (3.0, 15.0),
    "claude-haiku-4-5": (1.0, 5.0),
}


class Command(BaseCommand):
    help = "Gera a aula de cada unidade do edital via API do Claude e grava no acervo."

    def add_arguments(self, parser):
        parser.add_argument("--concurso", default=CONCURSO_PADRAO, help="slug do concurso alvo.")
        parser.add_argument("--disciplina", default="", help="Restringe a uma disciplina (ex.: ti).")
        parser.add_argument("--unidade", default="", help="Gera uma única unidade, pelo id.")
        parser.add_argument("--limite", type=int, default=0, help="Máximo de aulas nesta rodada.")
        parser.add_argument("--modelo", default=MODELO_PADRAO)
        parser.add_argument(
            "--efeito",
            default="high",
            choices=["low", "medium", "high", "xhigh", "max"],
            help="Esforço do modelo. Mais esforço, aula mais cuidadosa e mais cara.",
        )
        parser.add_argument(
            "--forcar",
            action="store_true",
            help="Regera unidades que já têm aula (o padrão é pular, para poder retomar).",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Lista as unidades e mostra o prompt da primeira. Não chama a API.",
        )

    def handle(self, *args, **op):
        concurso = Concurso.objects.filter(pk=op["concurso"]).first()
        if concurso is None:
            existentes = ", ".join(Concurso.objects.values_list("slug", flat=True)) or "nenhum"
            raise CommandError(
                f"concurso {op['concurso']!r} não existe. Cadastrados: {existentes}."
            )

        unidades = self._unidades(concurso, op["disciplina"], op["unidade"])
        if not unidades:
            raise CommandError(
                "nenhuma unidade do edital bate com esse filtro. "
                "Confira se o edital foi importado (manage.py importar_edital)."
            )

        ja_tem = set(
            Aula.objects.filter(concurso_id=concurso.slug).values_list("subtopico_id", "topico_id")
        )
        ja_tem_ids = {sub or top for sub, top in ja_tem}

        com_aula = [u for u in unidades if u.id in ja_tem_ids]
        pendentes = unidades if op["forcar"] else [u for u in unidades if u.id not in ja_tem_ids]
        if op["limite"]:
            pendentes = pendentes[: op["limite"]]

        self.stdout.write(
            f"{concurso.nome} — {len(unidades)} unidades no edital, "
            f"{len(com_aula)} já com aula, {len(pendentes)} nesta rodada."
        )

        if not pendentes:
            self.stdout.write(self.style.SUCCESS("Nada a gerar. Use --forcar para regerar."))
            return

        if op["dry_run"]:
            self._dry_run(pendentes)
            return

        self._gerar(pendentes, concurso, op["modelo"], op["efeito"])

    # ------------------------------------------------------------------ leitura

    def _unidades(
        self, concurso: Concurso, disciplina_id: str, unidade_id: str
    ) -> list[UnidadeDoEdital]:
        """Monta a lista de unidades do edital vigente, com o contexto de cada uma.

        A unidade é o subtópico quando o tópico tem subdivisão, e o próprio tópico
        quando não tem — mesma regra do model `Aula` e da árvore que a tela do
        edital desenha, senão a aula gerada não casaria com a linha que a mostra.

        Tópico ou subtópico fora do edital vigente (`ativo_edital_vigente=False`)
        fica de fora: continua no banco porque questão já classificada aponta pra
        ele, mas não vale mais gerar aula de assunto que saiu do edital.
        """
        topicos = (
            Topico.objects.filter(concurso_id=concurso.slug, ativo_edital_vigente=True)
            .select_related("disciplina")
            .prefetch_related("subtopicos")
            .order_by("disciplina__ordem", "ordem", "nome")
        )
        if disciplina_id:
            if not Disciplina.objects.filter(pk=disciplina_id).exists():
                raise CommandError(f"disciplina {disciplina_id!r} não existe no catálogo.")
            topicos = topicos.filter(disciplina_id=disciplina_id)

        # O denominador do "peso" é a disciplina **dentro deste concurso**, nunca o
        # acervo inteiro: o acervo mistura cargos, e somar Informática (Agente
        # Comercial) com TI daria um total que o candidato nunca vai enfrentar
        # (`CLAUDE.md` §7.4).
        do_concurso = Questao.objects.filter(prova__concurso=concurso)
        totais: dict[str, int] = {}
        nao_classificadas: dict[str, int] = {}
        for questao in do_concurso.values("disciplina_id", "topico_id"):
            d = questao["disciplina_id"]
            totais[d] = totais.get(d, 0) + 1
            if questao["topico_id"] is None:
                nao_classificadas[d] = nao_classificadas.get(d, 0) + 1

        banca = concurso.banca.nome if concurso.banca_id else None
        unidades: list[UnidadeDoEdital] = []

        for topico in topicos:
            subtopicos = [s for s in topico.subtopicos.all() if s.ativo_edital_vigente]
            alvos: list[Subtopico | None] = list(subtopicos) if subtopicos else [None]

            for subtopico in alvos:
                atual_id = subtopico.id if subtopico else topico.id
                if unidade_id and atual_id != unidade_id:
                    continue

                questoes = (
                    do_concurso.filter(subtopico=subtopico)
                    if subtopico
                    else do_concurso.filter(topico=topico)
                ).prefetch_related("alternativas")

                unidades.append(
                    UnidadeDoEdital(
                        disciplina=topico.disciplina,
                        topico=topico,
                        subtopico=subtopico,
                        concurso_nome=concurso.nome,
                        concurso_orgao=concurso.orgao,
                        concurso_cargo=concurso.cargo,
                        banca=banca,
                        questoes=list(questoes.order_by("-ano", "prova_id", "numero_na_prova")),
                        total_da_disciplina=totais.get(topico.disciplina_id, 0),
                        nao_classificadas_na_disciplina=nao_classificadas.get(
                            topico.disciplina_id, 0
                        ),
                    )
                )

        return unidades

    # ------------------------------------------------------------------ escrita

    def _dry_run(self, pendentes: list[UnidadeDoEdital]) -> None:
        for unidade in pendentes:
            self.stdout.write(
                f"  {unidade.id:<40} {unidade.disciplina.nome} › {unidade.nome[:60]} "
                f"({len(unidade.questoes)} questões reais)"
            )
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("--- prompt da primeira unidade ---"))
        self.stdout.write(montar_prompt_aula(pendentes[0]))
        self.stdout.write("")

        # Estimativa só do lado da entrada, e propositalmente sem palpite de saída:
        # o texto gerado é a maior parte do custo e não dá pra prever antes de rodar.
        # Chutar um número aqui daria uma precisão que este comando não tem — melhor
        # medir de verdade com `--limite 3` e extrapolar do relatório real.
        caracteres = sum(len(montar_prompt_aula(u)) for u in pendentes)
        self.stdout.write(
            self.style.SUCCESS(f"{len(pendentes)} chamadas seriam feitas. Nada foi gravado.")
        )
        self.stdout.write(
            f"Entrada: ~{caracteres // 4} tokens no total (estimativa grosseira por "
            f"contagem de caracteres, sem contar o cache do prompt de sistema).\n"
            f"O custo é dominado pela saída, que só dá pra medir rodando: comece com "
            f"`--limite 3` e extrapole pelo relatório."
        )

    def _gerar(
        self,
        pendentes: list[UnidadeDoEdital],
        concurso: Concurso,
        modelo: str,
        efeito: str,
    ) -> None:
        try:
            import anthropic
        except ImportError as erro:  # pragma: no cover - depende do ambiente
            raise CommandError(
                "o pacote `anthropic` não está instalado. Rode:\n"
                "  .venv/Scripts/python.exe -m pip install -r requirements.txt"
            ) from erro

        if not os.environ.get("ANTHROPIC_API_KEY"):
            raise CommandError(
                "ANTHROPIC_API_KEY não está definida. Crie `backend/.env` com:\n"
                "  ANTHROPIC_API_KEY=sk-ant-...\n"
                "(config/settings.py já carrega esse arquivo; a chave nunca vai pro git.)"
            )

        cliente = anthropic.Anthropic()
        entrada = saida = cache_escrito = cache_lido = 0
        gravadas = 0
        falhas: list[tuple[str, str]] = []

        for i, unidade in enumerate(pendentes, start=1):
            rotulo = f"[{i}/{len(pendentes)}] {unidade.id}"
            self.stdout.write(f"{rotulo} — {unidade.nome[:70]}…")

            try:
                # Streaming porque `max_tokens` alto em requisição comum estoura o
                # timeout HTTP do SDK muito antes de o modelo terminar.
                with cliente.messages.stream(
                    model=modelo,
                    max_tokens=MAX_TOKENS,
                    system=[
                        {
                            "type": "text",
                            "text": SISTEMA,
                            # A instrução pedagógica é a mesma em todas as unidades;
                            # marcada aqui, ela é escrita no cache uma vez e lida nas
                            # chamadas seguintes por ~10% do preço.
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    output_config={"effort": efeito},
                    messages=[{"role": "user", "content": montar_prompt_aula(unidade)}],
                ) as fluxo:
                    resposta = fluxo.get_final_message()
            except anthropic.APIStatusError as erro:
                falhas.append((unidade.id, f"API {erro.status_code}: {erro.message}"))
                self.stderr.write(self.style.ERROR(f"  falhou: {erro.status_code}"))
                continue
            except anthropic.APIConnectionError as erro:
                falhas.append((unidade.id, f"rede: {erro}"))
                self.stderr.write(self.style.ERROR("  falhou: erro de rede"))
                continue

            uso = resposta.usage
            entrada += uso.input_tokens
            saida += uso.output_tokens
            cache_escrito += uso.cache_creation_input_tokens or 0
            cache_lido += uso.cache_read_input_tokens or 0

            # Duas recusas possíveis, e nenhuma delas deve virar aula gravada:
            # conteúdo recusado pelo modelo, e texto cortado no teto de tokens.
            if resposta.stop_reason == "refusal":
                falhas.append((unidade.id, "o modelo recusou gerar este conteúdo"))
                self.stderr.write(self.style.ERROR("  falhou: recusa do modelo"))
                continue
            if resposta.stop_reason == "max_tokens":
                falhas.append((unidade.id, f"aula truncada no teto de {MAX_TOKENS} tokens"))
                self.stderr.write(self.style.ERROR("  falhou: resposta truncada"))
                continue

            texto = "\n".join(b.text for b in resposta.content if b.type == "text").strip()
            if not texto:
                falhas.append((unidade.id, "resposta veio sem texto"))
                self.stderr.write(self.style.ERROR("  falhou: resposta vazia"))
                continue

            Aula.objects.update_or_create(
                topico=unidade.topico,
                subtopico=unidade.subtopico,
                concurso_id=concurso.slug,
                defaults={"conteudo_markdown": texto, "modelo": modelo},
            )
            gravadas += 1
            self.stdout.write(self.style.SUCCESS(f"  gravada ({len(texto)} caracteres)"))

        self._relatorio(modelo, gravadas, falhas, entrada, saida, cache_escrito, cache_lido)

    def _relatorio(
        self,
        modelo: str,
        gravadas: int,
        falhas: list[tuple[str, str]],
        entrada: int,
        saida: int,
        cache_escrito: int,
        cache_lido: int,
    ) -> None:
        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"{gravadas} aulas gravadas."))

        if falhas:
            self.stdout.write(self.style.WARNING(f"{len(falhas)} falharam:"))
            for unidade_id, motivo in falhas:
                self.stdout.write(f"  {unidade_id}: {motivo}")
            self.stdout.write("Rode o comando de novo — ele retoma pelas que faltam.")

        self.stdout.write(
            f"Tokens: {entrada} entrada · {saida} saída · "
            f"{cache_escrito} escritos em cache · {cache_lido} lidos do cache."
        )

        preco = PRECO_POR_MILHAO.get(modelo)
        if preco is None:
            self.stdout.write(f"Sem tabela de preço para {modelo}; custo não estimado.")
            return

        preco_entrada, preco_saida = preco
        custo = (
            entrada * preco_entrada
            + cache_escrito * preco_entrada * 1.25
            + cache_lido * preco_entrada * 0.1
            + saida * preco_saida
        ) / 1_000_000
        self.stdout.write(f"Custo aproximado desta rodada: US$ {custo:.2f}")
