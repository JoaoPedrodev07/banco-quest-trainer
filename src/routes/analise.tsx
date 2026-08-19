import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Info, TriangleAlert } from "lucide-react";

import { AvisoAcervo } from "@/components/AvisoAcervo";
import { useAcervoDoConcurso } from "@/services/hooks";
import { SemAcervo } from "@/components/SemAcervo";
import { AnaliseAvancada } from "@/components/AnaliseAvancada";
import { NotaDeCorte } from "@/components/NotaDeCorte";
import { useStore } from "@/store/useStore";
import { aplicacoesDistintas, disciplinasDoCargo, incidencia } from "@/lib/incidencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/analise")({
  head: () => ({
    meta: [
      { title: "Análise de incidência — Foco BB TI 2026" },
      {
        name: "description",
        content: "Quanto cada assunto do edital caiu nas provas anteriores.",
      },
    ],
  }),
  component: AnalisePage,
});

function AnalisePage() {
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const { concurso, disciplinas, questoes, provas, carregando, vazio } =
    useAcervoDoConcurso(concursoAtivoId);
  const historico = useStore((s) => s.historico);
  const [abertas, setAbertas] = useState<Record<string, boolean>>({});

  const escopo = useMemo(
    () => (concurso ? disciplinasDoCargo(concurso, provas, questoes) : new Set<string>()),
    [concurso, provas, questoes],
  );
  const dados = useMemo(
    () => incidencia(disciplinas, questoes, escopo),
    [disciplinas, questoes, escopo],
  );

  const totalNoEscopo = dados.reduce((a, d) => a + d.total, 0);
  const classificadasNoEscopo = dados.reduce((a, d) => a + d.classificadas, 0);
  const cobertura = totalNoEscopo ? Math.round((classificadasNoEscopo / totalNoEscopo) * 100) : 0;
  const aplicacoes = aplicacoesDistintas(questoes, escopo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black md:text-3xl">Análise de incidência</h1>
        <p className="text-sm text-muted-foreground">
          Quanto cada assunto do edital caiu nas provas anteriores
          {concurso ? ` de ${concurso.cargo}` : ""}.
        </p>
      </div>

      <AvisoAcervo />

      {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}

      {/* A ressalva vem ANTES dos números, não em rodapé. Com uma aplicação de
          prova, a diferença entre o 1º e o 2º lugar da lista é ruído, e quem lê
          precisa saber disso antes de decidir o que estudar. */}
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="space-y-1 text-muted-foreground">
          <p>
            {aplicacoes <= 1 ? (
              <>
                Isto se apoia em <strong>uma única aplicação de prova</strong>. Descreve o que caiu
                naquele ano — <strong>não prevê</strong> o que vai cair. Diferenças pequenas entre
                dois assuntos são ruído, não tendência.
              </>
            ) : (
              <>
                Baseado em <strong>{aplicacoes} aplicações</strong> de prova. Ainda é amostra
                pequena: trate a ordem como indício, não como certeza.
              </>
            )}
          </p>
          {cobertura < 100 && (
            <p>
              <strong>
                {classificadasNoEscopo} de {totalNoEscopo}
              </strong>{" "}
              questões estão classificadas por assunto ({cobertura}%). As não classificadas não
              aparecem em nenhum tópico abaixo — os números são um piso.
            </p>
          )}
        </div>
      </div>

      {escopo.size === 0 && !carregando && (
        <p className="flex items-start gap-2 rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Nenhuma prova do cargo <strong>{concurso?.cargo}</strong> foi importada, então não dá
            para separar as disciplinas que ele cobra das de outros cargos. A lista abaixo mostra o
            acervo inteiro, e pode incluir disciplina que não está no seu edital.
          </span>
        </p>
      )}

      {carregando && <p className="text-sm text-muted-foreground">Carregando o acervo…</p>}

      {/* O piso do edital vem antes de qualquer análise do acervo: em 2023 o
          corte da MR 158 ficou colado nele, então é o número que decide. */}
      <NotaDeCorte historico={historico.filter((h) => h.concursoId === concursoAtivoId)} />

      {!vazio && !carregando && (
        <AnaliseAvancada
          disciplinas={disciplinas}
          questoes={questoes}
          historico={historico}
          provas={provas}
        />
      )}

      <div className="space-y-3">
        {dados.map((d) => {
          const aberta = abertas[d.disciplina.id] ?? false;
          const semTopico = d.disciplina.topicos.length - d.topicos.length;
          return (
            <Card key={d.disciplina.id}>
              <button
                onClick={() => setAbertas((a) => ({ ...a, [d.disciplina.id]: !aberta }))}
                className="flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-muted/40"
              >
                {aberta ? (
                  <ChevronDown className="h-4 w-4 shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold" style={{ color: d.disciplina.cor }}>
                    {d.disciplina.nome}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.total} {d.total === 1 ? "questão" : "questões"} no acervo
                    {d.naoClassificadas > 0 && ` · ${d.naoClassificadas} sem classificar`}
                  </p>
                </div>
                <Badge variant="secondary" className="shrink-0">
                  {d.classificadas} classificadas
                </Badge>
              </button>

              {aberta && (
                <div className="space-y-2 border-t border-border p-4">
                  {d.topicos.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma questão desta disciplina foi classificada por assunto ainda.
                    </p>
                  )}
                  {d.topicos.map((t) => (
                    <div key={t.topicoId} className="space-y-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="min-w-0 flex-1 truncate text-sm">{t.nome}</p>
                        <p className="shrink-0 text-xs font-semibold tabular-nums">
                          {t.questoes} {t.questoes === 1 ? "questão" : "questões"}
                          {/* A faixa vem junto do número porque o número sozinho
                              sugere precisão que duas aplicações não sustentam. */}
                          <span className="ml-1 font-normal text-muted-foreground">
                            (~{t.faixa.minEsperado}–{t.faixa.maxEsperado} numa prova de 70)
                          </span>
                        </p>
                      </div>
                      <Progress value={t.fatia} className="h-1.5" />
                    </div>
                  ))}

                  {semTopico > 0 && (
                    <p className="border-t border-border pt-2 text-xs text-muted-foreground">
                      Outros <strong>{semTopico}</strong> tópicos desta disciplina não tiveram
                      nenhuma questão no acervo. Estão no edital e podem cair — ausência aqui não é
                      evidência de que não caem.
                    </p>
                  )}

                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link to="/edital">Ver no edital</Link>
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
