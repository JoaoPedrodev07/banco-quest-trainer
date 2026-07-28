import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, Layers, Timer, Youtube } from "lucide-react";

import { AvisoAcervo } from "@/components/AvisoAcervo";
import { SemAcervo } from "@/components/SemAcervo";
import { concursoPorId } from "@/data/concursos";
import { useAcervoDoConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { montarPlano } from "@/lib/planoEstudos";
import { disciplinasDoCargo } from "@/lib/incidencia";
import { linkYouTube } from "@/lib/promptEstudo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/plano")({
  head: () => ({
    meta: [
      { title: "Plano de estudos — Foco BB TI 2026" },
      {
        name: "description",
        content: "Semana de estudos montada pelo que mais cai e pelo que você mais erra.",
      },
    ],
  }),
  component: PlanoPage,
});

function PlanoPage() {
  const { concursoAtivoId, historico } = useStore();
  const concurso = concursoPorId(concursoAtivoId);
  const { disciplinas, questoes, provas, vazio, carregando } = useAcervoDoConcurso(concursoAtivoId);

  // As provas de outro cargo do mesmo concurso entram no acervo pelos
  // Conhecimentos Básicos, e trazem junto as disciplinas exclusivas delas
  // (Informática, Vendas, Matemática Financeira). Sem este recorte o plano
  // mandaria estudar matéria que não está no edital deste cargo.
  const escopo = useMemo(
    () => (concurso ? disciplinasDoCargo(concurso, provas, questoes) : new Set<string>()),
    [concurso, provas, questoes],
  );
  const doCargo = useMemo(
    () => (escopo.size ? disciplinas.filter((d) => escopo.has(d.id)) : disciplinas),
    [disciplinas, escopo],
  );

  const plano = useMemo(
    () => montarPlano(doCargo, questoes, historico, concursoAtivoId),
    [doCargo, questoes, historico, concursoAtivoId],
  );

  const hoje = new Date().getDay();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Plano de estudos</h1>
        <p className="text-sm text-muted-foreground">
          Montado sozinho pelo que mais cai na prova e pelo que você mais erra.
        </p>
      </div>

      <AvisoAcervo />

      {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}
      {carregando && <p className="text-sm text-muted-foreground">Montando o plano…</p>}

      {!vazio && !carregando && (
        <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          As matérias não têm o mesmo espaço de propósito. Um dia para cada disciplina trataria
          Estatística, que vale 5 questões, como Tecnologia da Informação, que vale 35 — e você
          gastaria a semana no lugar errado. Cada bloco mostra por que entrou.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {plano.map((dia) => (
          <Card
            key={dia.indice}
            className={cn(
              "transition-all duration-150",
              dia.indice === hoje && "border-primary ring-1 ring-primary/30",
              !dia.descanso && "hover:-translate-y-px hover:shadow-md",
            )}
          >
            <CardContent className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 font-bold">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  {dia.nome}
                </p>
                {dia.indice === hoje && <Badge>hoje</Badge>}
              </div>

              {dia.descanso ? (
                <p className="text-sm text-muted-foreground">
                  Descanso. Estudar sete dias por semana é como se abandona um plano na terceira
                  semana.
                </p>
              ) : dia.blocos.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem bloco definido.</p>
              ) : (
                dia.blocos.map((bloco, i) => (
                  <div
                    key={`${bloco.disciplina.id}-${i}`}
                    className="space-y-2 rounded-lg border border-border p-3"
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: bloco.disciplina.cor }}>
                        {bloco.disciplina.nome}
                      </p>
                      {bloco.topicoNome && (
                        <p className="text-sm leading-snug">{bloco.topicoNome}</p>
                      )}
                      <p className="mt-1 text-xs text-muted-foreground">{bloco.motivo}</p>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Link to="/flashcards">
                          <Layers className="h-3.5 w-3.5" />
                          Flashcards
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <Link to="/edital">
                          <Timer className="h-3.5 w-3.5" />
                          Aula
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 px-2 text-xs"
                      >
                        <a
                          href={linkYouTube(
                            bloco.topicoNome ?? bloco.disciplina.nome,
                            bloco.disciplina.nome,
                            concurso?.banca ?? null,
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Youtube className="h-3.5 w-3.5" />
                          Vídeos
                        </a>
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
