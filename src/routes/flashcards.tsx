import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Eye, RotateCcw, X } from "lucide-react";

import { AvisoAcervo } from "@/components/AvisoAcervo";
import { Markdown, AvisoGerado, TextoDaQuestao } from "@/components/Markdown";
import { concursoPorId } from "@/data/concursos";
import { useAcervoDoConcurso } from "@/services/hooks";
import { SemAcervo } from "@/components/SemAcervo";
import { useStore } from "@/store/useStore";
import { disciplinasDoCargo } from "@/lib/incidencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Questao } from "@/types";

export const Route = createFileRoute("/flashcards")({
  head: () => ({
    meta: [
      { title: "Flashcards — Foco BB TI 2026" },
      { name: "description", content: "Estude questões teóricas por recordação ativa." },
    ],
  }),
  component: FlashcardsPage,
});

/**
 * Questão "teórica" para efeito de flashcard: a que se responde por conhecimento
 * lembrado, não por cálculo ou leitura de um texto na hora.
 *
 * O critério é grosseiro de propósito e olha o **dado**, não a disciplina: uma
 * questão com texto de apoio exige reler o texto (não cabe em cartão), e uma com
 * código no enunciado é exercício de leitura, não de memória. O resto vira
 * cartão. Errar para o lado de incluir é melhor do que esconder assunto.
 */
function ehTeorica(q: Questao): boolean {
  if (q.textoBase) return false;
  if (q.anulada) return false;
  const enunciado = q.enunciado;
  // Sinais de questão de cálculo ou de código, que não se resolvem de memória.
  if (/[{};]|==|\bimport\b|\bpublic\b|\bdef\b|R\$\s?\d/.test(enunciado)) return false;
  return true;
}

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function FlashcardsPage() {
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const concurso = concursoPorId(concursoAtivoId);
  const registrarResposta = useStore((s) => s.registrarResposta);
  const { disciplinas, questoes, provas, vazio } = useAcervoDoConcurso(concursoAtivoId);

  const [disciplinaId, setDisciplinaId] = useState("todas");
  const [baralho, setBaralho] = useState<Questao[]>([]);
  const [indice, setIndice] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [acertos, setAcertos] = useState(0);

  const escopo = useMemo(
    () => (concurso ? disciplinasDoCargo(concurso, provas, questoes) : new Set<string>()),
    [concurso, provas, questoes],
  );

  const candidatas = useMemo(
    () =>
      questoes.filter(
        (q) =>
          ehTeorica(q) &&
          (!escopo.size || escopo.has(q.disciplinaId)) &&
          (disciplinaId === "todas" || q.disciplinaId === disciplinaId),
      ),
    [questoes, escopo, disciplinaId],
  );

  const disciplinasDisponiveis = useMemo(
    () =>
      disciplinas.filter(
        (d) =>
          (!escopo.size || escopo.has(d.id)) &&
          questoes.some((q) => q.disciplinaId === d.id && ehTeorica(q)),
      ),
    [disciplinas, escopo, questoes],
  );

  const comecar = () => {
    setBaralho(embaralhar(candidatas).slice(0, 20));
    setIndice(0);
    setRevelado(false);
    setAcertos(0);
  };

  const carta = baralho[indice];

  const julgar = (acertou: boolean) => {
    // O flashcard alimenta o mesmo histórico do simulado: acerto é acerto, e
    // manter dois placares separados faria a análise de pontos fracos divergir
    // do que a pessoa de fato praticou.
    registrarResposta({
      questaoId: carta.id,
      disciplinaId: carta.disciplinaId,
      concursoId: concursoAtivoId,
      escolhida: acertou ? carta.correta : "",
      correta: acertou,
      data: new Date().toISOString(),
    });
    if (acertou) setAcertos((a) => a + 1);
    if (indice + 1 < baralho.length) {
      setIndice(indice + 1);
      setRevelado(false);
    } else {
      setIndice(baralho.length); // marca o fim
    }
  };

  // ---------------------------------------------------------------- telas

  if (baralho.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            Recordação ativa: você tenta lembrar a resposta antes de ver as alternativas.
          </p>
        </div>

        <AvisoAcervo />

        {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="space-y-2">
              <p className="text-sm font-semibold">Disciplina</p>
              <Select value={disciplinaId} onValueChange={setDisciplinaId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  {disciplinasDisponiveis.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">{candidatas.length}</strong>{" "}
              {candidatas.length === 1
                ? "questão teórica disponível"
                : "questões teóricas disponíveis"}
              . Questões com texto de apoio, cálculo ou código ficam de fora — não se respondem de
              memória.
            </p>

            <Button
              size="lg"
              className="w-full"
              onClick={comecar}
              disabled={candidatas.length === 0}
            >
              Começar ({Math.min(20, candidatas.length)} cartões)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (indice >= baralho.length) {
    const taxa = Math.round((acertos / baralho.length) * 100);
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="space-y-4 p-6 text-center">
            <p className="text-sm text-muted-foreground">Baralho concluído</p>
            <p className="text-5xl font-black">{taxa}%</p>
            <p className="text-sm">
              {acertos} de {baralho.length} lembradas
            </p>
            <p className="text-sm text-muted-foreground">
              {taxa >= 80
                ? "Esse assunto está firme. Volte a ele em alguns dias para não perder."
                : taxa >= 50
                  ? "Metade do caminho. Repetir amanhã vale mais do que insistir hoje."
                  : "Ainda não fixou — e descobrir isso agora é melhor do que na prova."}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={comecar} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Outro baralho
              </Button>
              <Button asChild variant="outline">
                <Link to="/edital">Ver aulas do edital</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const disciplina = disciplinas.find((d) => d.id === carta.disciplinaId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary">
          {indice + 1} de {baralho.length}
        </Badge>
        <Badge>{disciplina?.nome ?? carta.disciplinaId}</Badge>
      </div>

      <Card className="min-h-64">
        <CardContent className="space-y-4 p-6">
          <p className="text-xs text-muted-foreground">
            {carta.banca} · {carta.ano}
          </p>
          <TextoDaQuestao className="block text-base leading-relaxed">
            {carta.enunciado}
          </TextoDaQuestao>

          {!revelado ? (
            <div className="space-y-3 pt-2">
              <p className="text-sm text-muted-foreground">
                Tente formular a resposta de cabeça antes de virar o cartão.
              </p>
              <Button onClick={() => setRevelado(true)} className="w-full gap-1.5">
                <Eye className="h-4 w-4" />
                Virar cartão
              </Button>
            </div>
          ) : (
            <div className="space-y-3 border-t border-border pt-4">
              {carta.alternativas.map((a) => (
                <div
                  key={a.letra}
                  className={
                    a.letra === carta.correta
                      ? "rounded-md border border-primary bg-primary/5 p-2"
                      : "p-2 opacity-60"
                  }
                >
                  <TextoDaQuestao className="text-sm">{`(${a.letra}) ${a.texto}`}</TextoDaQuestao>
                </div>
              ))}

              {carta.explicacao && (
                <div className="space-y-2 rounded-md bg-muted p-3">
                  <AvisoGerado oQue="comentário" />
                  <Markdown>{carta.explicacao}</Markdown>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => julgar(false)} className="flex-1 gap-1.5">
                  <X className="h-4 w-4" />
                  Não lembrei
                </Button>
                <Button onClick={() => julgar(true)} className="flex-1 gap-1.5">
                  <Check className="h-4 w-4" />
                  Lembrei
                </Button>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Seja honesto: marcar "lembrei" no que você só reconheceu é o jeito mais rápido de a
                análise de pontos fracos parar de servir.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {!revelado && (
        <Button variant="ghost" size="sm" onClick={() => julgar(false)} className="gap-1.5">
          Pular
          <ArrowRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
