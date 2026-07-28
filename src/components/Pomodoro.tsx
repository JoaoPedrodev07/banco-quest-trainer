/**
 * Timer pomodoro, fixo no canto da tela.
 *
 * Mora no shell (`AppLayout`) e não numa rota: um timer que zera ao navegar de
 * Questões para Edital não serve para estudar.
 *
 * O tempo restante é **calculado a cada segundo a partir do instante de início**,
 * nunca decrementado. Um contador decrementado atrasa quando o navegador
 * estrangula os timers da aba em segundo plano — que é exatamente quando alguém
 * deixa o pomodoro rodando e vai ler outra coisa.
 */

import { useEffect, useState } from "react";
import { Coffee, Pause, Play, RotateCcw, Timer } from "lucide-react";
import { toast } from "sonner";

import { DURACAO_POMODORO, useStore } from "@/store/useStore";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatar(segundos: number): string {
  const m = Math.floor(Math.max(0, segundos) / 60);
  const s = Math.max(0, segundos) % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Pomodoro() {
  const pomodoro = useStore((s) => s.pomodoro);
  const iniciar = useStore((s) => s.iniciarPomodoro);
  const parar = useStore((s) => s.pararPomodoro);
  const alternar = useStore((s) => s.alternarFasePomodoro);
  const concluir = useStore((s) => s.concluirFasePomodoro);
  const [aberto, setAberto] = useState(false);
  const [agora, setAgora] = useState(() => Date.now());

  const duracao = DURACAO_POMODORO[pomodoro.fase];
  // O que já foi cumprido antes da pausa mais o que corre agora. Pausar guarda o
  // acumulado, então retomar continua de onde parou em vez de recomeçar.
  const correndo = pomodoro.iniciadoEm
    ? Math.floor((agora - new Date(pomodoro.iniciadoEm).getTime()) / 1000)
    : 0;
  const decorrido = pomodoro.acumuladoSegundos + Math.max(0, correndo);
  const restante = duracao - decorrido;
  const rodando = pomodoro.iniciadoEm !== null;

  // Um tick por segundo só enquanto roda: parado, o intervalo seria puro
  // desperdício de re-render em toda tela do app.
  useEffect(() => {
    if (!rodando) return;
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, [rodando]);

  useEffect(() => {
    if (!rodando || restante > 0) return;
    concluir();
    const eraFoco = pomodoro.fase === "foco";
    toast.success(eraFoco ? "Ciclo de foco concluído" : "Pausa terminada", {
      description: eraFoco
        ? "Levante, beba água, olhe longe. 5 minutos."
        : "Bora para mais um ciclo.",
    });
  }, [rodando, restante, concluir, pomodoro.fase]);

  const ehFoco = pomodoro.fase === "foco";
  const progresso = Math.min(100, (decorrido / duracao) * 100);

  return (
    <div className="fixed bottom-20 right-4 z-50 md:bottom-4">
      {!aberto ? (
        <Button
          size="sm"
          variant={rodando ? "default" : "secondary"}
          onClick={() => setAberto(true)}
          className="gap-1.5 shadow-lg transition-transform hover:scale-105"
        >
          {ehFoco ? <Timer className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
          <span className="tabular-nums">
            {rodando || decorrido > 0 ? formatar(restante) : "Pomodoro"}
          </span>
        </Button>
      ) : (
        <div className="w-56 space-y-3 rounded-xl border border-border bg-background/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {ehFoco ? <Timer className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5" />}
              {ehFoco ? "Foco" : "Pausa"}
            </p>
            <button
              onClick={() => setAberto(false)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              fechar
            </button>
          </div>

          <p className="text-center text-4xl font-black tabular-nums">{formatar(restante)}</p>

          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-1000 ease-linear",
                ehFoco ? "bg-primary" : "bg-accent",
              )}
              style={{ width: `${progresso}%` }}
            />
          </div>

          <div className="flex gap-2">
            {rodando ? (
              <Button size="sm" variant="outline" onClick={parar} className="flex-1 gap-1.5">
                <Pause className="h-3.5 w-3.5" />
                Pausar
              </Button>
            ) : (
              <Button size="sm" onClick={() => iniciar(pomodoro.fase)} className="flex-1 gap-1.5">
                <Play className="h-3.5 w-3.5" />
                {decorrido > 0 ? "Retomar" : "Começar"}
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={alternar}
              title={ehFoco ? "Pular para a pausa" : "Voltar ao foco"}
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            {pomodoro.ciclosConcluidos === 0
              ? "Nenhum ciclo hoje ainda."
              : `${pomodoro.ciclosConcluidos} ${pomodoro.ciclosConcluidos === 1 ? "ciclo concluído" : "ciclos concluídos"} hoje.`}
          </p>
        </div>
      )}
    </div>
  );
}
