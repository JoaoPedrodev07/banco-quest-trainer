/**
 * Aula de uma unidade do edital: mostra a que já existe, ou conduz a geração.
 *
 * O app **não chama LLM** — não há chave de API no projeto, por decisão. O ciclo
 * é: o app monta o prompt (com as questões reais da banca, que é o contexto que
 * uma IA de fora não tem), o usuário gera de graça onde quiser, e cola a resposta
 * de volta. A partir daí a aula vive no acervo e é leitura direta.
 *
 * Por isso o botão tem dois estados, como a spec pede: "Ver aula" quando já
 * existe, "Gerar aula" quando não.
 */

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BookOpen, Check, Copy, Dumbbell, Save, Sparkles, Youtube } from "lucide-react";
import { toast } from "sonner";

import { useConcurso, useQuestoes, useSalvarAula } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { PROMPT_AULA_VERSAO, linkYouTube, montarPromptEstudo } from "@/lib/promptEstudo";
import { Markdown, AvisoGerado } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Aula, Disciplina } from "@/types";

interface Props {
  disciplina: Disciplina;
  topicoNome: string;
  unidadeId: string;
  unidadeNome: string;
  /** true quando a unidade é o próprio tópico (disciplina sem subdivisão no edital). */
  ehTopico: boolean;
  aula?: Aula;
  /** Destaca o botão: o dashboard aponta os assuntos onde o desempenho é pior. */
  prioritario?: boolean;
  /**
   * Abre o diálogo sozinho ao montar. É como `/edital?unidade=<id>` leva direto
   * à aula — o caminho que a tela de Revisões usa para o candidato cair no
   * assunto que errou, em vez de na lista inteira.
   */
  abrirAoChegar?: boolean;
}

export function AulaSubtopico({
  disciplina,
  topicoNome,
  unidadeId,
  unidadeNome,
  ehTopico,
  aula,
  prioritario = false,
  abrirAoChegar = false,
}: Props) {
  const [aberto, setAberto] = useState(abrirAoChegar);
  const [copiado, setCopiado] = useState(false);
  const [rascunho, setRascunho] = useState("");

  // O estado inicial cobre o caso normal (o componente nasce já com a ordem de
  // abrir). Este efeito cobre o outro: a disciplina já estava expandida, o
  // componente já existia, e a ordem chegou depois — aí não há montagem nova
  // para o valor inicial pegar.
  useEffect(() => {
    if (abrirAoChegar) setAberto(true);
  }, [abrirAoChegar]);
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  // Já recortadas pelo backend (ADR-018) — o peso do assunto se mede dentro do
  // concurso em foco, nunca no acervo inteiro.
  const { questoes } = useQuestoes(concursoAtivoId);
  const concurso = useConcurso(concursoAtivoId);
  const salvar = useSalvarAula(concursoAtivoId);

  const questoesDoAssunto = useMemo(
    () =>
      questoes.filter((q) => (ehTopico ? q.topicoId === unidadeId : q.subtopicoId === unidadeId)),
    [questoes, unidadeId, ehTopico],
  );

  // O peso do assunto se mede dentro da disciplina, não no acervo inteiro: o
  // acervo mistura cargos, e "3 de 271" seria um número sem sentido.
  const daDisciplina = useMemo(
    () => questoes.filter((q) => q.disciplinaId === disciplina.id),
    [questoes, disciplina.id],
  );

  const prompt = useMemo(() => {
    if (!concurso) return "";
    return montarPromptEstudo({
      disciplina,
      topicoNome,
      subtopicoNome: ehTopico ? null : unidadeNome,
      subtopicoId: unidadeId,
      concurso,
      questoes: questoesDoAssunto,
      totalDaDisciplina: daDisciplina.length,
      naoClassificadasNaDisciplina: daDisciplina.filter((q) => !q.topicoId).length,
    });
  }, [
    concurso,
    disciplina,
    topicoNome,
    unidadeNome,
    unidadeId,
    ehTopico,
    questoesDoAssunto,
    daDisciplina,
  ]);

  if (!concurso) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Prompt copiado", { description: "Cole numa IA gratuita e traga a resposta." });
    } catch {
      // clipboard exige contexto seguro; sem ele o texto continua na tela para
      // seleção manual, então o fluxo não trava.
      toast.error("Não consegui copiar", { description: "Selecione o texto e copie manualmente." });
    }
  };

  const guardar = () => {
    const texto = rascunho.trim();
    if (!texto) return;
    salvar.mutate(
      {
        unidadeId,
        concursoId: concursoAtivoId,
        conteudoMarkdown: texto,
        modelo: "",
        promptVersao: PROMPT_AULA_VERSAO,
      },
      {
        onSuccess: () => {
          setRascunho("");
          toast.success("Aula salva", { description: "Fica guardada; não precisa gerar de novo." });
        },
        onError: (erro) =>
          toast.error("Não consegui salvar a aula", {
            description:
              erro instanceof Error && erro.message.includes("Failed to fetch")
                ? "O backend não respondeu. Confira se ele está rodando na porta 8000."
                : String(erro),
          }),
      },
    );
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={aula ? "secondary" : "ghost"}
          className={cn(
            "h-7 gap-1 px-2 text-xs transition-colors",
            !aula && "text-muted-foreground hover:text-foreground",
            prioritario && !aula && "text-primary hover:text-primary",
          )}
        >
          {aula ? <BookOpen className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
          {aula ? "Ver aula" : "Gerar aula"}
        </Button>
      </DialogTrigger>

      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base leading-snug">{unidadeNome}</DialogTitle>
          <DialogDescription>
            {disciplina.nome}
            {questoesDoAssunto.length > 0 ? (
              <>
                {" · "}
                <strong>{questoesDoAssunto.length}</strong>{" "}
                {questoesDoAssunto.length === 1 ? "questão real" : "questões reais"} deste assunto
              </>
            ) : (
              " · nenhuma questão deste assunto classificada ainda"
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          {aula ? (
            <>
              <AvisoGerado oQue="conteúdo" />
              <Markdown>{aula.conteudoMarkdown}</Markdown>
              {/* Fecha o ciclo: leu a teoria, treina o assunto sem passar pelo
                  filtro de disciplina inteira. Só aparece quando há questão real
                  classificada aqui — botão que abre simulado vazio é promessa falsa. */}
              {questoesDoAssunto.length > 0 && (
                <Button asChild size="sm" className="gap-1.5">
                  <Link to="/questoes" search={{ assunto: unidadeId }}>
                    <Dumbbell className="h-4 w-4" />
                    Treinar {questoesDoAssunto.length}{" "}
                    {questoesDoAssunto.length === 1 ? "questão" : "questões"} deste assunto
                  </Link>
                </Button>
              )}
              <p className="border-t border-border pt-3 text-xs text-muted-foreground">
                {aula.versao ? `Versão ${aula.versao} · salva` : "Salva"} em{" "}
                {new Date(aula.geradoEm).toLocaleString("pt-BR")}. Para trocar, cole uma nova versão
                abaixo — esta fica guardada como histórico, nada se perde.
              </p>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold">1. Copie o prompt</p>
                <p className="text-xs text-muted-foreground">
                  Ele já inclui as questões reais da banca sobre este assunto — é o que faz a IA
                  acertar o nível em vez de chutar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={copiar} size="sm" className="gap-1.5">
                    {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copiado ? "Copiado" : "Copiar prompt"}
                  </Button>
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <a
                      href={linkYouTube(unidadeNome, disciplina.nome, concurso.banca)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Youtube className="h-4 w-4" />
                      YouTube
                    </a>
                  </Button>
                </div>
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
                  {prompt}
                </pre>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">2. Cole a resposta da IA aqui</p>
                <Textarea
                  value={rascunho}
                  onChange={(e) => setRascunho(e.target.value)}
                  placeholder="Cole aqui o texto que a IA gerou…"
                  className="min-h-32 font-mono text-xs"
                />
                <AvisoGerado oQue="conteúdo" />
              </div>
            </>
          )}
        </div>

        {/* Um único campo de texto para os dois casos: quando não há aula ele já
            está acima (passo 2); quando há, aparece aqui para substituir. */}
        <div className="shrink-0 space-y-2 border-t border-border pt-3">
          {aula && (
            <Textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              placeholder="Colar uma nova versão para substituir esta aula…"
              className="min-h-16 font-mono text-xs"
            />
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={guardar}
              disabled={!rascunho.trim() || salvar.isPending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {salvar.isPending ? "Salvando…" : aula ? "Substituir aula" : "Salvar aula"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Fica guardada no acervo — você não precisa gerar de novo.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
