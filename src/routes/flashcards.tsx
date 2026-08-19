import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Eye, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AvisoAcervo } from "@/components/AvisoAcervo";
import { Markdown, AvisoGerado, TextoDaQuestao } from "@/components/Markdown";
import { useAcervoDoConcurso } from "@/services/hooks";
import { SemAcervo } from "@/components/SemAcervo";
import { useStore, type CartaoProprio } from "@/store/useStore";
import { disciplinasDoCargo } from "@/lib/incidencia";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

/** Quantos cartões entram numa sessão. */
const TAMANHO_DO_BARALHO = 20;

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

/**
 * Um cartão do baralho: questão do acervo ou cartão próprio (ADR-010). O id é a
 * chave do SRS nos dois casos — id de questão e de cartão próprio nunca colidem
 * (prefixos diferentes).
 */
type Cartao =
  | { tipo: "questao"; id: string; disciplinaId: string; questao: Questao }
  | { tipo: "proprio"; id: string; disciplinaId: string; proprio: CartaoProprio };

function FlashcardsPage() {
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  // O concurso sai do mesmo hook do acervo (ADR-015), mais abaixo.
  const registrarResposta = useStore((s) => s.registrarResposta);
  const agendarRevisaoPorErro = useStore((s) => s.agendarRevisaoPorErro);
  const flashcardsSrs = useStore((s) => s.flashcardsSrs);
  const julgarFlashcard = useStore((s) => s.julgarFlashcard);
  const cartoesProprios = useStore((s) => s.cartoesProprios);
  const criarCartao = useStore((s) => s.criarCartao);
  const removerCartao = useStore((s) => s.removerCartao);
  const { concurso, disciplinas, questoes, provas, vazio } = useAcervoDoConcurso(concursoAtivoId);

  const [disciplinaId, setDisciplinaId] = useState("todas");
  const [baralho, setBaralho] = useState<Cartao[]>([]);
  const [indice, setIndice] = useState(0);
  const [revelado, setRevelado] = useState(false);
  const [acertos, setAcertos] = useState(0);

  // Form de cartão próprio.
  const [frente, setFrente] = useState("");
  const [verso, setVerso] = useState("");
  const [disciplinaDoCartao, setDisciplinaDoCartao] = useState("");

  const escopo = useMemo(
    () => (concurso ? disciplinasDoCargo(concurso, provas, questoes) : new Set<string>()),
    [concurso, provas, questoes],
  );

  const meusCartoes = useMemo(
    () =>
      cartoesProprios.filter(
        (c) =>
          c.concursoId === concursoAtivoId &&
          (disciplinaId === "todas" || c.disciplinaId === disciplinaId),
      ),
    [cartoesProprios, concursoAtivoId, disciplinaId],
  );

  const candidatas = useMemo<Cartao[]>(() => {
    const deQuestao: Cartao[] = questoes
      .filter(
        (q) =>
          ehTeorica(q) &&
          (!escopo.size || escopo.has(q.disciplinaId)) &&
          (disciplinaId === "todas" || q.disciplinaId === disciplinaId),
      )
      .map((q) => ({ tipo: "questao", id: q.id, disciplinaId: q.disciplinaId, questao: q }));
    const proprios: Cartao[] = meusCartoes.map((c) => ({
      tipo: "proprio",
      id: c.id,
      disciplinaId: c.disciplinaId,
      proprio: c,
    }));
    return [...deQuestao, ...proprios];
  }, [questoes, escopo, disciplinaId, meusCartoes]);

  // Composição do baralho (ADR-010): primeiro os VENCIDOS, depois os NOVOS.
  // Cartão em dia não entra — revisar antes da hora é o desperdício que o SRS
  // existe para evitar.
  const composicao = useMemo(() => {
    const agora = Date.now();
    const vencidos: Cartao[] = [];
    const novos: Cartao[] = [];
    let emDia = 0;
    for (const c of candidatas) {
      const srs = flashcardsSrs[c.id];
      if (!srs) novos.push(c);
      else if (new Date(srs.proxima).getTime() <= agora) vencidos.push(c);
      else emDia++;
    }
    return { vencidos, novos, emDia };
  }, [candidatas, flashcardsSrs]);

  const disciplinasDisponiveis = useMemo(
    () =>
      disciplinas.filter(
        (d) =>
          (!escopo.size || escopo.has(d.id)) &&
          (questoes.some((q) => q.disciplinaId === d.id && ehTeorica(q)) ||
            cartoesProprios.some(
              (c) => c.concursoId === concursoAtivoId && c.disciplinaId === d.id,
            )),
      ),
    [disciplinas, escopo, questoes, cartoesProprios, concursoAtivoId],
  );

  const montar = (cartas: Cartao[]) => {
    setBaralho(cartas);
    setIndice(0);
    setRevelado(false);
    setAcertos(0);
  };

  const comecar = () =>
    montar(
      [...embaralhar(composicao.vencidos), ...embaralhar(composicao.novos)].slice(
        0,
        TAMANHO_DO_BARALHO,
      ),
    );

  /** Tudo em dia e nada novo: treinar mesmo assim, fora da agenda. */
  const comecarForaDaAgenda = () => montar(embaralhar(candidatas).slice(0, TAMANHO_DO_BARALHO));

  const carta = baralho[indice];

  const julgar = (acertou: boolean) => {
    // O SRS move para os dois tipos de cartão: é ele que decide quando este
    // cartão volta (lembrou avança a escada; não lembrou regride para 1 dia).
    julgarFlashcard(carta.id, acertou);

    if (carta.tipo === "questao") {
      // O flashcard de questão alimenta o mesmo histórico do simulado: acerto é
      // acerto, e manter dois placares separados faria a análise de pontos
      // fracos divergir do que a pessoa de fato praticou. Cartão próprio NÃO
      // entra aqui — não é questão do acervo (ADR-010).
      registrarResposta({
        questaoId: carta.id,
        disciplinaId: carta.disciplinaId,
        concursoId: concursoAtivoId,
        escolhida: acertou ? carta.questao.correta : "",
        correta: acertou,
        data: new Date().toISOString(),
      });
      // "Não lembrei" é erro para todos os efeitos: agenda a revisão do assunto.
      const unidadeId = carta.questao.subtopicoId ?? carta.questao.topicoId;
      if (!acertou && unidadeId) {
        const disciplina = disciplinas.find((d) => d.id === carta.disciplinaId);
        const nome =
          disciplina?.topicos
            .flatMap((t) => [{ id: t.id, nome: t.nome }, ...t.subtopicos])
            .find((u) => u.id === unidadeId)?.nome ?? unidadeId;
        agendarRevisaoPorErro({
          unidadeId,
          topico: nome,
          disciplinaId: carta.disciplinaId,
          concursoId: concursoAtivoId,
        });
      }
    }

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
    const doBaralho = Math.min(
      TAMANHO_DO_BARALHO,
      composicao.vencidos.length + composicao.novos.length,
    );
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black md:text-3xl">Flashcards</h1>
          <p className="text-sm text-muted-foreground">
            Recordação ativa com agenda espaçada: cartão errado volta amanhã, cartão lembrado se
            afasta (1 → 7 → 15 → 30 dias).
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

            {/* A composição fica visível para o baralho não parecer sorteio:
                o que vence hoje entra primeiro, o que está em dia espera. */}
            <p className="text-sm text-muted-foreground">
              Hoje: <strong className="text-foreground">{composicao.vencidos.length}</strong>{" "}
              {composicao.vencidos.length === 1 ? "cartão vencido" : "cartões vencidos"} +{" "}
              <strong className="text-foreground">{composicao.novos.length}</strong> novos
              {composicao.emDia > 0 &&
                ` · ${composicao.emDia} em dia ficam de fora (revisar antes da hora desperdiça a agenda)`}
              . Questões com texto de apoio, cálculo ou código ficam de fora — não se respondem de
              memória.
            </p>

            {doBaralho > 0 ? (
              <Button size="lg" className="w-full" onClick={comecar}>
                Começar ({doBaralho} {doBaralho === 1 ? "cartão" : "cartões"})
              </Button>
            ) : candidatas.length > 0 ? (
              <div className="space-y-2">
                <p className="rounded-md border border-sucesso/40 bg-sucesso-suave p-3 text-sm">
                  Tudo em dia — nenhum cartão vencido e nenhum novo. É assim que uma agenda espaçada
                  deve ficar; volte quando algo vencer.
                </p>
                <Button variant="outline" className="w-full" onClick={comecarForaDaAgenda}>
                  Treinar mesmo assim (fora da agenda)
                </Button>
              </div>
            ) : (
              <Button size="lg" className="w-full" disabled>
                Nenhum cartão disponível
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Cartões próprios (ADR-010): frente/verso para o que questão não
            cobre bem — definição, lei seca, sigla. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Meus cartões ({meusCartoes.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Frente (a pergunta)</Label>
                <Textarea
                  value={frente}
                  onChange={(e) => setFrente(e.target.value)}
                  placeholder="O que diz o princípio da impessoalidade?"
                  className="min-h-20 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Verso (a resposta)</Label>
                <Textarea
                  value={verso}
                  onChange={(e) => setVerso(e.target.value)}
                  placeholder="A resposta que você quer conseguir lembrar de cabeça."
                  className="min-h-20 text-sm"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={disciplinaDoCartao} onValueChange={setDisciplinaDoCartao}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Disciplina do cartão" />
                </SelectTrigger>
                <SelectContent>
                  {disciplinas.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                className="gap-1.5"
                disabled={!frente.trim() || !verso.trim() || !disciplinaDoCartao}
                onClick={() => {
                  criarCartao({
                    id: `meu-${Date.now()}`,
                    frente: frente.trim(),
                    verso: verso.trim(),
                    disciplinaId: disciplinaDoCartao,
                    concursoId: concursoAtivoId,
                  });
                  setFrente("");
                  setVerso("");
                  toast.success("Cartão criado", {
                    description: "Entra no próximo baralho como cartão novo.",
                  });
                }}
              >
                <Plus className="h-4 w-4" />
                Criar cartão
              </Button>
            </div>

            {meusCartoes.length > 0 && (
              <details className="rounded-md border border-border p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  Ver os {meusCartoes.length} cartões
                </summary>
                <div className="mt-2 space-y-2">
                  {meusCartoes.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-start justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{c.frente}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.verso}</p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removerCartao(c.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </details>
            )}
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
                ? "Esse assunto está firme. Os cartões lembrados se afastaram na agenda."
                : taxa >= 50
                  ? "Metade do caminho. Os que falharam voltam amanhã — repetir amanhã vale mais do que insistir hoje."
                  : "Ainda não fixou — e descobrir isso agora é melhor do que na prova. Tudo que falhou volta amanhã."}
            </p>
            <div className="flex justify-center gap-2">
              <Button onClick={() => setBaralho([])} className="gap-1.5">
                <RotateCcw className="h-4 w-4" />
                Voltar aos baralhos
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
        <div className="flex items-center gap-2">
          {carta.tipo === "proprio" && <Badge variant="outline">cartão seu</Badge>}
          <Badge>{disciplina?.nome ?? carta.disciplinaId}</Badge>
        </div>
      </div>

      <Card className="min-h-64">
        <CardContent className="space-y-4 p-6">
          {carta.tipo === "questao" ? (
            <>
              <p className="text-xs text-muted-foreground">
                {carta.questao.banca} · {carta.questao.ano}
              </p>
              <TextoDaQuestao className="block text-base leading-relaxed">
                {carta.questao.enunciado}
              </TextoDaQuestao>
            </>
          ) : (
            <TextoDaQuestao className="block whitespace-pre-line text-base leading-relaxed">
              {carta.proprio.frente}
            </TextoDaQuestao>
          )}

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
              {carta.tipo === "questao" ? (
                <>
                  {carta.questao.alternativas.map((a) => (
                    <div
                      key={a.letra}
                      className={
                        a.letra === carta.questao.correta
                          ? "rounded-md border border-primary bg-primary/5 p-2"
                          : "p-2 opacity-60"
                      }
                    >
                      <TextoDaQuestao className="text-sm">{`(${a.letra}) ${a.texto}`}</TextoDaQuestao>
                    </div>
                  ))}

                  {carta.questao.explicacao && (
                    <div className="space-y-2 rounded-md bg-muted p-3">
                      <AvisoGerado oQue="comentário" />
                      <Markdown>{carta.questao.explicacao}</Markdown>
                    </div>
                  )}
                </>
              ) : (
                <TextoDaQuestao className="block whitespace-pre-line rounded-md border border-primary bg-primary/5 p-3 text-sm leading-relaxed">
                  {carta.proprio.verso}
                </TextoDaQuestao>
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
