import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { disciplinas } from "@/data/disciplinas";
import { useStore } from "@/store/useStore";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { StatusTopico } from "@/types";

export const Route = createFileRoute("/edital")({
  head: () => ({
    meta: [
      { title: "Edital Verticalizado — Foco BB TI 2026" },
      { name: "description", content: "Acompanhe cada tópico do edital do BB TI Cesgranrio." },
      { property: "og:title", content: "Edital Verticalizado" },
      { property: "og:description", content: "Marque teoria, revisão e questões por subtópico." },
    ],
  }),
  component: EditalPage,
});

type Filtro = "todos" | "pendentes" | "concluidos";

function EditalPage() {
  const { editalStatus, toggleStatus } = useStore();
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [expandidas, setExpandidas] = useState<Record<string, boolean>>({});

  const totalSub = disciplinas.reduce((a, d) => a + d.topicos.reduce((x, t) => x + t.subtopicos.length, 0), 0);
  const concluidos = Object.values(editalStatus).filter((s) => s.teoria && s.revisao && s.questoes).length;
  const progresso = Math.round((concluidos / totalSub) * 100);

  const status = (id: string): StatusTopico =>
    editalStatus[id] ?? { teoria: false, revisao: false, questoes: false };
  const isConcluido = (id: string) => {
    const s = status(id);
    return s.teoria && s.revisao && s.questoes;
  };
  const filtrar = (subId: string) => {
    if (filtro === "todos") return true;
    const c = isConcluido(subId);
    return filtro === "concluidos" ? c : !c;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Edital Verticalizado</h1>
        <p className="text-sm text-muted-foreground">
          Marque teoria, revisão e questões conforme avança em cada subtópico.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Progresso geral</p>
            <p className="text-sm font-bold text-primary">{progresso}%</p>
          </div>
          <Progress value={progresso} className="h-2" />
        </CardContent>
      </Card>

      <div className="flex gap-2">
        {(["todos", "pendentes", "concluidos"] as Filtro[]).map((f) => (
          <Button key={f} size="sm" variant={filtro === f ? "default" : "outline"} onClick={() => setFiltro(f)}>
            {f === "todos" ? "Todos" : f === "pendentes" ? "Pendentes" : "Concluídos"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {disciplinas.map((d) => {
          const subIds = d.topicos.flatMap((t) => t.subtopicos.map((s) => s.id));
          const conc = subIds.filter(isConcluido).length;
          const pct = Math.round((conc / subIds.length) * 100);
          const aberta = expandidas[d.id] ?? false;
          return (
            <Card key={d.id}>
              <button
                onClick={() => setExpandidas((e) => ({ ...e, [d.id]: !aberta }))}
                className="w-full flex items-center gap-3 p-4 text-left"
              >
                {aberta ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="font-bold truncate" style={{ color: d.cor }}>
                    {d.nome}
                  </p>
                  <Progress value={pct} className="h-1.5 mt-2" />
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-black">{pct}%</p>
                  <p className="text-[10px] text-muted-foreground">{conc}/{subIds.length}</p>
                </div>
              </button>
              {aberta && (
                <div className="border-t border-border px-4 pb-4 space-y-4">
                  {d.topicos.map((t) => {
                    const subs = t.subtopicos.filter((s) => filtrar(s.id));
                    if (subs.length === 0) return null;
                    return (
                      <div key={t.id} className="pt-3">
                        <p className="text-sm font-semibold text-muted-foreground mb-2">{t.nome}</p>
                        <div className="space-y-2">
                          {subs.map((s) => {
                            const st = status(s.id);
                            return (
                              <div
                                key={s.id}
                                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3"
                              >
                                <p className="text-sm min-w-0 flex-1">{s.nome}</p>
                                <div className="flex gap-4 shrink-0">
                                  {(["teoria", "revisao", "questoes"] as (keyof StatusTopico)[]).map((k) => (
                                    <label key={k} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                      <Checkbox
                                        checked={st[k]}
                                        onCheckedChange={() => toggleStatus(s.id, k)}
                                      />
                                      <span className="capitalize">{k}</span>
                                    </label>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
