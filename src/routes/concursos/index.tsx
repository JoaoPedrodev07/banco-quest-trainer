import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Building2, CheckCircle2, Search, TriangleAlert } from "lucide-react";

import { useConcursos } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import {
  FAIXAS_SALARIAIS,
  STATUS_CONCURSO,
  combinaBusca,
  dentroDaFaixa,
  formatarSalario,
} from "@/lib/concurso";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/concursos/")({
  head: () => ({
    meta: [
      { title: "Concursos — Foco BB TI 2026" },
      { name: "description", content: "Busque concursos por órgão, cargo, banca e salário." },
      { property: "og:title", content: "Catálogo de concursos" },
      { property: "og:description", content: "Compare órgão, cargo, banca, vagas e salário." },
    ],
  }),
  component: ConcursosPage,
});

function ConcursosPage() {
  const [busca, setBusca] = useState("");
  const [status, setStatus] = useState("todos");
  const [faixa, setFaixa] = useState("todas");
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  // Catálogo do backend (ADR-015) — editável no admin; mock estático é a reserva.
  const { concursos } = useConcursos();

  const filtrados = useMemo(
    () =>
      concursos.filter(
        (c) =>
          combinaBusca(c, busca) &&
          (status === "todos" || c.status === status) &&
          dentroDaFaixa(c, faixa),
      ),
    [concursos, busca, status, faixa],
  );

  const naoConfirmados = filtrados.filter((c) => !c.fonte.eOficial).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Concursos</h1>
        <p className="text-sm text-muted-foreground">
          Escolha qual concurso você está estudando. O progresso de cada um fica separado.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar por órgão, cargo ou banca…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Qualquer status</SelectItem>
            {Object.entries(STATUS_CONCURSO).map(([id, { rotulo }]) => (
              <SelectItem key={id} value={id}>
                {rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={faixa} onValueChange={setFaixa}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FAIXAS_SALARIAIS.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.rotulo}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {naoConfirmados > 0 && (
        <p className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {naoConfirmados === filtrados.length ? "Todos os" : `${naoConfirmados} dos`} concursos
            listados ainda <strong>não têm edital publicado</strong>. Vagas, salário e banca vêm da
            imprensa e mudam até o edital sair.
          </span>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {filtrados.map((c) => {
          const ativo = c.id === concursoAtivoId;
          const salario = formatarSalario(c.salario);
          return (
            <Link
              key={c.id}
              to="/concursos/$concursoId"
              params={{ concursoId: c.id }}
              className="group focus-visible:outline-none"
            >
              <Card className="h-full transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold leading-tight">{c.nome}</h2>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Building2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{c.orgao}</span>
                      </p>
                    </div>
                    {ativo && (
                      <Badge className="shrink-0 gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Em foco
                      </Badge>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={STATUS_CONCURSO[c.status].variante}>
                      {STATUS_CONCURSO[c.status].rotulo}
                    </Badge>
                    <Badge variant="outline">{c.banca ?? "Banca a definir"}</Badge>
                    {!c.fonte.eOficial && (
                      <Badge variant="outline" className="border-dashed">
                        a confirmar
                      </Badge>
                    )}
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted-foreground">Salário</dt>
                      <dd className="font-semibold">{salario ?? "não divulgado"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Vagas</dt>
                      <dd className="font-semibold">{c.vagas ?? "não divulgadas"}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nenhum concurso com esses filtros.
        </p>
      )}
    </div>
  );
}
