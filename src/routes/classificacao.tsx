import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useFilaRevisao, useRevisarClassificacao } from "@/services/hooks";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { ClassificacaoRevisao } from "@/types";

export const Route = createFileRoute("/classificacao")({
  head: () => ({
    meta: [
      { title: "Revisão de classificação — Foco BB TI 2026" },
      {
        name: "description",
        content: "Confirme classificações automáticas de questões por tópico do edital.",
      },
    ],
  }),
  component: ClassificacaoPage,
});

const VARIANTE_POR_ORIGEM: Record<
  ClassificacaoRevisao["origemClassificacao"],
  "secondary" | "outline" | "destructive"
> = {
  humana: "secondary",
  heuristica: "outline",
  llm_externa: "destructive",
};

const LABEL_ORIGEM: Record<ClassificacaoRevisao["origemClassificacao"], string> = {
  humana: "Humana",
  heuristica: "Heurística",
  llm_externa: "IA externa",
};

function ClassificacaoPage() {
  const { fila, carregando } = useFilaRevisao();
  const revisar = useRevisarClassificacao();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Revisão de classificação</h1>
        <p className="text-sm text-muted-foreground">
          Classificação automática (heurística ou IA externa) ainda não confirmada por humano —
          Fase 2 do motor de incidência. Confirmar aqui é o que permite essa classificação entrar
          com peso cheio na análise mais adiante.
        </p>
      </div>

      {carregando && (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}

      {!carregando && fila.length === 0 && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-3 text-muted-foreground">
            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm">
              Nada pendente. Toda classificação com confiança baixa ou de origem não-humana já foi
              revisada.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {fila.map((item) => (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-sm font-mono text-muted-foreground">
                  {item.questaoId}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={VARIANTE_POR_ORIGEM[item.origemClassificacao]}>
                    {LABEL_ORIGEM[item.origemClassificacao]}
                  </Badge>
                  <Badge variant="outline">confiança {Math.round(item.confianca * 100)}%</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm">{item.enunciado}</p>
              <div className="text-sm">
                <span className="font-semibold">{item.topicoNome}</span>
                {item.subtopicoNome && (
                  <span className="text-muted-foreground"> › {item.subtopicoNome}</span>
                )}
                <span className="text-xs text-muted-foreground ml-2">
                  ({item.impactoTopico} questões já sob este tópico)
                </span>
              </div>
              {item.justificativa && (
                <p className="text-xs text-muted-foreground italic flex items-start gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  {item.justificativa}
                </p>
              )}
              <Button
                size="sm"
                disabled={revisar.isPending}
                onClick={() =>
                  revisar.mutate(item.id, {
                    onSuccess: () => toast.success(`${item.questaoId} confirmada.`),
                    onError: () => toast.error("Não deu para confirmar. Backend fora do ar?"),
                  })
                }
              >
                Confirmar classificação
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
