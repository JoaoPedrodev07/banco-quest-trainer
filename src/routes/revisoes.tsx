import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Layers, ListChecks, Sparkles, Youtube } from "lucide-react";
import { toast } from "sonner";

import { concursoPorId } from "@/data/concursos";
import { useAcervoDoConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { desempenhoPorUnidade } from "@/lib/desempenho";
import { linkYouTube } from "@/lib/promptEstudo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/revisoes")({
  head: () => ({
    meta: [
      { title: "Revisões espaçadas — Foco BB TI 2026" },
      { name: "description", content: "Revisão espaçada dos tópicos: 1, 7, 15, 30 dias." },
      { property: "og:title", content: "Revisões" },
      { property: "og:description", content: "Nunca mais esqueça o que já estudou." },
    ],
  }),
  component: RevisoesPage,
});

function RevisoesPage() {
  const { revisoes, marcarRevisada, concursoAtivoId, historico } = useStore();
  const { disciplinas, questoes } = useAcervoDoConcurso(concursoAtivoId);
  const concurso = concursoPorId(concursoAtivoId);
  const [aberta, setAberta] = useState<string | null>(null);

  const doConcurso = revisoes.filter((r) => r.concursoId === concursoAtivoId);
  const ordenadas = [...doConcurso].sort(
    (a, b) => new Date(a.proximaRevisao).getTime() - new Date(b.proximaRevisao).getTime(),
  );

  const desempenho = useMemo(
    () => desempenhoPorUnidade(historico, questoes, concursoAtivoId),
    [historico, questoes, concursoAtivoId],
  );

  /** Nome oficial da unidade no edital, para a revisão não ficar presa ao texto salvo. */
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

  const atrasadas = ordenadas.filter((r) => new Date(r.proximaRevisao).getTime() < Date.now());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Revisões</h1>
        <p className="text-sm text-muted-foreground">
          Intervalos de 1, 7, 15 e 30 dias. Clique numa revisão para ver o que estudar.
        </p>
      </div>

      {atrasadas.length > 0 && (
        <p className="rounded-md border border-atencao/40 bg-atencao-suave p-3 text-sm text-atencao-foreground">
          <strong>{atrasadas.length}</strong>{" "}
          {atrasadas.length === 1 ? "revisão atrasada" : "revisões atrasadas"}. Revisão atrasada é a
          que mais rende: o esquecimento já começou, e é exatamente aí que a repetição fixa.
        </p>
      )}

      <div className="space-y-3">
        {ordenadas.map((r) => {
          const d = disciplinas.find((x) => x.id === r.disciplinaId);
          const data = new Date(r.proximaRevisao);
          const atrasada = data.getTime() < Date.now();
          const dias = Math.round((data.getTime() - Date.now()) / 86400000);
          const expandida = aberta === r.id;

          // O nome do edital manda sobre o texto gravado: a revisão pode ter sido
          // criada com um rótulo antigo, e o edital é a fonte.
          const nome = (r.unidadeId && nomeDaUnidade.get(r.unidadeId)) || r.topico;
          const daUnidade = r.unidadeId
            ? desempenho.find((x) => x.unidadeId === r.unidadeId)
            : null;
          const questoesDaUnidade = r.unidadeId
            ? questoes.filter((q) => (q.subtopicoId ?? q.topicoId) === r.unidadeId)
            : [];

          return (
            <Card
              key={r.id}
              className={cn(
                "transition-all duration-150",
                atrasada && "border-atencao/50",
                expandida && "ring-1 ring-primary/30",
              )}
            >
              <button
                onClick={() => setAberta(expandida ? null : r.id)}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
              >
                {expandida ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate font-bold">{nome}</p>
                    {atrasada && <Badge variant="destructive">Atrasada</Badge>}
                    <Badge variant="secondary">{r.intervaloAtual}d</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {d?.nome ?? r.disciplinaId} ·{" "}
                    {atrasada ? `atrasada há ${Math.abs(dias)} dia(s)` : `em ${dias} dia(s)`}
                    {daUnidade && ` · ${daUnidade.taxa}% de acerto seu`}
                  </p>
                </div>
              </button>

              {expandida && (
                <div className="space-y-3 border-t border-border p-4">
                  {r.unidadeId ? (
                    <p className="text-sm text-muted-foreground">
                      {questoesDaUnidade.length > 0 ? (
                        <>
                          <strong className="text-foreground">{questoesDaUnidade.length}</strong>{" "}
                          {questoesDaUnidade.length === 1 ? "questão" : "questões"} deste assunto no
                          acervo
                          {daUnidade &&
                            ` · você respondeu ${daUnidade.respondidas} e acertou ${daUnidade.acertos}`}
                          .
                        </>
                      ) : (
                        "Nenhuma questão deste assunto classificada ainda — o treino por questão fica limitado."
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Esta revisão foi criada antes de as revisões apontarem para o edital, então
                      não tem assunto ligado. As novas, agendadas quando você erra, já vêm com o
                      tópico.
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {/* Levam ao assunto **desta** revisão, não à tela genérica: o
                        candidato acabou de errar isto, e obrigá-lo a procurar de
                        novo na lista inteira é perder o motivo de o botão existir.
                        Revisão antiga, sem `unidadeId`, cai na tela sem filtro —
                        é o melhor que dá, e continua melhor que nada. */}
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/edital" search={r.unidadeId ? { unidade: r.unidadeId } : {}}>
                        <Sparkles className="h-3.5 w-3.5" />
                        Ver aula
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/flashcards">
                        <Layers className="h-3.5 w-3.5" />
                        Flashcards
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/questoes" search={r.unidadeId ? { assunto: r.unidadeId } : {}}>
                        <ListChecks className="h-3.5 w-3.5" />
                        Praticar
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <a
                        href={linkYouTube(nome, d?.nome ?? "", concurso?.banca ?? null)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Youtube className="h-3.5 w-3.5" />
                        Vídeos
                      </a>
                    </Button>
                  </div>

                  <Button
                    size="sm"
                    onClick={() => {
                      marcarRevisada(r.id);
                      setAberta(null);
                      toast.success("Revisão concluída", {
                        description: "Reagendada para o próximo intervalo.",
                      });
                    }}
                  >
                    Revisado hoje
                  </Button>
                </div>
              )}
            </Card>
          );
        })}

        {ordenadas.length === 0 && (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma revisão agendada. Elas aparecem sozinhas quando você erra uma questão — o erro é
            o sinal de que o assunto ainda não fixou.
          </p>
        )}
      </div>
    </div>
  );
}
