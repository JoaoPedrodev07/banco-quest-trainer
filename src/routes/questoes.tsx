import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AvisoAcervo } from "@/components/AvisoAcervo";
import { GabaritoComentado } from "@/components/GabaritoComentado";
import { TextoDaQuestao } from "@/components/Markdown";
import { useDisciplinas, useQuestoes } from "@/services/hooks";
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
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Questao } from "@/types";

export const Route = createFileRoute("/questoes")({
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
  const [lista, setLista] = useState<Questao[]>([]);
  const [idx, setIdx] = useState(0);
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [inicio, setInicio] = useState(0);

  const { historico, registrarResposta, concursoAtivoId } = useStore();
  const { disciplinas } = useDisciplinas();
  const { questoes: allQuestoes, carregando } = useQuestoes();

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

  // Anos oferecidos no filtro saem do próprio acervo: uma lista fixa mostraria
  // ano sem questão nenhuma e esconderia prova recém-importada.
  const anos = useMemo(
    () => Array.from(new Set(allQuestoes.map((q) => q.ano))).sort((a, b) => b - a),
    [allQuestoes],
  );

  const iniciar = () => {
    const errouIds = new Set(historico.filter((h) => !h.correta).map((h) => h.questaoId));
    let filtradas = allQuestoes.filter(
      (q) =>
        selecionadas.includes(q.disciplinaId) &&
        (ano === "todos" || q.ano === Number(ano)) &&
        (!somenteErrei || errouIds.has(q.id)) &&
        // Anulada não tem gabarito: entraria no simulado como erro garantido.
        !q.anulada,
    );
    filtradas = filtradas.sort(() => Math.random() - 0.5).slice(0, qtd);
    if (filtradas.length === 0) return;
    setLista(filtradas);
    setRespostas({});
    setIdx(0);
    setInicio(Date.now());
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

        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={somenteErrei} onCheckedChange={(v) => setSomenteErrei(!!v)} />
          <span className="text-sm">Somente questões que errei</span>
        </label>

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

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">
            Questão {idx + 1} de {lista.length}
          </Badge>
          <Badge>{disciplinas.find((d) => d.id === q.disciplinaId)?.nome}</Badge>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <p className="text-sm text-muted-foreground">
              {q.banca} · {q.ano}
              {q.numeroNaProva ? ` · questão ${q.numeroNaProva}` : ""}
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
            <div className="space-y-2">
              {q.alternativas.map((a) => {
                const isChosen = escolhida === a.letra;
                const isCorreta = a.letra === q.correta;
                const showResult = respondida;
                return (
                  <button
                    key={a.letra}
                    disabled={respondida}
                    onClick={() => setRespostas((r) => ({ ...r, [q.id]: a.letra }))}
                    className={cn(
                      "w-full text-left rounded-lg border p-3 flex gap-3 items-start transition-colors",
                      !showResult && "hover:bg-accent",
                      showResult && isCorreta && "border-green-500 bg-green-50 dark:bg-green-950",
                      showResult &&
                        isChosen &&
                        !isCorreta &&
                        "border-red-500 bg-red-50 dark:bg-red-950",
                      !showResult && isChosen && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="font-black text-primary">{a.letra}</span>
                    <TextoDaQuestao className="text-sm flex-1">{a.texto}</TextoDaQuestao>
                    {showResult && isCorreta && (
                      <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                    )}
                    {showResult && isChosen && !isCorreta && (
                      <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {!respondida && (
              <Button
                className="w-full"
                disabled={!escolhida}
                onClick={() => {
                  registrarResposta({
                    questaoId: q.id,
                    disciplinaId: q.disciplinaId,
                    concursoId: concursoAtivoId,
                    escolhida: escolhida!,
                    correta: escolhida === q.correta,
                    data: new Date().toISOString(),
                  });
                  setRespostas({ ...respostas });
                }}
              >
                Responder
              </Button>
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
          <Button variant="outline" disabled={idx === 0} onClick={() => setIdx(idx - 1)}>
            Anterior
          </Button>
          {idx < lista.length - 1 ? (
            <Button className="flex-1" onClick={() => setIdx(idx + 1)}>
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

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">Resultado</p>
          <p className="text-5xl font-black text-primary">{pct}%</p>
          <p className="text-sm">
            {acertos} de {lista.length} corretas · {tempoMin} min
          </p>
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
