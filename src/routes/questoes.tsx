import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AvisoAcervo } from "@/components/AvisoAcervo";
import { GabaritoComentado } from "@/components/GabaritoComentado";
import { TextoDaQuestao } from "@/components/Markdown";
import { useAcervoDoConcurso } from "@/services/hooks";
import { pontosFracos } from "@/lib/desempenho";
import {
  RITMO_ALVO_SEGUNDOS,
  avaliarRitmo,
  duracaoDaProva,
  formatarDuracao,
  formatarRelogio,
  resumoDeRitmo,
} from "@/lib/ritmo";
import { SemAcervo } from "@/components/SemAcervo";
import { ehTreinoDeFormato } from "@/data/concursos";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Questao } from "@/types";

export const Route = createFileRoute("/questoes")({
  /**
   * `?prova=<id>` entra em modo prova completa: carrega o caderno inteiro, na
   * ordem original, com o tempo real do concurso. É o que a tela de Provas
   * aciona no "Resolver".
   *
   * `?assunto=<unidadeId>` treina só um item do edital. É o caminho que fecha o
   * ciclo da aula: leu a teoria do assunto, resolve as questões reais dele sem
   * passar pelo filtro de disciplina inteira.
   */
  validateSearch: (busca: Record<string, unknown>): { prova?: string; assunto?: string } => ({
    prova: typeof busca.prova === "string" && busca.prova ? busca.prova : undefined,
    assunto: typeof busca.assunto === "string" && busca.assunto ? busca.assunto : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Simulados — Foco BB TI 2026" },
      { name: "description", content: "Monte simulados personalizados no estilo Cesgranrio." },
      { property: "og:title", content: "Banco de Questões" },
      {
        property: "og:description",
        content: "Pratique com questões filtradas por disciplina e ano.",
      },
    ],
  }),
  component: QuestoesPage,
});

type Etapa = "config" | "resolvendo" | "resultado";

function QuestoesPage() {
  const [etapa, setEtapa] = useState<Etapa>("config");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [qtd, setQtd] = useState(10);
  const [ano, setAno] = useState<string>("todos");
  const [somenteErrei, setSomenteErrei] = useState(false);
  const [modoFracos, setModoFracos] = useState(false);
  // Instante em que a questão atual apareceu, para medir o tempo dela. É o dado
  // que falta a quem sabe a matéria e mesmo assim não termina a prova.
  const [inicioQuestao, setInicioQuestao] = useState(0);
  const [temposPorQuestao, setTemposPorQuestao] = useState<Record<string, number>>({});
  const [lista, setLista] = useState<Questao[]>([]);
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [inicio, setInicio] = useState(0);
  // Alternativa marcada mas ainda **não** confirmada. Existe para abrir espaço
  // entre escolher e ver o gabarito — é nesse espaço que o raciocínio é escrito.
  // Sem ela, o gabarito aparece no clique e qualquer justificativa depois disso
  // é justificativa da resposta certa, não do que a pessoa pensou.
  const [preEscolha, setPreEscolha] = useState<string | null>(null);
  const [raciocinio, setRaciocinio] = useState("");

  const { prova: provaSolicitada, assunto: assuntoSolicitado } = Route.useSearch();
  const {
    historico,
    registrarResposta,
    avaliarRaciocinio,
    concursoAtivoId,
    agendarRevisaoPorErro,
  } = useStore();
  const {
    concurso,
    disciplinas,
    questoes: allQuestoes,
    provas,
    carregando,
    vazio,
  } = useAcervoDoConcurso(concursoAtivoId);

  /**
   * De onde a questão veio, para a tela nunca deixar passar prova de outro órgão
   * como se fosse cobrança do seu edital.
   *
   * O `doConcurso` sai da **fonte do concurso**, não da comparação de órgão com
   * o concurso ativo: quando o candidato troca para um treino de formato, o
   * órgão do concurso passa a ser o daquela prova e a comparação casaria sempre,
   * justamente no caso em que o aviso mais importa.
   */
  const provaPorId = useMemo(() => new Map(provas.map((p) => [p.id, p])), [provas]);
  const ehTreino = ehTreinoDeFormato(concurso);
  const origemDaQuestao = (q: Questao) => ({
    orgao:
      (q.provaId ? provaPorId.get(q.provaId)?.orgao : undefined) ??
      concurso?.orgao ??
      "origem não registrada",
    doConcurso: !ehTreino,
  });

  // As disciplinas chegam depois do primeiro render, então a seleção inicial
  // "todas marcadas" só dá para montar quando elas existem. Roda uma vez: depois
  // disso quem manda na seleção é o usuário.
  const [selecaoIniciada, setSelecaoIniciada] = useState(false);
  useEffect(() => {
    if (!selecaoIniciada && disciplinas.length) {
      setSelecionadas(disciplinas.map((d) => d.id));
      setSelecaoIniciada(true);
    }
  }, [disciplinas, selecaoIniciada]);

  /** Nome da unidade do edital, para a revisão agendada nascer com rótulo legível. */
  const nomeDaUnidade = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const d of disciplinas) {
      for (const t of d.topicos) {
        mapa.set(t.id, t.nome);
        for (const s of t.subtopicos) mapa.set(s.id, s.nome);
      }
    }
    return mapa;
  }, [disciplinas]);

  // Anos oferecidos no filtro saem do próprio acervo: uma lista fixa mostraria
  // ano sem questão nenhuma e esconderia prova recém-importada.
  const anos = useMemo(
    () => Array.from(new Set(allQuestoes.map((q) => q.ano))).sort((a, b) => b - a),
    [allQuestoes],
  );

  // Assuntos onde o desempenho é pior, para o modo "só o que eu erro". Usa a
  // análise por assunto, e não a lista de questões erradas: refazer exatamente a
  // questão que já se errou treina a memória da resposta, não o assunto.
  const unidadesFracas = useMemo(
    () =>
      new Set(pontosFracos(historico, allQuestoes, concursoAtivoId, 99).map((d) => d.unidadeId)),
    [historico, allQuestoes, concursoAtivoId],
  );

  // Modo prova completa: dispara sozinho quando se chega por `?prova=`.
  const [provaMontada, setProvaMontada] = useState<string | null>(null);
  useEffect(() => {
    if (!provaSolicitada || provaMontada === provaSolicitada || allQuestoes.length === 0) return;
    const doCaderno = allQuestoes
      .filter((q) => q.provaId === provaSolicitada && !q.anulada)
      // Ordem original do caderno, não sorteada: simular prova é treinar a
      // sequência real, inclusive o cansaço de chegar na questão 60.
      .sort((a, b) => (a.numeroNaProva ?? 0) - (b.numeroNaProva ?? 0));
    if (doCaderno.length === 0) return;
    setProvaMontada(provaSolicitada);
    setLista(doCaderno);
    setRespostas({});
    setTemposPorQuestao({});
    setIdx(0);
    setInicio(Date.now());
    setInicioQuestao(Date.now());
    setEtapa("resolvendo");
  }, [provaSolicitada, provaMontada, allQuestoes]);

  // Modo assunto: dispara sozinho quando se chega por `?assunto=`, vindo da aula.
  // Sem sorteio de ordem própria só para ficar diferente do modo prova: aqui a
  // ordem original não significa nada (as questões vêm de cadernos diferentes),
  // então vale embaralhar como no simulado normal.
  const [assuntoMontado, setAssuntoMontado] = useState<string | null>(null);
  useEffect(() => {
    if (!assuntoSolicitado || assuntoMontado === assuntoSolicitado || allQuestoes.length === 0)
      return;
    const doAssunto = allQuestoes
      // Casa tópico **ou** subtópico de propósito: quando a unidade é um tópico
      // sem subdivisão, a questão guarda só `topicoId`; quando é um subtópico, o
      // id nunca bate com `topicoId`. É a mesma conta que `AulaSubtopico` mostra
      // no diálogo — se divergisse, o botão abriria um número de questões
      // diferente do que ele mesmo promete.
      .filter(
        (q) =>
          (q.subtopicoId === assuntoSolicitado || q.topicoId === assuntoSolicitado) && !q.anulada,
      )
      .sort(() => Math.random() - 0.5);
    // Sem questão classificada neste assunto não há o que treinar; deixa a tela
    // de configuração aparecer normalmente em vez de abrir um simulado vazio.
    if (doAssunto.length === 0) return;
    setAssuntoMontado(assuntoSolicitado);
    setLista(doAssunto);
    setRespostas({});
    setTemposPorQuestao({});
    setIdx(0);
    setInicio(Date.now());
    setInicioQuestao(Date.now());
    setEtapa("resolvendo");
  }, [assuntoSolicitado, assuntoMontado, allQuestoes]);

  // Trocar de questão limpa o rascunho: raciocínio escrito para uma questão
  // vazando para a seguinte seria pior que campo vazio — daria a impressão de
  // já ter respondido.
  useEffect(() => {
    setPreEscolha(null);
    setRaciocinio("");
  }, [idx]);

  const iniciar = () => {
    const errouIds = new Set(historico.filter((h) => !h.correta).map((h) => h.questaoId));
    let filtradas = allQuestoes.filter(
      (q) =>
        selecionadas.includes(q.disciplinaId) &&
        (ano === "todos" || q.ano === Number(ano)) &&
        (!somenteErrei || errouIds.has(q.id)) &&
        (!modoFracos || unidadesFracas.has(q.subtopicoId ?? q.topicoId ?? "")) &&
        // Anulada não tem gabarito: entraria no simulado como erro garantido.
        !q.anulada,
    );
    filtradas = filtradas.sort(() => Math.random() - 0.5).slice(0, qtd);
    if (filtradas.length === 0) return;
    setLista(filtradas);
    setRespostas({});
    setTemposPorQuestao({});
    setIdx(0);
    setInicio(Date.now());
    setInicioQuestao(Date.now());
    setEtapa("resolvendo");
  };

  if (etapa === "config") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Configurar simulado</h1>
          <p className="text-sm text-muted-foreground">Personalize seu treino de hoje.</p>
        </div>

        <AvisoAcervo />

        {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Disciplinas</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {disciplinas.map((d) => (
              <label
                key={d.id}
                className="flex items-center gap-2 rounded-md border border-border p-3 cursor-pointer"
              >
                <Checkbox
                  checked={selecionadas.includes(d.id)}
                  onCheckedChange={(v) =>
                    setSelecionadas((s) => (v ? [...s, d.id] : s.filter((x) => x !== d.id)))
                  }
                />
                <span className="text-sm">{d.nome}</span>
              </label>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Quantidade de questões</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={qtd}
              onChange={(e) => setQtd(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
            />
          </div>
          <div className="space-y-2">
            <Label>Ano da prova</Label>
            <Select value={ano} onValueChange={setAno}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os anos</SelectItem>
                {anos.map((a) => (
                  <SelectItem key={a} value={String(a)}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={somenteErrei} onCheckedChange={(v) => setSomenteErrei(!!v)} />
            <span className="text-sm">Somente questões que errei</span>
          </label>

          <label className="flex cursor-pointer items-start gap-2">
            <Checkbox
              checked={modoFracos}
              onCheckedChange={(v) => setModoFracos(!!v)}
              disabled={unidadesFracas.size === 0}
            />
            <span className="text-sm">
              Só os meus pontos fracos
              <span className="block text-xs text-muted-foreground">
                {unidadesFracas.size === 0
                  ? "Responda pelo menos 3 questões de um mesmo assunto para ele poder ser considerado fraco."
                  : `${unidadesFracas.size} ${unidadesFracas.size === 1 ? "assunto" : "assuntos"} em que seu acerto está abaixo da sua própria média, e não por azar de uma ou outra questão. Traz questões NOVAS desses assuntos, não as que você já errou.`}
              </span>
            </span>
          </label>
        </div>

        <Button size="lg" className="w-full" onClick={iniciar} disabled={carregando}>
          {carregando ? "Carregando questões…" : "Iniciar simulado"}
        </Button>
      </div>
    );
  }

  if (etapa === "resolvendo") {
    const q = lista[idx];
    const escolhida = respostas[q.id];
    const respondida = !!escolhida;

    // A resposta gravada desta questão, para a tela poder mostrar de volta o que
    // foi escrito e qual nota já recebeu. É a última: refazer a mesma questão é
    // comum, e a avaliação que vale é a da tentativa atual.
    let iRegistro = -1;
    for (let i = historico.length - 1; i >= 0; i--) {
      if (historico[i].questaoId === q.id && historico[i].concursoId === concursoAtivoId) {
        iRegistro = i;
        break;
      }
    }
    const raciocinioDaResposta = iRegistro >= 0 ? historico[iRegistro].raciocinio : undefined;
    const avaliacaoAtual = iRegistro >= 0 ? historico[iRegistro].autoavaliacao : undefined;

    /**
     * Registra a resposta.
     *
     * Fica no clique da alternativa porque é assim que a tela já se comporta: ao
     * escolher, as alternativas travam e o gabarito aparece. Antes havia um botão
     * "Responder" que só era exibido quando NADA estava escolhido e ficava
     * desabilitado justamente nesse caso — ou seja, nunca era clicável, e nenhuma
     * resposta do simulado chegava ao histórico. Streak, pontos fracos e análise
     * ficavam todos zerados sem que nada na tela denunciasse.
     */
    const responder = (letra: string, motivo: string) => {
      if (respondida) return;
      const acertou = letra === q.correta;
      const segundos = Math.max(0, Math.floor((Date.now() - inicioQuestao) / 1000));

      setRespostas((r) => ({ ...r, [q.id]: letra }));
      setTemposPorQuestao((tp) => ({ ...tp, [q.id]: segundos }));
      registrarResposta({
        questaoId: q.id,
        disciplinaId: q.disciplinaId,
        concursoId: concursoAtivoId,
        escolhida: letra,
        correta: acertou,
        data: new Date().toISOString(),
        // O tempo ia só para o estado local da tela e morria ao sair dela. Sem
        // persistir, o diagnóstico de ritmo por disciplina não tinha o que ler.
        segundos,
        raciocinio: motivo.trim() || undefined,
      });

      // Sem raciocínio não há o que autoavaliar depois: o chute já se declarou.
      // Registrar aqui evita deixar a resposta num limbo que a análise leria
      // como "ainda não avaliada".
      if (!motivo.trim()) avaliarRaciocinio(q.id, concursoAtivoId, "chutei");

      // Errou: agenda a revisão daquele assunto sozinha.
      const unidadeId = q.subtopicoId ?? q.topicoId;
      if (!acertou && unidadeId) {
        agendarRevisaoPorErro({
          unidadeId,
          topico: nomeDaUnidade.get(unidadeId) ?? unidadeId,
          disciplinaId: q.disciplinaId,
          concursoId: concursoAtivoId,
        });
      }
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Questão {idx + 1} de {lista.length}
          </Badge>
          <div className="flex items-center gap-2">
            {provaMontada && (
              <RelogioDaProva inicio={inicio} duracao={duracaoDaProva(lista.length)} />
            )}
            <RitmoDaQuestao inicio={inicioQuestao} respondida={respondida} />
            <Badge>{disciplinas.find((d) => d.id === q.disciplinaId)?.nome}</Badge>
          </div>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
              <span>
                {origemDaQuestao(q).orgao} · {q.banca} · {q.ano}
                {q.numeroNaProva ? ` · questão ${q.numeroNaProva}` : ""}
              </span>
              {/* Questão de outro órgão treina o formato da banca, mas não é do
                  seu edital: o assunto pode nem existir nele. Sem esta marca, o
                  candidato lê tudo como se fosse cobrança do BB. */}
              {!origemDaQuestao(q).doConcurso && (
                <Badge
                  variant="outline"
                  className="border-amber-500/50 text-amber-700 dark:text-amber-400"
                >
                  Treino de formato — fora do seu edital
                </Badge>
              )}
            </p>
            {q.textoBase && (
              <details className="rounded-lg border border-border bg-muted/40 p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Texto de apoio (necessário para responder)
                </summary>
                <TextoDaQuestao className="mt-2 block whitespace-pre-line text-sm leading-relaxed">
                  {q.textoBase}
                </TextoDaQuestao>
              </details>
            )}
            <TextoDaQuestao className="block text-base leading-relaxed whitespace-pre-line">
              {q.enunciado}
            </TextoDaQuestao>
            {/* Certo/errado não tem alternativas: a afirmação inteira está no
                enunciado. Renderizar duas opções vazias no formato de múltipla
                escolha só imitaria a aparência errada. */}
            {q.tipo === "certo_errado" ? (
              <div className="grid grid-cols-2 gap-2">
                {(["C", "E"] as const).map((letra) => {
                  const isChosen = (escolhida ?? preEscolha) === letra;
                  const isCorreta = letra === q.correta;
                  return (
                    <button
                      key={letra}
                      disabled={respondida}
                      onClick={() => !respondida && setPreEscolha(letra)}
                      className={cn(
                        "rounded-lg border p-4 text-center font-bold transition-all duration-150",
                        !respondida &&
                          "hover:-translate-y-px hover:border-primary/40 hover:bg-muted hover:shadow-sm",
                        respondida && isCorreta && "border-sucesso bg-sucesso-suave",
                        respondida &&
                          isChosen &&
                          !isCorreta &&
                          "border-destructive bg-destructive/10",
                        !respondida && isChosen && "border-primary bg-primary/5",
                      )}
                    >
                      {letra === "C" ? "Certo" : "Errado"}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {q.alternativas.map((a) => {
                  const isChosen = escolhida === a.letra;
                  const isCorreta = a.letra === q.correta;
                  const showResult = respondida;
                  return (
                    <button
                      key={a.letra}
                      disabled={respondida}
                      onClick={() => !respondida && setPreEscolha(a.letra)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-all duration-150",
                        // `hover:bg-accent` pintava a alternativa de amarelo forte:
                        // neste tema o accent é o amarelo do BB, reservado para
                        // destaque de verdade. Passar o mouse tem que sugerir, não gritar.
                        !showResult &&
                          "hover:-translate-y-px hover:border-primary/40 hover:bg-muted hover:shadow-sm",
                        showResult && isCorreta && "border-sucesso bg-sucesso-suave",
                        showResult &&
                          isChosen &&
                          !isCorreta &&
                          "border-destructive bg-destructive/10",
                        !showResult && isChosen && "border-primary bg-primary/5",
                      )}
                    >
                      <span className="font-black text-primary">{a.letra}</span>
                      <TextoDaQuestao className="text-sm flex-1">{a.texto}</TextoDaQuestao>
                      {showResult && isCorreta && (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-sucesso" />
                      )}
                      {showResult && isChosen && !isCorreta && (
                        <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {/* O passo que separa saber de eliminar bem.
                A alternativa marcada não revela nada até o raciocínio ser
                escrito: acerto sozinho não distingue quem domina o assunto de
                quem chutou entre duas — e as duas coisas pedem estudo oposto. */}
            {!respondida && preEscolha && (
              <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div>
                  <p className="text-sm font-semibold">
                    Por que você marcou{" "}
                    {preEscolha === "C" && q.tipo === "certo_errado"
                      ? "Certo"
                      : preEscolha === "E" && q.tipo === "certo_errado"
                        ? "Errado"
                        : preEscolha}
                    ?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Escreva antes de ver o gabarito. Depois da resposta na tela, o que sai é
                    justificativa, não raciocínio.
                  </p>
                </div>
                <Textarea
                  value={raciocinio}
                  onChange={(e) => setRaciocinio(e.target.value)}
                  placeholder="O que te levou a essa alternativa? O que descartou as outras?"
                  className="min-h-20 text-sm"
                  autoFocus
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => responder(preEscolha, raciocinio)}
                    disabled={!raciocinio.trim()}
                  >
                    Confirmar e ver o gabarito
                  </Button>
                  {/* Assumir o chute é informação, não desistência: é o que
                      impede o acerto por sorte de virar "assunto dominado". */}
                  <Button variant="ghost" onClick={() => responder(preEscolha, "")}>
                    Chutei, não sei explicar
                  </Button>
                </div>
              </div>
            )}

            {/* Depois do gabarito: o candidato confere o próprio raciocínio.
                É autoavaliação porque julgar texto livre exigiria IA em tempo de
                execução (§7.6). Quem marca "bateu" no que não bateu engana o
                próprio cronograma — nenhum app resolve isso, e fingir que
                resolve seria pior. */}
            {respondida && raciocinioDaResposta && (
              <div className="space-y-2 rounded-lg border border-border p-4">
                <p className="text-sm font-semibold">
                  {escolhida === q.correta
                    ? "Acertou. O seu raciocínio bateu com o gabarito?"
                    : "Errou. Onde o seu raciocínio saiu do trilho?"}
                </p>
                <p className="rounded bg-muted/60 p-2 text-xs italic text-muted-foreground">
                  “{raciocinioDaResposta}”
                </p>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["bateu", "Bateu com o gabarito"],
                      ["torto", "Cheguei por caminho errado"],
                      ["chutei", "Foi chute"],
                    ] as const
                  ).map(([nota, rotulo]) => (
                    <Button
                      key={nota}
                      size="sm"
                      variant={avaliacaoAtual === nota ? "default" : "outline"}
                      onClick={() => avaliarRaciocinio(q.id, concursoAtivoId, nota)}
                    >
                      {rotulo}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  É isto que decide se o assunto ainda pede teoria ou já pode ser estudado pelo
                  gabarito. Acerto por eliminação conta como “caminho errado”.
                </p>
              </div>
            )}

            {respondida && (
              <div className="rounded-lg bg-muted p-4">
                {/* Questão vinda do caderno da banca não traz comentário: a
                    Cesgranrio publica prova e gabarito, não explicação. O
                    comentário é gerado por IA fora do app e colado aqui — por
                    isso vem sempre com o aviso de conteúdo gerado. */}
                <GabaritoComentado
                  questao={q}
                  disciplinaNome={
                    disciplinas.find((d) => d.id === q.disciplinaId)?.nome ?? q.disciplinaId
                  }
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={idx === 0}
            onClick={() => {
              setIdx(idx - 1);
              setInicioQuestao(Date.now());
            }}
          >
            Anterior
          </Button>
          {idx < lista.length - 1 ? (
            <Button
              className="flex-1"
              onClick={() => {
                setIdx(idx + 1);
                setInicioQuestao(Date.now());
              }}
            >
              Próxima
            </Button>
          ) : (
            <Button className="flex-1" onClick={() => setEtapa("resultado")}>
              Ver resultado
            </Button>
          )}
        </div>
      </div>
    );
  }

  // resultado
  const acertos = lista.filter((q) => respostas[q.id] === q.correta).length;
  const pct = Math.round((acertos / lista.length) * 100);
  const tempoMin = Math.max(1, Math.round((Date.now() - inicio) / 60000));
  const ritmo = resumoDeRitmo(Object.values(temposPorQuestao));

  // Prova com desconto: cada erro anula um acerto. Mostrar só "X de Y corretas"
  // numa prova dessas esconde a nota real — quem acerta 6 e erra 4 de 10 não fez
  // 60%, fez 2 pontos líquidos.
  const comDesconto = lista.some((q) => q.pontuacaoLiquida);
  const erros = lista.filter((q) => respostas[q.id] && respostas[q.id] !== q.correta).length;
  const liquido = acertos - erros;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Resultado</p>
          <p className="text-5xl font-black text-primary">{pct}%</p>
          <p className="text-sm">
            {acertos} de {lista.length} corretas · {tempoMin} min
          </p>
          {comDesconto && (
            <p className="mx-auto max-w-lg rounded-md border border-atencao/40 bg-atencao-suave p-2 text-sm text-atencao-foreground">
              Esta prova <strong>desconta erro</strong>: cada errada anula uma certa. Sua pontuação
              líquida é <strong>{liquido}</strong> ({acertos} certas − {erros} erradas), não {pct}%.
              Em prova assim, chutar custa.
            </p>
          )}
          {ritmo.media > 0 && (
            <p className="mx-auto max-w-lg border-t border-border pt-3 text-sm text-muted-foreground">
              {ritmo.mensagem}
              {ritmo.acimaDoAlvo > 0 && (
                <>
                  {" "}
                  <strong className="text-foreground">{ritmo.acimaDoAlvo}</strong>{" "}
                  {ritmo.acimaDoAlvo === 1 ? "questão passou" : "questões passaram"} do tempo-alvo.
                </>
              )}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {lista.map((q, i) => {
          const correta = respostas[q.id] === q.correta;
          return (
            <Card key={q.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={correta ? "default" : "destructive"}>{i + 1}</Badge>
                  <p className="text-xs text-muted-foreground">
                    Sua: {respostas[q.id] || "—"} · Correta: {q.correta}
                    {temposPorQuestao[q.id] !== undefined &&
                      ` · ${formatarDuracao(temposPorQuestao[q.id])}`}
                  </p>
                </div>
                <TextoDaQuestao className="block text-sm">{q.enunciado}</TextoDaQuestao>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Button className="w-full" onClick={() => setEtapa("config")}>
        Novo simulado
      </Button>
    </div>
  );
}

/**
 * Cronômetro da questão em curso.
 *
 * Componente próprio para o tique de 1 s re-renderizar só este selo, e não a
 * questão inteira a cada segundo. Congela ao responder: depois disso o número
 * vira o tempo que a questão custou, não um relógio correndo.
 */
function RitmoDaQuestao({ inicio, respondida }: { inicio: number; respondida: boolean }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    if (respondida) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [respondida, inicio]);

  const segundos = Math.max(0, Math.floor((agora - inicio) / 1000));
  const ritmo = avaliarRitmo(segundos);

  return (
    <Badge
      variant="outline"
      className={cn(
        "tabular-nums",
        ritmo === "lento" && "border-atencao text-atencao-foreground",
        ritmo === "rapido" && "border-sucesso text-sucesso",
      )}
      title={`Ritmo da prova: ${formatarDuracao(RITMO_ALVO_SEGUNDOS)} por questão`}
    >
      {formatarDuracao(segundos)}
    </Badge>
  );
}

/**
 * Relógio regressivo da prova inteira.
 *
 * Fica separado do cronômetro da questão porque mede outra coisa e muda de cor
 * noutro momento: aqui o que importa é o tempo que resta para o caderno todo.
 * Vira alerta nos últimos 15 minutos — o ponto em que ainda dá para decidir
 * chutar o resto em vez de descobrir depois que acabou.
 */
function RelogioDaProva({ inicio, duracao }: { inicio: number; duracao: number }) {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const restante = duracao - Math.floor((agora - inicio) / 1000);
  const acabando = restante <= 15 * 60;

  return (
    <Badge
      variant="outline"
      className={cn("tabular-nums", acabando && "border-destructive text-destructive")}
      title="Tempo restante da prova inteira"
    >
      {restante <= 0 ? "tempo esgotado" : formatarRelogio(restante)}
    </Badge>
  );
}
