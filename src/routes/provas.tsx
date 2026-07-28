import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AvisoAcervo } from "@/components/AvisoAcervo";
import { useProvas } from "@/services/hooks";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/provas")({
  head: () => ({
    meta: [
      { title: "Provas anteriores — Foco BB TI 2026" },
      { name: "description", content: "Repositório de provas anteriores de bancos públicos." },
      { property: "og:title", content: "Provas anteriores" },
      { property: "og:description", content: "BB, Caixa, BNDES, Petrobras — Cesgranrio." },
    ],
  }),
  component: ProvasPage,
});

function ProvasPage() {
  const [banca, setBanca] = useState("todas");
  const [ano, setAno] = useState("todos");
  const { provas, carregando } = useProvas();

  const filtradas = useMemo(
    () =>
      provas.filter(
        (p) => (banca === "todas" || p.banca === banca) && (ano === "todos" || p.ano === Number(ano)),
      ),
    [provas, banca, ano],
  );

  const anos = Array.from(new Set(provas.map((p) => p.ano))).sort((a, b) => b - a);
  const bancas = Array.from(new Set(provas.map((p) => p.banca)));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Provas anteriores</h1>
        <p className="text-sm text-muted-foreground">Baixe ou resolva online provas de bancos públicos.</p>
      </div>

      <AvisoAcervo />

      <div className="flex flex-wrap gap-3">
        <Select value={banca} onValueChange={setBanca}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as bancas</SelectItem>
            {bancas.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={ano} onValueChange={setAno}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos anos</SelectItem>
            {anos.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtradas.map((p) => (
          <Card key={p.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-bold truncate">{p.orgao}</p>
                  <p className="text-xs text-muted-foreground truncate">{p.cargo}</p>
                </div>
                <Badge>{p.ano}</Badge>
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{p.banca}</span>
                <span>·</span>
                {/* Dois números de propósito: importação parcial de caderno não
                    pode se passar por prova inteira (§2.2 do CLAUDE.md). */}
                <span>
                  {p.questoesDisponiveis ?? 0} de {p.qtdQuestoes} questões no acervo
                </span>
              </div>
              <div className="flex gap-2 pt-2">
                {p.urlProva ? (
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <a href={p.urlProva} target="_blank" rel="noreferrer">
                      <Download className="h-3 w-3 mr-1" /> PDF
                    </a>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => toast.info("Esta prova foi importada de arquivo local, sem URL pública.")}
                  >
                    <Download className="h-3 w-3 mr-1" /> PDF
                  </Button>
                )}
                <Button size="sm" className="flex-1" onClick={() => toast.info("Modo online em breve")}>
                  <FileText className="h-3 w-3 mr-1" /> Resolver
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtradas.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-8">
            {carregando ? "Carregando provas…" : "Nenhuma prova encontrada com esses filtros."}
          </p>
        )}
      </div>
    </div>
  );
}
