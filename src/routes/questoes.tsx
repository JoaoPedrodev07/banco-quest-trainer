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
import { useStore, type CadernoSalvo, type SimuladoAtual } from "@/store/useStore";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { Bookmark, CheckCircle2, FolderOpen, Save, Trash2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Questao, RespostaHistorico } from "@/types";

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

/** Teto do simulado manual. 70 é o tamanho da prova real do BB (ADR-005). */
const MAX_QUESTOES = 70;

/**
 * Fotografia da sessão no momento da entrega. O resultado lê daqui, e não da
 * sessão do store, porque a entrega **encerra** a sessão — o resultado é a
 * memória do que acabou de acontecer, não estado vivo.
 */
interface ResultadoSimulado {
  questoes: Questao[];
  respostas: Record<string, string>;
  tempos: Record<string, number>;
  iniciadoEm: string;
  correcao: SimuladoAtual["correcao"];
  provaId: string | null;
}

function QuestoesPage() {
  const [etapa, setEtapa] = useState<Etapa>("config");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [qtd, setQtd] = useState(10);
  const [ano, setAno] = useState<string>("todos");
  const [somenteErrei, setSomenteErrei] = useState(false);
  const [somenteIneditas, setSomenteIneditas] = useState(false);
  const [modoFracos, setModoFracos] = useState(false);
  const [assunto, setAssunto] = useState("todos");
  const [modoCorrecao, setModoCorrecao] = useState<SimuladoAtual["correcao"]>("imediata");
  const [nomeCaderno, setNomeCaderno] = useState("");
  // Instante em que a questão atual apareceu, para medir o tempo dela. É o dado
  // que falta a quem sabe a matéria e mesmo assim não termina a prova.
  const [inicioQuestao, setInicioQuestao] = useState(0);
  const [resultado, setResultado] = useState<ResultadoSimulado | null>(null);
  // Alternativa marcada mas ainda **não** confirmada (modo imediata). Existe para
  // abrir espaço entre escolher e ver o gabarito — é nesse espaço que o
  // raciocínio é escrito. Sem ela, o gabarito aparece no clique e qualquer
  // justificativa depois disso é justificativa da resposta certa, não do que a
  // pessoa pensou.
  const [preEscolha, setPreEscolha] = useState<string | null>(null);
  const [raciocinio, setRaciocinio] = useState("");

  const { prova: provaSolicitada, assunto: assuntoSolicitado } = Route.useSearch();
  const {
    historico,
    registrarResposta,
    avaliarRaciocinio,
    concursoAtivoId,
    agendarRevisaoPorErro,
    simuladoAtual,
    iniciarSimulado,
    atualizarSimulado,
    encerrarSimulado,
    cadernos,
    salvarCaderno,
    removerCaderno,
  } = useStore();
  const {
    concurso,
    disciplinas,
    questoes: allQuestoes,
    provas,
    carregando,
    vazio,
  } = useAcervoDoConcurso(concursoAtivoId);

  // A sessão persistida só vale se for deste concurso: oferecer a de outro
  // levaria a responder questões que nem estão no acervo em foco.
  const sessao =
    simuladoAtual && simuladoAtual.concursoId === concursoAtivoId ? simuladoAtual : null;

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

  // A lista de questões da sessão, resolvida contra o acervo. Id que sumiu do
  // acervo (reimportação, mudança de cargo) é descartado em silêncio — melhor
  // uma prova de 69 questões do que uma tela quebrada na 34.
  const lista = useMemo(() => {
    if (!sessao) return [];
    const porId = new Map(allQuestoes.map((q) => [q.id, q]));
    return sessao.questaoIds
      .map((id) => porId.get(id))
      .filter((q): q is Questao => q !== undefined);
  }, [sessao, allQuestoes]);

  /** Abre uma sessão nova no store e entra na resolução. */
  const comecarSessao = (
    questoes: Questao[],
    provaId: string | null,
    correcao: SimuladoAtual["correcao"],
  ) => {
    iniciarSimulado({
      questaoIds: questoes.map((q) => q.id),
      respostas: {},
      tempos: {},
      marcadas: [],
      raciocinios: {},
      idx: 0,
      iniciadoEm: new Date().toISOString(),
      provaId,
      correcao,
      concursoId: concursoAtivoId,
    });
    setResultado(null);
    setInicioQuestao(Date.now());
    setEtapa("resolvendo");
  };

  // Modo prova completa: dispara sozinho quando se chega por `?prova=`.
  const [provaMontada, setProvaMontada] = useState<string | null>(null);
  useEffect(() => {
    if (!provaSolicitada || provaMontada === provaSolicitada || allQuestoes.length === 0) return;
    // Já existe sessão desta mesma prova? Retoma em vez de zerar — é exatamente
    // o caso "fechei o navegador na questão 52".
    if (sessao?.provaId === provaSolicitada) {
      setProvaMontada(provaSolicitada);
      setInicioQuestao(Date.now());
      setEtapa("resolvendo");
      return;
    }
    // Sessão de OUTRO simulado em andamento: não sobrescreve calado. A config
    // mostra o "continuar ou descartar" e o usuário decide.
    if (sessao) return;
    const doCaderno = allQuestoes
      .filter((q) => q.provaId === provaSolicitada && !q.anulada)
      // Ordem original do caderno, não sorteada: simular prova é treinar a
      // sequência real, inclusive o cansaço de chegar na questão 60.
      .sort((a, b) => (a.numeroNaProva ?? 0) - (b.numeroNaProva ?? 0));
    if (doCaderno.length === 0) return;
    setProvaMontada(provaSolicitada);
    // Prova completa corrige no fim por padrão: é o ensaio do dia real, e o dia
    // real não mostra gabarito na questão 12.
    comecarSessao(doCaderno, provaSolicitada, "no_fim");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provaSolicitada, provaMontada, allQuestoes, sessao]);

  // Modo assunto: dispara sozinho quando se chega por `?assunto=`, vindo da aula.
  const [assuntoMontado, setAssuntoMontado] = useState<string | null>(null);
  useEffect(() => {
    if (!assuntoSolicitado || assuntoMontado === assuntoSolicitado || allQuestoes.length === 0)
      return;
    if (sessao) return; // idem: sessão em andamento tem prioridade, a config resolve
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
    comecarSessao(doAssunto, null, "imediata");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assuntoSolicitado, assuntoMontado, allQuestoes, sessao]);

  const idx = sessao ? Math.min(sessao.idx, Math.max(0, lista.length - 1)) : 0;

  // Trocar de questão limpa o rascunho e rearma o cronômetro. Raciocínio escrito
  // para uma questão vazando para a seguinte seria pior que campo vazio — daria
  // a impressão de já ter respondido.
  useEffect(() => {
    setPreEscolha(null);
    setRaciocinio(sessao?.raciocinios[lista[idx]?.id ?? ""] ?? "");
    setInicioQuestao(Date.now());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, etapa]);

  // Assuntos oferecidos no filtro: só unidades com questão classificada dentro
  // das disciplinas marcadas — oferecer o edital inteiro encheria o select de
  // opções que devolvem simulado vazio.
  const assuntosDisponiveis = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const q of allQuestoes) {
      if (q.anulada || !selecionadas.includes(q.disciplinaId)) continue;
      const unidadeId = q.subtopicoId ?? q.topicoId;
      if (unidadeId) contagem.set(unidadeId, (contagem.get(unidadeId) ?? 0) + 1);
    }
    return [...contagem.entries()]
      .map(([id, n]) => ({ id, n, nome: nomeDaUnidade.get(id) ?? id }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [allQuestoes, selecionadas, nomeDaUnidade]);

  const iniciar = () => {
    const errouIds = new Set(historico.filter((h) => !h.correta).map((h) => h.questaoId));
    const respondidasIds = new Set(historico.map((h) => h.questaoId));
    let filtradas = allQuestoes.filter(
      (q) =>
        selecionadas.includes(q.disciplinaId) &&
        (ano === "todos" || q.ano === Number(ano)) &&
        (assunto === "todos" || q.subtopicoId === assunto || q.topicoId === assunto) &&
        (!somenteErrei || errouIds.has(q.id)) &&
        (!somenteIneditas || !respondidasIds.has(q.id)) &&
        (!modoFracos || unidadesFracas.has(q.subtopicoId ?? q.topicoId ?? "")) &&
        // Anulada não tem gabarito: entraria no simulado como erro garantido.
        !q.anulada,
    );
    filtradas = filtradas.sort(() => Math.random() - 0.5).slice(0, qtd);
    if (filtradas.length === 0) {
      toast.info("Nenhuma questão casa com esses filtros.", {
        description: "Afrouxe algum filtro — ou você já respondeu tudo que ele alcança.",
      });
      return;
    }
    comecarSessao(filtradas, null, modoCorrecao);
  };

  /** Preenche a config com os filtros de um caderno salvo (ADR-006). */
  const aplicarCaderno = (c: CadernoSalvo) => {
    setSelecionadas(c.filtros.disciplinas);
    setAno(c.filtros.ano);
    setAssunto(c.filtros.assunto ?? "todos");
    setSomenteErrei(c.filtros.somenteErrei);
    setSomenteIneditas(c.filtros.somenteIneditas);
    setModoFracos(c.filtros.modoFracos);
    setQtd(c.filtros.qtd);
    toast.success(`Caderno “${c.nome}” aplicado.`);
  };

  /**
   * Entrega/encerra a sessão e monta a fotografia do resultado.
   *
   * No modo `no_fim` é aqui que o histórico é gravado — durante a sessão as
   * respostas viviam só na sessão, para um simulado abandonado não poluir
   * streak nem pontos fracos. Questão em branco não vira resposta: em prova,
   * branco é ausência, não erro registrado.
   */
  const finalizar = () => {
    if (!sessao) return;
    if (sessao.correcao === "no_fim") {
      for (const q of lista) {
        const letra = sessao.respostas[q.id];
        if (!letra) continue;
        const acertou = letra === q.correta;
        const motivo = sessao.raciocinios[q.id]?.trim();
        registrarResposta({
          questaoId: q.id,
          disciplinaId: q.disciplinaId,
          concursoId: concursoAtivoId,
          escolhida: letra,
          correta: acertou,
          data: new Date().toISOString(),
          segundos: sessao.tempos[q.id],
          raciocinio: motivo || undefined,
        });
        const unidadeId = q.subtopicoId ?? q.topicoId;
        if (!acertou && unidadeId) {
          agendarRevisaoPorErro({
            unidadeId,
            topico: nomeDaUnidade.get(unidadeId) ?? unidadeId,
            disciplinaId: q.disciplinaId,
            concursoId: concursoAtivoId,
          });
        }
      }
    }
    setResultado({
      questoes: lista,
      respostas: sessao.respostas,
      tempos: sessao.tempos,
      iniciadoEm: sessao.iniciadoEm,
      correcao: sessao.correcao,
      provaId: sessao.provaId,
    });
    encerrarSimulado();
    setEtapa("resultado");
  };

  /** Guarda o rascunho de raciocínio do modo prova na sessão antes de navegar. */
  const salvarRascunhoNaSessao = () => {
    const q = lista[idx];
    if (!sessao || !q || sessao.correcao !== "no_fim") return;
    if ((sessao.raciocinios[q.id] ?? "") !== raciocinio) {
      atualizarSimulado({ raciocinios: { ...sessao.raciocinios, [q.id]: raciocinio } });
    }
  };

  const irPara = (novoIdx: number) => {
    salvarRascunhoNaSessao();
    atualizarSimulado({ idx: novoIdx });
  };

  // ------------------------------------------------------------------ config
  if (etapa === "config") {
    const respondidasNaSessao = sessao ? Object.keys(sessao.respostas).length : 0;
    const provaDaSessao = sessao?.provaId ? provaPorId.get(sessao.provaId) : null;
    const cadernosDoConcurso = cadernos.filter((c) => c.concursoId === concursoAtivoId);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black">Configurar simulado</h1>
          <p className="text-sm text-muted-foreground">Personalize seu treino de hoje.</p>
        </div>

        <AvisoAcervo />

        {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}

        {/* Sessão em andamento: fechar o navegador não custa mais a prova (ADR-005). */}
        {sessao && lista.length > 0 && (
          <Card className="border-primary/50 bg-primary/5">
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="font-bold">
                  Simulado em andamento
                  {provaDaSessao ? ` — ${provaDaSessao.orgao} ${provaDaSessao.ano}` : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  {respondidasNaSessao} de {lista.length} respondidas · iniciado em{" "}
                  {sessao.iniciadoEm.slice(0, 10).split("-").reverse().join("/")} · correção{" "}
                  {sessao.correcao === "no_fim" ? "no fim" : "imediata"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => {
                    setInicioQuestao(Date.now());
                    setEtapa("resolvendo");
                  }}
                >
                  Continuar
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline">Descartar</Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Descartar o simulado em andamento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        {sessao.correcao === "no_fim"
                          ? `As ${respondidasNaSessao} respostas desta sessão ainda não foram corrigidas e serão perdidas — nada delas entra no seu histórico.`
                          : "As respostas já dadas ficam no histórico; só a sessão é encerrada."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => encerrarSimulado()}>
                        Descartar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        )}

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

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Quantidade de questões</Label>
            <Input
              type="number"
              min={1}
              max={MAX_QUESTOES}
              value={qtd}
              onChange={(e) =>
                setQtd(Math.min(MAX_QUESTOES, Math.max(1, Number(e.target.value) || 1)))
              }
            />
            <p className="text-xs text-muted-foreground">Até {MAX_QUESTOES} — o tamanho da prova real.</p>
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
          <div className="space-y-2">
            <Label>Correção</Label>
            <Select
              value={modoCorrecao}
              onValueChange={(v) => setModoCorrecao(v as SimuladoAtual["correcao"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="imediata">Imediata — gabarito a cada questão</SelectItem>
                <SelectItem value="no_fim">No fim — como na prova real</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {modoCorrecao === "no_fim"
                ? "Sem feedback no meio; dá para trocar resposta até entregar."
                : "Escreva o raciocínio, veja o gabarito, siga."}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Assunto do edital (opcional)</Label>
          <Select value={assunto} onValueChange={setAssunto}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os assuntos</SelectItem>
              {assuntosDisponiveis.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome} ({a.n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Só aparecem assuntos com questão classificada nas disciplinas marcadas.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={somenteErrei}
              onCheckedChange={(v) => {
                setSomenteErrei(!!v);
                // Mutuamente exclusivos por definição: errar exige ter respondido.
                if (v) setSomenteIneditas(false);
              }}
            />
            <span className="text-sm">Somente questões que errei</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={somenteIneditas}
              onCheckedChange={(v) => {
                setSomenteIneditas(!!v);
                if (v) setSomenteErrei(false);
              }}
            />
            <span className="text-sm">
              Somente questões que nunca respondi
              <span className="block text-xs text-muted-foreground">
                Prioriza o inédito — refazer questão treina a memória da resposta, não o assunto.
              </span>
            </span>
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

        {/* Cadernos salvos (ADR-006): um conjunto de filtros com nome. Guarda
            filtros, não ids — questão nova que casa com o filtro entra sozinha. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cadernos salvos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {cadernosDoConcurso.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Salve os filtros de cima com um nome (“SQL da Cesgranrio”, “Português que erro”) e
                monte o mesmo treino em um clique.
              </p>
            )}
            {cadernosDoConcurso.map((c) => (
              <div
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {c.filtros.disciplinas.length}{" "}
                    {c.filtros.disciplinas.length === 1 ? "disciplina" : "disciplinas"} ·{" "}
                    {c.filtros.assunto
                      ? (nomeDaUnidade.get(c.filtros.assunto) ?? "assunto específico")
                      : "todos os assuntos"}{" "}
                    · {c.filtros.qtd} questões
                    {c.filtros.somenteErrei && " · só as que errei"}
                    {c.filtros.somenteIneditas && " · só inéditas"}
                    {c.filtros.modoFracos && " · pontos fracos"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => aplicarCaderno(c)}>
                    <FolderOpen className="h-3.5 w-3.5" />
                    Aplicar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1 text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      removerCaderno(c.id);
                      toast.success(`Caderno “${c.nome}” excluído.`);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={nomeCaderno}
                onChange={(e) => setNomeCaderno(e.target.value)}
                placeholder="Nome para os filtros atuais…"
                className="max-w-xs"
              />
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={!nomeCaderno.trim()}
                onClick={() => {
                  salvarCaderno({
                    id: `cad-${Date.now()}`,
                    nome: nomeCaderno.trim(),
                    concursoId: concursoAtivoId,
                    filtros: {
                      disciplinas: selecionadas,
                      ano,
                      assunto: assunto === "todos" ? null : assunto,
                      somenteErrei,
                      somenteIneditas,
                      modoFracos,
                      qtd,
                    },
                  });
                  setNomeCaderno("");
                  toast.success("Caderno salvo.");
                }}
              >
                <Save className="h-4 w-4" />
                Salvar caderno
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button size="lg" className="w-full" onClick={iniciar} disabled={carregando}>
          {carregando ? "Carregando questões…" : "Iniciar simulado"}
        </Button>
      </div>
    );
  }

  // -------------------------------------------------------------- resolvendo
  if (etapa === "resolvendo") {
    // Sessão sumiu (descartada em outra aba, acervo ainda carregando): volta à
    // config em vez de quebrar lendo questão de uma lista vazia.
    if (!sessao || lista.length === 0) {
      if (!carregando) setTimeout(() => setEtapa("config"), 0);
      return <p className="text-sm text-muted-foreground">Carregando sessão…</p>;
    }

    const q = lista[idx];
    const escolhida = sessao.respostas[q.id];
    const modoProva = sessao.correcao === "no_fim";
    // No modo imediata, responder trava a questão. No modo prova, nada trava —
    // trocar de resposta faz parte até a entrega.
    const respondida = !modoProva && !!escolhida;
    const respondidasNaSessao = Object.keys(sessao.respostas).length;

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
     * Registra a resposta (modo imediata): grava no histórico, congela a questão
     * e mostra o gabarito. O raciocínio veio do campo escrito antes.
     */
    const responder = (letra: string, motivo: string) => {
      if (respondida) return;
      const acertou = letra === q.correta;
      const segundos = Math.max(0, Math.floor((Date.now() - inicioQuestao) / 1000));

      atualizarSimulado({
        respostas: { ...sessao.respostas, [q.id]: letra },
        tempos: { ...sessao.tempos, [q.id]: segundos },
        raciocinios: { ...sessao.raciocinios, [q.id]: motivo },
      });
      registrarResposta({
        questaoId: q.id,
        disciplinaId: q.disciplinaId,
        concursoId: concursoAtivoId,
        escolhida: letra,
        correta: acertou,
        data: new Date().toISOString(),
        segundos,
        raciocinio: motivo.trim() || undefined,
      });

      // Sem raciocínio não há o que autoavaliar depois: o chute já se declarou.
      if (!motivo.trim()) avaliarRaciocinio(q.id, concursoAtivoId, "chutei");

      // Errou: agenda (ou regride) a revisão daquele assunto sozinha.
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

    /** Escolhe (ou troca) a resposta no modo prova — nada é corrigido agora. */
    const selecionarNoModoProva = (letra: string) => {
      const segundos = Math.max(0, Math.floor((Date.now() - inicioQuestao) / 1000));
      atualizarSimulado({
        respostas: { ...sessao.respostas, [q.id]: letra },
        // O tempo da primeira decisão é o que interessa ao ritmo; trocar a
        // resposta depois não devolve o tempo gasto.
        tempos:
          sessao.tempos[q.id] === undefined
            ? { ...sessao.tempos, [q.id]: segundos }
            : sessao.tempos,
      });
    };

    const aoClicarAlternativa = (letra: string) => {
      if (modoProva) selecionarNoModoProva(letra);
      else if (!respondida) setPreEscolha(letra);
    };

    const marcada = sessao.marcadas.includes(q.id);
    const letraVisivel = modoProva ? escolhida : (escolhida ?? preEscolha);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">
            Questão {idx + 1} de {lista.length}
          </Badge>
          <div className="flex items-center gap-2">
            {sessao.provaId && (
              <RelogioDaProva
                inicio={new Date(sessao.iniciadoEm).getTime()}
                duracao={duracaoDaProva(lista.length)}
              />
            )}
            <RitmoDaQuestao inicio={inicioQuestao} respondida={respondida} />
            <Badge>{disciplinas.find((d) => d.id === q.disciplinaId)?.nome}</Badge>
          </div>
        </div>

        {/* Grade de navegação (ADR-005): numa prova de 70, "Anterior/Próxima" é
            o mesmo que não ter navegação. Cada célula mostra o estado real. */}
        <div className="flex flex-wrap gap-1">
          {lista.map((questao, i) => {
            const foiRespondida = !!sessao.respostas[questao.id];
            const foiMarcada = sessao.marcadas.includes(questao.id);
            return (
              <button
                key={questao.id}
                onClick={() => irPara(i)}
                title={`Questão ${i + 1}${foiMarcada ? " — marcada" : ""}`}
                className={cn(
                  "h-8 w-8 rounded-md border text-xs font-bold tabular-nums transition-colors",
                  i === idx && "border-primary ring-2 ring-primary/40",
                  foiRespondida
                    ? "bg-primary text-primary-foreground border-primary/60"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted",
                  foiMarcada && "border-atencao ring-1 ring-atencao/60",
                )}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-start justify-between gap-2">
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
              <Button
                size="sm"
                variant={marcada ? "default" : "outline"}
                className="shrink-0 gap-1"
                onClick={() =>
                  atualizarSimulado({
                    marcadas: marcada
                      ? sessao.marcadas.filter((id) => id !== q.id)
                      : [...sessao.marcadas, q.id],
                  })
                }
              >
                <Bookmark className="h-3.5 w-3.5" />
                {marcada ? "Marcada" : "Marcar"}
              </Button>
            </div>
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
                  const isChosen = letraVisivel === letra;
                  const isCorreta = letra === q.correta;
                  return (
                    <button
                      key={letra}
                      disabled={respondida}
                      onClick={() => aoClicarAlternativa(letra)}
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
                  const isChosen = letraVisivel === a.letra;
                  const isCorreta = a.letra === q.correta;
                  const showResult = respondida;
                  return (
                    <button
                      key={a.letra}
                      disabled={respondida}
                      onClick={() => aoClicarAlternativa(a.letra)}
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

            {/* MODO PROVA: raciocínio opcional. A pressão de tempo é parte do
                treino; quem quiser registrar o caminho registra, e avalia tudo
                de uma vez na correção. */}
            {modoProva && escolhida && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">
                  Raciocínio (opcional no modo prova — será conferido na correção):
                </p>
                <Textarea
                  value={raciocinio}
                  onChange={(e) => setRaciocinio(e.target.value)}
                  onBlur={salvarRascunhoNaSessao}
                  placeholder="Por que essa alternativa?"
                  className="min-h-16 text-sm"
                />
              </div>
            )}

            {/* O passo que separa saber de eliminar bem (modo imediata).
                A alternativa marcada não revela nada até o raciocínio ser
                escrito: acerto sozinho não distingue quem domina o assunto de
                quem chutou entre duas — e as duas coisas pedem estudo oposto. */}
            {!modoProva && !respondida && preEscolha && (
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

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={idx === 0} onClick={() => irPara(idx - 1)}>
            Anterior
          </Button>
          {idx < lista.length - 1 ? (
            <Button className="flex-1" onClick={() => irPara(idx + 1)}>
              Próxima
            </Button>
          ) : !modoProva ? (
            <Button className="flex-1" onClick={finalizar}>
              Ver resultado
            </Button>
          ) : null}

          {/* Entregar fica sempre à mão no modo prova: na real, ninguém precisa
              chegar à última questão para encerrar. */}
          {modoProva && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button className={cn(idx === lista.length - 1 && "flex-1")} variant="default">
                  Entregar prova
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Entregar e corrigir?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {respondidasNaSessao} de {lista.length} respondidas
                    {respondidasNaSessao < lista.length
                      ? ` — ${lista.length - respondidasNaSessao} em branco. Em prova, branco não pontua; se a prova desconta erro, branco também não desconta.`
                      : "."}{" "}
                    Depois da entrega não dá para mudar resposta.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Voltar à prova</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      salvarRascunhoNaSessao();
                      finalizar();
                    }}
                  >
                    Entregar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- resultado
  if (!resultado) {
    if (etapa === "resultado") setTimeout(() => setEtapa("config"), 0);
    return null;
  }

  const { questoes: listaFinal, respostas, tempos } = resultado;
  const acertos = listaFinal.filter((q) => respostas[q.id] === q.correta).length;
  const emBranco = listaFinal.filter((q) => !respostas[q.id]).length;
  const pct = Math.round((acertos / listaFinal.length) * 100);
  const tempoMin = Math.max(
    1,
    Math.round((Date.now() - new Date(resultado.iniciadoEm).getTime()) / 60000),
  );
  const ritmo = resumoDeRitmo(Object.values(tempos));

  // Prova com desconto: cada erro anula um acerto. Mostrar só "X de Y corretas"
  // numa prova dessas esconde a nota real — quem acerta 6 e erra 4 de 10 não fez
  // 60%, fez 2 pontos líquidos.
  const comDesconto = listaFinal.some((q) => q.pontuacaoLiquida);
  const erros = listaFinal.filter((q) => respostas[q.id] && respostas[q.id] !== q.correta).length;
  const liquido = acertos - erros;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Resultado</p>
          <p className="text-5xl font-black text-primary">{pct}%</p>
          <p className="text-sm">
            {acertos} de {listaFinal.length} corretas
            {emBranco > 0 && ` · ${emBranco} em branco`} · {tempoMin} min
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
        {listaFinal.map((q, i) => (
          <QuestaoDoResultado
            key={q.id}
            questao={q}
            numero={i + 1}
            escolhida={respostas[q.id]}
            segundos={tempos[q.id]}
            disciplinaNome={disciplinas.find((d) => d.id === q.disciplinaId)?.nome ?? q.disciplinaId}
            historico={historico}
            concursoId={concursoAtivoId}
            // Erro aberto por padrão só em simulado curto: numa prova de 70, abrir
            // tudo vira um paredão de texto que ninguém revisa.
            abertaPorPadrao={respostas[q.id] !== q.correta && listaFinal.length <= 10}
          />
        ))}
      </div>

      <Button
        className="w-full"
        onClick={() => {
          setResultado(null);
          setEtapa("config");
        }}
      >
        Novo simulado
      </Button>
    </div>
  );
}

/**
 * Uma questão na tela de resultado (ADR-002).
 *
 * Expansível porque o momento de maior abertura para aprender é logo depois de
 * errar — e a tela mostrava só "Sua: B · Correta: D", obrigando a reencontrar a
 * questão em outro simulado para rever a explicação. Aberta, mostra as
 * alternativas, o raciocínio escrito na hora e o gabarito comentado (que também
 * pode ser gerado dali mesmo, pelo fluxo de prompt). No modo prova, é aqui que a
 * autoavaliação do raciocínio acontece — durante a sessão não havia gabarito
 * para conferir.
 */
function QuestaoDoResultado({
  questao: q,
  numero,
  escolhida,
  segundos,
  disciplinaNome,
  historico,
  concursoId,
  abertaPorPadrao,
}: {
  questao: Questao;
  numero: number;
  escolhida: string | undefined;
  segundos: number | undefined;
  disciplinaNome: string;
  historico: RespostaHistorico[];
  concursoId: string;
  abertaPorPadrao: boolean;
}) {
  const [aberta, setAberta] = useState(abertaPorPadrao);
  const avaliarRaciocinio = useStore((s) => s.avaliarRaciocinio);
  const correta = escolhida === q.correta;

  // A resposta gravada, para reexibir o raciocínio e a autoavaliação: é o
  // material que transforma "errei" em "errei porque pensei X".
  let registro: RespostaHistorico | undefined;
  for (let i = historico.length - 1; i >= 0; i--) {
    if (historico[i].questaoId === q.id && historico[i].concursoId === concursoId) {
      registro = historico[i];
      break;
    }
  }

  return (
    <Card className={cn(aberta && "ring-1 ring-primary/20")}>
      <button
        onClick={() => setAberta(!aberta)}
        className="w-full p-4 text-left transition-colors hover:bg-muted/40"
      >
        <div className="flex items-center gap-2">
          <Badge variant={correta ? "default" : "destructive"}>{numero}</Badge>
          <p className="text-xs text-muted-foreground">
            Sua: {escolhida || "—"} · Correta: {q.correta}
            {segundos !== undefined && ` · ${formatarDuracao(segundos)}`}
          </p>
          <span className="ml-auto text-xs text-muted-foreground">
            {aberta ? "fechar" : "ver gabarito"}
          </span>
        </div>
        <TextoDaQuestao className={cn("mt-2 block text-sm", !aberta && "line-clamp-2")}>
          {q.enunciado}
        </TextoDaQuestao>
      </button>

      {aberta && (
        <CardContent className="space-y-4 border-t border-border p-4">
          {q.tipo !== "certo_errado" && q.alternativas.length > 0 && (
            <div className="space-y-1.5">
              {q.alternativas.map((a) => (
                <div
                  key={a.letra}
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2 text-sm",
                    a.letra === q.correta && "border-sucesso bg-sucesso-suave",
                    a.letra === escolhida &&
                      a.letra !== q.correta &&
                      "border-destructive bg-destructive/10",
                    a.letra !== q.correta && a.letra !== escolhida && "border-transparent opacity-70",
                  )}
                >
                  <span className="font-black text-primary">{a.letra}</span>
                  <TextoDaQuestao className="flex-1 text-sm">{a.texto}</TextoDaQuestao>
                </div>
              ))}
            </div>
          )}

          {registro?.raciocinio && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">
                O que você pensou na hora:
              </p>
              <p className="rounded bg-muted/60 p-2 text-xs italic text-muted-foreground">
                “{registro.raciocinio}”
              </p>
              {/* Correção no fim: a autoavaliação acontece aqui, com o gabarito
                  na frente — durante a prova não havia com o que comparar. */}
              {!registro.autoavaliacao && (
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
                      variant="outline"
                      onClick={() => avaliarRaciocinio(q.id, concursoId, nota)}
                    >
                      {rotulo}
                    </Button>
                  ))}
                </div>
              )}
              {registro.autoavaliacao && (
                <p className="text-xs text-muted-foreground">
                  Sua avaliação:{" "}
                  <strong>
                    {registro.autoavaliacao === "bateu"
                      ? "raciocínio bateu"
                      : registro.autoavaliacao === "torto"
                        ? "caminho errado"
                        : "chute"}
                  </strong>
                </p>
              )}
            </div>
          )}

          <div className="rounded-lg bg-muted p-4">
            <GabaritoComentado questao={q} disciplinaNome={disciplinaNome} />
          </div>
        </CardContent>
      )}
    </Card>
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
