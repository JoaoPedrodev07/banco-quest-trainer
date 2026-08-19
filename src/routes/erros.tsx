import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ListChecks } from "lucide-react";

import { AnotacaoDaQuestao } from "@/components/AnotacaoDaQuestao";
import { AvisoAcervo } from "@/components/AvisoAcervo";
import { GabaritoComentado } from "@/components/GabaritoComentado";
import { ReportarProblema } from "@/components/ReportarProblema";
import { TextoDaQuestao } from "@/components/Markdown";
import { useAcervoDoConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type { Questao, RespostaHistorico } from "@/types";

export const Route = createFileRoute("/erros")({
  head: () => ({
    meta: [
      { title: "Caderno de erros — Foco BB TI 2026" },
      {
        name: "description",
        content: "Suas questões erradas com o raciocínio que você escreveu e o gabarito comentado.",
      },
    ],
  }),
  component: ErrosPage,
});

/**
 * Caderno de erros (ADR-001).
 *
 * 100% derivado do histórico na leitura (§2.3): nenhum estado novo. Entra a
 * questão cuja **última** resposta foi errada — a última, não qualquer uma,
 * porque quem errou em março e acertou em julho superou o erro, e mantê-lo aqui
 * puniria o progresso. A aba "torto" pega o caso que nenhuma plataforma grande
 * enxerga: acertou, mas o próprio candidato declarou que chegou pelo caminho
 * errado — e isso volta a errar na prova.
 */
function ErrosPage() {
  const { historico, concursoAtivoId } = useStore();
  const { disciplinas, questoes, vazio } = useAcervoDoConcurso(concursoAtivoId);
  const [disciplinaId, setDisciplinaId] = useState("todas");
  const [aberta, setAberta] = useState<string | null>(null);

  // A última resposta de cada questão neste concurso. O array do histórico é
  // cronológico, então a varredura simples deixa a mais recente por último.
  const ultimaPorQuestao = useMemo(() => {
    const mapa = new Map<string, RespostaHistorico>();
    for (const h of historico) {
      if (h.concursoId === concursoAtivoId) mapa.set(h.questaoId, h);
    }
    return mapa;
  }, [historico, concursoAtivoId]);

  const questaoPorId = useMemo(() => new Map(questoes.map((q) => [q.id, q])), [questoes]);

  const { errados, tortos } = useMemo(() => {
    const errados: { questao: Questao; resposta: RespostaHistorico }[] = [];
    const tortos: { questao: Questao; resposta: RespostaHistorico }[] = [];
    for (const [questaoId, resposta] of ultimaPorQuestao) {
      // Questão que saiu do acervo (ou de outro cargo) não tem o que reestudar
      // por aqui — mesma tolerância de `desempenhoPorUnidade`.
      const questao = questaoPorId.get(questaoId);
      if (!questao) continue;
      if (disciplinaId !== "todas" && questao.disciplinaId !== disciplinaId) continue;
      if (!resposta.correta) errados.push({ questao, resposta });
      else if (resposta.autoavaliacao === "torto") tortos.push({ questao, resposta });
    }
    const maisRecentePrimeiro = (
      a: { resposta: RespostaHistorico },
      b: { resposta: RespostaHistorico },
    ) => b.resposta.data.localeCompare(a.resposta.data);
    return { errados: errados.sort(maisRecentePrimeiro), tortos: tortos.sort(maisRecentePrimeiro) };
  }, [ultimaPorQuestao, questaoPorId, disciplinaId]);

  const disciplinasComRegistro = useMemo(() => {
    const ids = new Set<string>();
    for (const [questaoId, resposta] of ultimaPorQuestao) {
      const q = questaoPorId.get(questaoId);
      if (q && (!resposta.correta || resposta.autoavaliacao === "torto")) ids.add(q.disciplinaId);
    }
    return disciplinas.filter((d) => ids.has(d.id));
  }, [ultimaPorQuestao, questaoPorId, disciplinas]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Caderno de erros</h1>
        <p className="text-sm text-muted-foreground">
          Cada erro com o raciocínio que você escreveu na hora. Reler o próprio erro comentado rende
          mais que dez questões novas. Acertou a questão de novo? Ela sai daqui sozinha.
        </p>
      </div>

      <AvisoAcervo />

      {!vazio && disciplinasComRegistro.length > 0 && (
        <Select value={disciplinaId} onValueChange={setDisciplinaId}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as disciplinas</SelectItem>
            {disciplinasComRegistro.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Tabs defaultValue="errados">
        <TabsList>
          <TabsTrigger value="errados">Errei ({errados.length})</TabsTrigger>
          <TabsTrigger value="tortos">Acertei torto ({tortos.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="errados" className="space-y-3 pt-2">
          {errados.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nenhum erro pendente neste recorte. Ou você ainda não respondeu questões, ou já refez
              e acertou as que errou — os dois casos são o caderno funcionando.
            </p>
          )}
          {errados.map((item) => (
            <ItemDoCaderno
              key={item.questao.id}
              questao={item.questao}
              resposta={item.resposta}
              disciplinaNome={
                disciplinas.find((d) => d.id === item.questao.disciplinaId)?.nome ??
                item.questao.disciplinaId
              }
              aberta={aberta === item.questao.id}
              onToggle={() => setAberta(aberta === item.questao.id ? null : item.questao.id)}
            />
          ))}
        </TabsContent>

        <TabsContent value="tortos" className="space-y-3 pt-2">
          <p className="text-sm text-muted-foreground">
            Acertos em que você mesmo declarou ter chegado por eliminação ou caminho errado. Na
            prova, essa sorte não se repete — é a fila de teoria mais honesta que existe.
          </p>
          {tortos.length === 0 && (
            <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Nada aqui. Este espaço lista acertos que você avaliou como “cheguei por caminho
              errado” depois de ver o gabarito.
            </p>
          )}
          {tortos.map((item) => (
            <ItemDoCaderno
              key={item.questao.id}
              questao={item.questao}
              resposta={item.resposta}
              disciplinaNome={
                disciplinas.find((d) => d.id === item.questao.disciplinaId)?.nome ??
                item.questao.disciplinaId
              }
              aberta={aberta === item.questao.id}
              onToggle={() => setAberta(aberta === item.questao.id ? null : item.questao.id)}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Rótulo humano da alternativa — em certo/errado, "C" é "Certo", não a letra C. */
function rotuloAlternativa(questao: Questao, letra: string): string {
  if (!letra) return "—";
  if (questao.tipo === "certo_errado") return letra === "C" ? "Certo" : "Errado";
  return letra;
}

const ROTULO_AVALIACAO = {
  bateu: "raciocínio bateu",
  torto: "caminho errado",
  chutei: "chute",
} as const;

function ItemDoCaderno({
  questao,
  resposta,
  disciplinaNome,
  aberta,
  onToggle,
}: {
  questao: Questao;
  resposta: RespostaHistorico;
  disciplinaNome: string;
  aberta: boolean;
  onToggle: () => void;
}) {
  const unidadeId = questao.subtopicoId ?? questao.topicoId;
  const data = resposta.data.slice(0, 10).split("-").reverse().join("/");

  return (
    <Card className={cn("transition-all duration-150", aberta && "ring-1 ring-primary/30")}>
      <button
        onClick={onToggle}
        className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-muted/40"
      >
        {aberta ? (
          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{disciplinaNome}</Badge>
            <span>
              {questao.banca} · {questao.ano} · {data}
            </span>
            <span>
              Sua: <strong>{rotuloAlternativa(questao, resposta.escolhida)}</strong> · Correta:{" "}
              <strong>{rotuloAlternativa(questao, questao.correta)}</strong>
            </span>
            {resposta.autoavaliacao && (
              <Badge variant="outline">{ROTULO_AVALIACAO[resposta.autoavaliacao]}</Badge>
            )}
          </div>
          <TextoDaQuestao
            className={cn("block text-sm leading-relaxed", !aberta && "line-clamp-2")}
          >
            {questao.enunciado}
          </TextoDaQuestao>
        </div>
      </button>

      {aberta && (
        <CardContent className="space-y-4 border-t border-border p-4">
          {questao.tipo !== "certo_errado" && questao.alternativas.length > 0 && (
            <div className="space-y-1.5">
              {questao.alternativas.map((a) => (
                <div
                  key={a.letra}
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2 text-sm",
                    a.letra === questao.correta && "border-sucesso bg-sucesso-suave",
                    a.letra === resposta.escolhida &&
                      a.letra !== questao.correta &&
                      "border-destructive bg-destructive/10",
                    a.letra !== questao.correta &&
                      a.letra !== resposta.escolhida &&
                      "border-transparent opacity-70",
                  )}
                >
                  <span className="font-black text-primary">{a.letra}</span>
                  <TextoDaQuestao className="flex-1 text-sm">{a.texto}</TextoDaQuestao>
                </div>
              ))}
            </div>
          )}

          {resposta.raciocinio && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground">
                O que você pensou na hora:
              </p>
              <p className="rounded bg-muted/60 p-2 text-xs italic text-muted-foreground">
                “{resposta.raciocinio}”
              </p>
            </div>
          )}

          <div className="rounded-lg bg-muted p-4">
            <GabaritoComentado questao={questao} disciplinaNome={disciplinaNome} />
          </div>

          <AnotacaoDaQuestao questaoId={questao.id} />

          <div className="flex justify-end">
            <ReportarProblema questaoId={questao.id} />
          </div>

          {unidadeId && (
            <Button asChild size="sm" variant="outline" className="gap-1.5">
              <Link to="/questoes" search={{ assunto: unidadeId }}>
                <ListChecks className="h-3.5 w-3.5" />
                Praticar este assunto
              </Link>
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}
