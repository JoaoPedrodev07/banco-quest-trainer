import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/store/useStore";
import { disciplinas } from "@/data/disciplinas";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

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
  const { revisoes, marcarRevisada } = useStore();

  const ordenadas = [...revisoes].sort(
    (a, b) => new Date(a.proximaRevisao).getTime() - new Date(b.proximaRevisao).getTime(),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Revisões</h1>
        <p className="text-sm text-muted-foreground">Intervalos de 1, 7, 15 e 30 dias. Revise para consolidar.</p>
      </div>

      <div className="space-y-3">
        {ordenadas.map((r) => {
          const d = disciplinas.find((x) => x.id === r.disciplinaId);
          const data = new Date(r.proximaRevisao);
          const atrasada = data.getTime() < Date.now();
          const dias = Math.round((data.getTime() - Date.now()) / 86400000);
          return (
            <Card key={r.id}>
              <CardContent className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold truncate">{r.topico}</p>
                    {atrasada && <Badge variant="destructive">Atrasada</Badge>}
                    <Badge variant="secondary">{r.intervaloAtual}d</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {d?.nome} · {atrasada ? `Atrasada há ${Math.abs(dias)} dia(s)` : `Em ${dias} dia(s)`}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    marcarRevisada(r.id);
                    toast.success("Revisão concluída! Reagendada.");
                  }}
                >
                  Revisado hoje
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {ordenadas.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma revisão agendada ainda.
          </p>
        )}
      </div>
    </div>
  );
}
