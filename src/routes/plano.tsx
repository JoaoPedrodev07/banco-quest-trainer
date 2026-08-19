import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { CalendarDays, Layers, Timer, Youtube } from "lucide-react";

import { AvisoAcervo } from "@/components/AvisoAcervo";
import { SemAcervo } from "@/components/SemAcervo";
import { concursoPorId } from "@/data/concursos";
import { useAcervoDoConcurso } from "@/services/hooks";
import { useStore, CONCURSO_PADRAO } from "@/store/useStore";
import { montarPlano } from "@/lib/planoEstudos";
import { montarTrilha, FASES, RITMO_ALTO } from "@/lib/trilha";
import { desempenhoPorUnidade } from "@/lib/desempenho";
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
  const { concursoAtivoId, historico, revisoes, editalStatus, dataProva } = useStore();
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

  // Trilha até a prova (ADR-009). A data segue a mesma regra do dashboard: a do
  // concurso quando publicada; a estimativa do usuário só no concurso padrão; e
  // sem nenhuma das duas, a trilha não conta dias.
  const dataEfetiva = concurso?.dataProva ?? (concurso?.id === CONCURSO_PADRAO ? dataProva : null);
  const dataEstimada = !!dataEfetiva && !concurso?.dataProva;
  const trilha = useMemo(() => {
    const unidadesTotais = doCargo.reduce(
      (acc, d) => acc + d.topicos.reduce((a, t) => a + Math.max(1, t.subtopicos.length), 0),
      0,
    );
    // "Coberta" = checkbox de teoria marcado; "treinada" = ≥3 respostas na
    // unidade. Réguas deliberadamente simples — são as que o app já usa.
    const unidadesDoCargo = new Set<string>();
    for (const d of doCargo) {
      for (const t of d.topicos) {
        if (t.subtopicos.length === 0) unidadesDoCargo.add(t.id);
        for (const s of t.subtopicos) unidadesDoCargo.add(s.id);
      }
    }
    const unidadesCobertas = Object.entries(editalStatus).filter(
      ([id, st]) => st.teoria && unidadesDoCargo.has(id),
    ).length;
    const unidadesTreinadas = desempenhoPorUnidade(historico, questoes, concursoAtivoId).filter(
      (d) => d.respondidas >= 3,
    ).length;
    return montarTrilha({
      dataProva: dataEfetiva,
      agora: new Date(),
      unidadesTotais,
      unidadesCobertas,
      unidadesTreinadas,
    });
  }, [doCargo, editalStatus, historico, questoes, concursoAtivoId, dataEfetiva]);

  // Revisões vencidas entram na TELA do dia, não em `montarPlano` (ADR-008):
  // são dado volátil — mudam ao longo do dia — e dentro da montagem estática o
  // plano mentiria à tarde.
  const revisoesVencidas = useMemo(
    () =>
      revisoes.filter(
        (r) =>
          r.concursoId === concursoAtivoId && new Date(r.proximaRevisao).getTime() < Date.now(),
      ).length,
    [revisoes, concursoAtivoId],
  );

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

      {/* Trilha até a prova (ADR-009): as três fases, a atual destacada, e o
          ritmo que o calendário exige — sempre com os números da conta. */}
      {!vazio && !carregando && trilha.unidadesTotais > 0 && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold">Trilha até a prova</p>
              {trilha.diasRestantes !== null ? (
                <Badge variant="secondary">
                  {trilha.diasRestantes} dias{dataEstimada ? " — data estimada" : ""}
                </Badge>
              ) : (
                <Badge variant="outline">sem data anunciada — fases pela cobertura</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {FASES.map((f, i) => (
                <div
                  key={f.id}
                  className={cn(
                    "flex-1 min-w-40 rounded-lg border p-2.5 text-xs",
                    f.id === trilha.faseAtual
                      ? "border-primary bg-primary/5"
                      : "border-border opacity-60",
                  )}
                >
                  <p className="font-semibold">
                    {i + 1}. {f.nome}
                    {f.id === trilha.faseAtual && " ← você está aqui"}
                  </p>
                  <p className="mt-0.5 text-muted-foreground">{f.pede}</p>
                </div>
              ))}
            </div>

            {/* Ritmo alto = priorizar, não acelerar (ADR-017). O aviso vem com a
                conta que o sustenta, como toda afirmação estatística aqui. */}
            {trilha.faseAtual === "cobertura" &&
              trilha.ritmoNecessario !== null &&
              trilha.ritmoNecessario > RITMO_ALTO && (
                <p className="rounded-md border border-atencao/40 bg-atencao-suave p-2.5 text-xs text-atencao-foreground">
                  Fechar a cobertura inteira exigiria ~
                  {trilha.ritmoNecessario.toLocaleString("pt-BR")} unidades de teoria por dia até a
                  fase de questões — ritmo difícil de sustentar junto com treino e revisões.{" "}
                  <strong>Priorize pelos assuntos que mais caem</strong> (Análise → Onde parar de
                  estudar) em vez de tentar cobrir tudo.
                </p>
              )}

            <p className="text-xs text-muted-foreground">
              {trilha.unidadesCobertas} de {trilha.unidadesTotais} unidades do edital com teoria
              vista · {trilha.unidadesTreinadas} treinadas com 3+ questões.
              {trilha.faseAtual === "cobertura" &&
                trilha.ritmoNecessario !== null &&
                ` Para fechar a cobertura a ${30} dias da prova: ~${trilha.ritmoNecessario.toLocaleString("pt-BR")} ${trilha.ritmoNecessario === 1 ? "unidade" : "unidades"} de teoria por dia.`}
              {trilha.diasRestantes === null &&
                " Sem data de prova não há cronograma — quando o edital sair, a trilha vira contagem."}
            </p>
          </CardContent>
        </Card>
      )}

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

              {/* O dia começa pelas revisões: erro de ontem rende mais que
                  assunto novo, e as duas agendas precisam se ver (ADR-008). */}
              {dia.indice === hoje && revisoesVencidas > 0 && (
                <Link
                  to="/revisoes"
                  className="block rounded-lg border border-atencao/40 bg-atencao-suave p-2.5 text-xs text-atencao-foreground transition-colors hover:border-atencao"
                >
                  Revisar primeiro: <strong>{revisoesVencidas}</strong>{" "}
                  {revisoesVencidas === 1 ? "assunto vencido" : "assuntos vencidos"} →
                </Link>
              )}

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
