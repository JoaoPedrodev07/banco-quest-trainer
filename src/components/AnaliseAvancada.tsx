/**
 * As análises que dependem do histórico do usuário, e não só do acervo.
 *
 * Ficam separadas da incidência porque respondem a outra pergunta: incidência
 * diz o que a banca cobra; isto diz onde **você** está. E ficam num componente
 * só porque todas compartilham a mesma regra de honestidade — cada bloco só
 * aparece quando a amostra sustenta o que ele afirma, e diz o que falta quando
 * não sustenta.
 */

import { useMemo } from "react";
import { Clock, Dices, Target, TrendingDown } from "lucide-react";

import { concursoPorId } from "@/data/concursos";
import { useStore } from "@/store/useStore";
import {
  assuntosPara,
  curvaDeCobertura,
  decisaoDeChute,
  diagnosticarRitmo,
  simularNota,
  type PontoDeCobertura,
} from "@/lib/estatistica";
import { RITMO_ALVO_SEGUNDOS, formatarDuracao } from "@/lib/ritmo";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { Disciplina, Questao, RespostaHistorico } from "@/types";

interface Props {
  disciplinas: Disciplina[];
  questoes: Questao[];
  historico: RespostaHistorico[];
}

/** Amostra mínima para a simulação de nota dizer algo por disciplina. */
const MINIMO_PARA_SIMULAR = 10;

export function AnaliseAvancada({ disciplinas, questoes, historico }: Props) {
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const concurso = concursoPorId(concursoAtivoId);
  const doConcurso = useMemo(
    () => historico.filter((h) => h.concursoId === concursoAtivoId),
    [historico, concursoAtivoId],
  );

  // ------------------------------------------------------------ cobertura
  const curva = useMemo(() => {
    const nomes = new Map<string, string>();
    for (const d of disciplinas)
      for (const t of d.topicos) nomes.set(t.id, `${d.nome} · ${t.nome}`);
    const contagem = new Map<string, number>();
    for (const q of questoes) {
      if (q.topicoId) contagem.set(q.topicoId, (contagem.get(q.topicoId) ?? 0) + 1);
    }
    return curvaDeCobertura(
      [...contagem.entries()].map(([topicoId, questoes]) => ({
        topicoId,
        nome: nomes.get(topicoId) ?? topicoId,
        questoes,
      })),
    );
  }, [disciplinas, questoes]);

  // ------------------------------------------------------------ ritmo
  const ritmo = useMemo(() => {
    // Só entra resposta com tempo medido. Resposta sem `segundos` é de flashcard
    // ou de histórico anterior ao campo existir — tratá-la como zero segundos
    // faria a média despencar e o app acusaria pressa em quem nunca correu.
    const amostras = doConcurso
      .filter((h) => typeof h.segundos === "number")
      .map((h) => ({
        disciplinaId: h.disciplinaId,
        segundos: h.segundos as number,
        correta: h.correta,
      }));
    return diagnosticarRitmo(amostras, RITMO_ALVO_SEGUNDOS);
  }, [doConcurso]);

  // ------------------------------------------------------------ simulação
  const simulacao = useMemo(() => {
    const porDisciplina = disciplinas
      .map((d) => {
        const respostas = doConcurso.filter((h) => h.disciplinaId === d.id);
        const naProva = questoes.filter((q) => q.disciplinaId === d.id).length;
        return {
          questoesNaProva: naProva,
          respondidas: respostas.length,
          taxaAcerto: respostas.length
            ? respostas.filter((r) => r.correta).length / respostas.length
            : 0,
        };
      })
      .filter((d) => d.questoesNaProva > 0);

    const suficiente = porDisciplina.reduce((a, d) => a + d.respondidas, 0) >= MINIMO_PARA_SIMULAR;
    if (!suficiente) return null;
    return simularNota(porDisciplina, { descontaErro: questoes.some((q) => q.pontuacaoLiquida) });
  }, [disciplinas, questoes, doConcurso]);

  const chute = decisaoDeChute(questoes.some((q) => q.pontuacaoLiquida));

  return (
    <div className="space-y-4">
      {/* -------------------------------------------------- onde parar de estudar */}
      {curva.length > 0 && <CartaoCobertura curva={curva} />}

      {/* -------------------------------------------------- nota provável */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Dices className="h-4 w-4 text-muted-foreground" />
            Nota provável
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {simulacao ? (
            <>
              <p className="text-sm">
                Em 70% dos cenários simulados sua nota ficaria entre{" "}
                <strong className="text-foreground">{simulacao.p15}</strong> e{" "}
                <strong className="text-foreground">{simulacao.p85}</strong>, com mediana em{" "}
                <strong>{simulacao.mediana}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                {simulacao.simulacoes.toLocaleString("pt-BR")} simulações a partir do seu acerto por
                disciplina. É uma faixa, e não uma previsão: ela se estreita conforme você responde
                mais. <strong>Não</strong> inclui a nota de corte — a de 2026 não existe, e a de
                2023 variou de 51 a 85 pontos conforme a microrregião.
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Responda pelo menos {MINIMO_PARA_SIMULAR} questões para a simulação ter base. Com
              menos que isso, a faixa seria tão larga que não diria nada.
            </p>
          )}
        </CardContent>
      </Card>

      {/* -------------------------------------------------- ritmo por disciplina */}
      {ritmo.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Ritmo por disciplina
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ritmo.map((d) => (
              <div key={d.disciplinaId} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">
                    {disciplinas.find((x) => x.id === d.disciplinaId)?.nome ?? d.disciplinaId}
                  </p>
                  <Badge variant={d.perfil === "equilibrado" ? "secondary" : "outline"}>
                    {Math.round(d.taxaAcerto * 100)}% · {formatarDuracao(d.tempoMedio)}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{d.mensagem}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------- chute racional */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-muted-foreground" />
            Vale a pena chutar?
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{chute.explicacao}</p>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Estes números descrevem {concurso?.nome ?? "o concurso em foco"} e usam só as suas respostas
        nele.
      </p>
    </div>
  );
}

function CartaoCobertura({ curva }: { curva: PontoDeCobertura[] }) {
  const para50 = assuntosPara(curva, 50);
  const para80 = assuntosPara(curva, 80);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingDown className="h-4 w-4 text-muted-foreground" />
          Onde parar de estudar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          Os <strong>{para50}</strong> assuntos mais cobrados cobrem metade da prova. Para chegar a
          80% são <strong>{para80}</strong>. Os {curva.length - para80} restantes valem os últimos
          20% — é onde cada hora rende menos.
        </p>

        <div className="space-y-1.5">
          {curva.slice(0, 8).map((p, i) => (
            <div key={p.topicoId} className="space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="min-w-0 flex-1 truncate text-xs">
                  <span className="mr-1.5 text-muted-foreground">{i + 1}.</span>
                  {p.nome}
                </p>
                <p className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  +{p.ganhoMarginal}% →{" "}
                  <strong className="text-foreground">{p.coberturaAcumulada}%</strong>
                </p>
              </div>
              <Progress value={p.coberturaAcumulada} className="h-1" />
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          Só conta questão já classificada por assunto. Assunto do edital que nunca caiu não aparece
          aqui — e ausência no acervo não é garantia de que não cai.
        </p>
      </CardContent>
    </Card>
  );
}
