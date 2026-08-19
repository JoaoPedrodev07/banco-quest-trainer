import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, ExternalLink, FileText, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { useConcurso, useProvas } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { STATUS_CONCURSO, formatarSalario } from "@/lib/concurso";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/concursos/$concursoId")({
  head: () => ({
    meta: [
      { title: "Concurso — Foco BB TI 2026" },
      { name: "description", content: "Detalhes do concurso: cargo, banca, salário e provas." },
    ],
  }),
  component: ConcursoDetalhe,
});

function ConcursoDetalhe() {
  const { concursoId } = Route.useParams();
  const navigate = useNavigate();
  const concurso = useConcurso(concursoId);
  const { provas, carregando } = useProvas();
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const definirConcursoAtivo = useStore((s) => s.definirConcursoAtivo);

  if (!concurso) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-black">Concurso não encontrado</h1>
        <p className="text-sm text-muted-foreground">
          O identificador <code className="rounded bg-muted px-1">{concursoId}</code> não está no
          catálogo.
        </p>
        <Button asChild variant="outline">
          <Link to="/concursos">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao catálogo
          </Link>
        </Button>
      </div>
    );
  }

  const ativo = concurso.id === concursoAtivoId;
  const salario = formatarSalario(concurso.salario);
  // As provas vêm do acervo; `provaIds` só aponta quais delas são deste concurso.
  const provasDoConcurso = provas.filter((p) => concurso.provaIds.includes(p.id));

  const estudar = () => {
    definirConcursoAtivo(concurso.id);
    toast.success(`Estudando ${concurso.nome}`, {
      description: "As telas de edital, questões e revisões passaram a usar este concurso.",
    });
    navigate({ to: "/" });
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/concursos">
          <ArrowLeft className="h-4 w-4" />
          Concursos
        </Link>
      </Button>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-black md:text-3xl">{concurso.nome}</h1>
            <p className="text-sm text-muted-foreground">{concurso.orgao}</p>
          </div>
          <Button
            onClick={estudar}
            disabled={ativo}
            className="transition-transform hover:scale-[1.02]"
          >
            {ativo ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Concurso em foco
              </>
            ) : (
              "Estudar este concurso"
            )}
          </Button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <Badge variant={STATUS_CONCURSO[concurso.status].variante}>
            {STATUS_CONCURSO[concurso.status].rotulo}
          </Badge>
          <Badge variant="outline">{concurso.banca ?? "Banca a definir"}</Badge>
        </div>
      </div>

      {!concurso.fonte.eOficial && (
        <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="space-y-1 text-muted-foreground">
            <p>
              <strong>Edital ainda não publicado.</strong> Cargo, vagas, salário e banca vieram da
              imprensa e podem mudar — inclusive a banca, que define o estilo das questões.
            </p>
            <p className="text-xs">
              Fonte:{" "}
              <a
                href={concurso.fonte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors hover:text-foreground"
              >
                {concurso.fonte.titulo}
              </a>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Dado rotulo="Cargo" valor={concurso.cargo} />
        <Dado
          rotulo="Salário"
          valor={salario ?? "não divulgado"}
          nota={concurso.salario?.observacao}
        />
        <Dado rotulo="Vagas" valor={concurso.vagas?.toString() ?? "não divulgadas"} />
        <Dado
          rotulo="Data da prova"
          valor={
            concurso.dataProva
              ? new Date(concurso.dataProva).toLocaleDateString("pt-BR")
              : "sem data definida"
          }
        />
      </div>

      {concurso.editalUrl ? (
        <Button asChild variant="outline">
          <a href={concurso.editalUrl} target="_blank" rel="noopener noreferrer">
            <FileText className="h-4 w-4" />
            Abrir edital oficial
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum edital publicado até agora — não há documento oficial para abrir.
        </p>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-bold">Provas anteriores</h2>

        {carregando && <p className="text-sm text-muted-foreground">Carregando provas…</p>}

        {!carregando && provasDoConcurso.length === 0 && (
          <div className="rounded-md border border-dashed border-border p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Sem simulado local ainda</p>
            <p className="mt-1">
              Este concurso está no catálogo pelo edital e pelos dados da vaga, mas nenhuma prova
              dele foi importada para o acervo. Escolher este concurso não vai te dar questões para
              treinar — só o acompanhamento do edital.
            </p>
          </div>
        )}

        <div className="grid gap-2">
          {provasDoConcurso.map((p) => (
            <Card key={p.id} className="transition-colors hover:border-primary/40">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {p.orgao} {p.ano} — {p.cargo}
                  </p>
                  {/* O id entra porque um mesmo cargo tem vários cadernos (provas
                      A, B e C do Agente Comercial): sem ele as linhas ficam
                      idênticas e não dá para saber qual já foi resolvida. */}
                  <p className="text-xs text-muted-foreground">
                    <code className="rounded bg-muted px-1">{p.id}</code> · {p.banca} ·{" "}
                    {p.questoesDisponiveis != null
                      ? `${p.questoesDisponiveis} de ${p.qtdQuestoes} questões no acervo`
                      : `${p.qtdQuestoes} questões`}
                  </p>
                </div>
                <div className="flex gap-2">
                  {p.urlProva && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.urlProva} target="_blank" rel="noopener noreferrer">
                        Caderno
                      </a>
                    </Button>
                  )}
                  {p.urlGabarito && (
                    <Button asChild size="sm" variant="outline">
                      <a href={p.urlGabarito} target="_blank" rel="noopener noreferrer">
                        Gabarito
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}

function Dado({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{rotulo}</p>
        <p className="font-semibold leading-snug">{valor}</p>
        {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
      </CardContent>
    </Card>
  );
}
