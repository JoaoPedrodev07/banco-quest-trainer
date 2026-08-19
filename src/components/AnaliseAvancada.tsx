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
import {
  CalendarRange,
  Clock,
  Dices,
  History,
  Microscope,
  Target,
  TrendingDown,
} from "lucide-react";

import { useConcurso } from "@/services/hooks";
import { COMPOSICAO_PROVA, TOTAL_PROVA } from "@/lib/corte";
import { useStore } from "@/store/useStore";
import {
  anatomiaDoErro,
  assuntosPara,
  curvaDeCobertura,
  decisaoDeChute,
  diagnosticarRitmo,
  evolucaoPorJanelas,
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
  const concurso = useConcurso(concursoAtivoId);
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
    // A prova simulada é a do EDITAL (70 questões, 100 pontos), não o acervo.
    // Contar as questões do acervo simulava um caderno de 263 questões e
    // devolvia nota acima de 150 — número impossível, na escala errada.
    const porDisciplina = COMPOSICAO_PROVA.map((d) => {
      const respostas = doConcurso.filter((h) => h.disciplinaId === d.disciplinaId);
      return {
        questoesNaProva: d.questoes,
        valorPorQuestao: d.valorPorQuestao,
        respondidas: respostas.length,
        // Disciplina sem histórico entra pelo acaso puro, igual à projeção do
        // corte: 0% inventaria um desastre em quem só não respondeu ainda.
        taxaAcerto: respostas.length
          ? respostas.filter((r) => r.correta).length / respostas.length
          : 0.2,
      };
    });

    const suficiente = porDisciplina.reduce((a, d) => a + d.respondidas, 0) >= MINIMO_PARA_SIMULAR;
    if (!suficiente) return null;
    return simularNota(porDisciplina, { descontaErro: questoes.some((q) => q.pontuacaoLiquida) });
  }, [questoes, doConcurso]);

  const chute = decisaoDeChute(questoes.some((q) => q.pontuacaoLiquida));

  // ------------------------------------------------------------ anatomia do erro
  const anatomia = useMemo(() => anatomiaDoErro(doConcurso), [doConcurso]);

  // ------------------------------------------------------------ evolução
  const evolucao = useMemo(() => evolucaoPorJanelas(doConcurso, new Date()), [doConcurso]);

  // ------------------------------------------------------------ retrospectiva
  // Fechamento de período do IAZAN traduzido para estudo (ADR-017): o retrato
  // dos últimos 30 dias contra os 30 anteriores, tudo derivado do histórico
  // datado — nada é gravado.
  const retro = useMemo(() => {
    const agora = Date.now();
    const corte1 = agora - 30 * 86_400_000;
    const corte2 = agora - 60 * 86_400_000;

    const janela = (de: number, ate: number) => {
      const respostas = doConcurso.filter((h) => {
        const t = new Date(h.data).getTime();
        return t >= de && t < ate;
      });
      return {
        respostas: respostas.length,
        diasAtivos: new Set(respostas.map((h) => h.data.slice(0, 10))).size,
      };
    };

    // Assunto "iniciado" = a primeira resposta dele na vida caiu nesta janela.
    const primeiraPorUnidade = new Map<string, number>();
    const porId = new Map(questoes.map((q) => [q.id, q]));
    for (const h of doConcurso) {
      const unidade = porId.get(h.questaoId)?.subtopicoId ?? porId.get(h.questaoId)?.topicoId;
      if (!unidade) continue;
      const t = new Date(h.data).getTime();
      if (!primeiraPorUnidade.has(unidade) || t < primeiraPorUnidade.get(unidade)!) {
        primeiraPorUnidade.set(unidade, t);
      }
    }
    const iniciados = [...primeiraPorUnidade.values()].filter((t) => t >= corte1).length;

    return { atual: janela(corte1, agora + 1), anterior: janela(corte2, corte1), iniciados };
  }, [doConcurso, questoes]);

  const nomeDaDisciplina = (id: string) => disciplinas.find((d) => d.id === id)?.nome ?? id;

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
                <strong className="text-foreground">{simulacao.p15.toFixed(1)}</strong> e{" "}
                <strong className="text-foreground">{simulacao.p85.toFixed(1)}</strong> pontos de{" "}
                {TOTAL_PROVA}, com mediana em <strong>{simulacao.mediana.toFixed(1)}</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                {simulacao.simulacoes.toLocaleString("pt-BR")} simulações sobre a prova do edital
                (70 questões, {TOTAL_PROVA} pontos), a partir do seu acerto por disciplina. É uma
                faixa, e não uma previsão: ela se estreita conforme você responde mais. Disciplina
                que você ainda não treinou entra pelo acaso puro (20%), então a faixa sobe sozinha
                assim que você começa a respondê-la.
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

      {/* -------------------------------------------------- retrospectiva */}
      {retro.atual.respostas + retro.anterior.respostas > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarRange className="h-4 w-4 text-muted-foreground" />
              Retrospectiva — últimos 30 dias
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-sm">
              <strong>{retro.atual.respostas}</strong>{" "}
              {retro.atual.respostas === 1 ? "questão respondida" : "questões respondidas"} em{" "}
              <strong>{retro.atual.diasAtivos}</strong>{" "}
              {retro.atual.diasAtivos === 1 ? "dia ativo" : "dias ativos"} ·{" "}
              <strong>{retro.iniciados}</strong>{" "}
              {retro.iniciados === 1 ? "assunto novo iniciado" : "assuntos novos iniciados"}.
            </p>
            <p className="text-xs text-muted-foreground">
              Nos 30 dias anteriores:{" "}
              {retro.anterior.respostas > 0
                ? `${retro.anterior.respostas} questões em ${retro.anterior.diasAtivos} dias ativos.`
                : "sem dados — nenhuma resposta registrada na janela."}{" "}
              Volume não é qualidade — a evolução de acerto está no cartão abaixo, com faixa.
            </p>
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------- anatomia do erro */}
      {anatomia.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Microscope className="h-4 w-4 text-muted-foreground" />
              Anatomia do erro
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Errar com convicção (raciocínio escrito que não bateu) é conceito aprendido errado —
              pede <strong>teoria</strong>. Errar chutando é lacuna de conteúdo — pede{" "}
              <strong>cobertura</strong>. A taxa de acerto sozinha não separa os dois.
            </p>
            {anatomia.map((a) => {
              const pctConviccao = Math.round((a.conviccaoErrada / a.erros) * 100);
              return (
                <div key={a.disciplinaId} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold">{nomeDaDisciplina(a.disciplinaId)}</p>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {a.erros} erros: {a.conviccaoErrada} com convicção · {a.chuteErrado}{" "}
                      {a.chuteErrado === 1 ? "chute" : "chutes"}
                    </p>
                  </div>
                  <Progress value={pctConviccao} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">
                    {pctConviccao >= 50
                      ? `A maioria dos erros aqui é de convicção (${pctConviccao}%): revisite a teoria antes de fazer mais questões.`
                      : `A maioria dos erros aqui é chute (${100 - pctConviccao}%): falta cobertura — vale mais ver a teoria dos assuntos que você ainda não estudou do que refazer questões.`}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------- evolução */}
      {evolucao.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <History className="h-4 w-4 text-muted-foreground" />
              Evolução — últimos 30 dias × os 30 anteriores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {evolucao.map((e) => (
              <div key={e.disciplinaId} className="space-y-0.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold">{nomeDaDisciplina(e.disciplinaId)}</p>
                  {/* A seta só aparece quando as faixas nem se encostam:
                      sobreposição é "sem mudança detectável", não "+3%". */}
                  {e.tendencia !== "indefinida" && (
                    <Badge variant={e.tendencia === "melhorou" ? "default" : "destructive"}>
                      {e.tendencia === "melhorou" ? "▲ melhorou" : "▼ piorou"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Antes:{" "}
                  {e.anterior ? (
                    <>
                      {Math.round((e.anterior.acertos / e.anterior.respondidas) * 100)}% (
                      {e.anterior.acertos}/{e.anterior.respondidas}, faixa{" "}
                      {Math.round(e.anterior.min * 100)}–{Math.round(e.anterior.max * 100)}%)
                    </>
                  ) : (
                    <em>sem dados — menos de 10 respostas na janela</em>
                  )}{" "}
                  · Agora:{" "}
                  {e.recente ? (
                    <>
                      {Math.round((e.recente.acertos / e.recente.respondidas) * 100)}% (
                      {e.recente.acertos}/{e.recente.respondidas}, faixa{" "}
                      {Math.round(e.recente.min * 100)}–{Math.round(e.recente.max * 100)}%)
                    </>
                  ) : (
                    <em>sem dados — menos de 10 respostas na janela</em>
                  )}
                </p>
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Ausência de seta não é estagnação: com estas amostras, uma diferença pequena não é
              distinguível de sorte. Sem dados é diferente de zero.
            </p>
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
        {/*
          O edital não divide todas as disciplinas com a mesma granularidade, e a
          curva sente isso: Inglês tem um tópico só, que absorve as 35 questões e
          sobe ao topo, enquanto Português está fatiada em muitos e cada pedaço
          parece pequeno. Isso é do edital, não do seu desempenho — e sem o aviso
          a lista sugere uma prioridade que ela não mediu.
        */}
        <p className="text-xs text-muted-foreground">
          Compare com cuidado assuntos de disciplinas diferentes: o edital fatia umas em muitos
          tópicos e outras em um só. Inglês aparece no topo porque tem um tópico único levando as 35
          questões, não porque cai mais que Português.
        </p>
      </CardContent>
    </Card>
  );
}
