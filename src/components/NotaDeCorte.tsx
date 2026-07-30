/**
 * Onde você está em relação ao corte — pelas regras do edital, não por palpite.
 *
 * O cartão existe porque a pergunta "qual é a nota de corte?" leva o candidato a
 * mirar no número errado. Em 2023, na Microrregião 158 (a única de TI), o corte
 * ficou em torno de 51 pontos: praticamente colado no piso de eliminação de 50
 * que está no edital. Ou seja, naquele ano quem não foi eliminado foi
 * habilitado. O inimigo era a eliminação, não a concorrência.
 *
 * Por isso a tela mostra os quatro filtros do subitem 7.1.4, e não um ranking.
 */

import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ScrollText } from "lucide-react";

import {
  COMPOSICAO_PROVA,
  LIMITE_HABILITACAO,
  QUADRO_MR158,
  concorrenciaPorLista,
  projetarNota,
} from "@/lib/corte";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { RespostaHistorico } from "@/types";

interface Props {
  historico: RespostaHistorico[];
}

export function NotaDeCorte({ historico }: Props) {
  const { resultado, semBase, taxas } = useMemo(() => {
    const taxas: Record<string, number | null> = {};
    for (const d of COMPOSICAO_PROVA) {
      const respostas = historico.filter((h) => h.disciplinaId === d.disciplinaId);
      // Menos de 5 respostas não é taxa, é ruído — entra como "sem base" e a
      // projeção usa o acaso, deixando explícito na tela o que foi chutado.
      taxas[d.disciplinaId] =
        respostas.length >= 5 ? respostas.filter((r) => r.correta).length / respostas.length : null;
    }
    return { ...projetarNota(taxas), taxas };
  }, [historico]);

  const listas = concorrenciaPorLista();

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <ScrollText className="h-4 w-4 text-muted-foreground" />
          Piso do edital e nota projetada
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm">
              Projeção:{" "}
              <strong className="text-base tabular-nums">{resultado.pontos.toFixed(1)}</strong>{" "}
              <span className="text-muted-foreground">de 100</span>
            </p>
            <Badge variant={resultado.eliminado ? "destructive" : "secondary"}>
              {resultado.eliminado
                ? "Eliminado pelas regras"
                : `${resultado.folgaTotal.toFixed(1)} pts acima do piso`}
            </Badge>
          </div>
          <Progress value={resultado.pontos} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Básicos {resultado.pontosBasicos.toFixed(1)}/32,5 · Específicos{" "}
            {resultado.pontosEspecificos.toFixed(1)}/67,5
          </p>
        </div>

        {/* Os quatro filtros do 7.1.4 — quem reprova candidato bom. */}
        {resultado.eliminado ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <ul className="ml-4 list-disc space-y-1 text-xs">
                {resultado.motivos.map((m) => (
                  <li key={m.regra}>
                    <strong>{m.regra}:</strong> {m.detalhe}
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Nesta projeção você passa dos quatro filtros de eliminação: 50% do total, 50% de
              Básicos, 50% de Específicos e nenhuma disciplina zerada.
            </AlertDescription>
          </Alert>
        )}

        {semBase.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Sem base para projetar <strong>{semBase.join(", ")}</strong> — menos de 5 questões
            respondidas. Essas disciplinas entraram na conta pelo acaso puro (20%), que é o piso de
            quem não estudou. Responder questões delas é o que mais muda este número.
          </p>
        )}

        <div className="space-y-1 rounded-md border p-3">
          <p className="text-xs font-semibold">Microrregião {QUADRO_MR158.microrregiao}</p>
          <div className="space-y-0.5">
            {listas.map((l) => (
              <div key={l.lista} className="flex justify-between gap-2 text-xs">
                <span className="text-muted-foreground">{l.rotulo}</span>
                <span className="tabular-nums">
                  {l.vagas} vagas + {l.cadastroReserva} CR ={" "}
                  <strong>{l.total.toLocaleString("pt-BR")}</strong> ({l.fatia}%)
                </span>
              </div>
            ))}
          </div>
          <p className="pt-1 text-xs text-muted-foreground">
            A redação só é corrigida de quem ficar dentro de{" "}
            {LIMITE_HABILITACAO.toLocaleString("pt-BR")} posições (o triplo de vagas + cadastro de
            reserva, subitem 7.1.6). As listas reservadas mudam a ordem de chamada, não o piso: o
            subitem 4.1.3 exige de todos as mesmas notas mínimas.
          </p>
        </div>

        <p className="text-xs text-muted-foreground">
          Números do Edital BB 2023 (subitens 7.1.2, 7.1.4, 7.1.6 e Anexo II). O edital de 2026
          ainda não saiu — se a composição da prova mudar, esta projeção muda junto. E projeção a
          partir do seu histórico não é nota: você respondeu {historico.length}{" "}
          {historico.length === 1 ? "questão" : "questões"} em condições diferentes das da prova.
        </p>
      </CardContent>
    </Card>
  );
}
