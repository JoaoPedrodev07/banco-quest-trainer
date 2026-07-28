/**
 * Entrega o prompt de estudo de um subtópico para o usuário levar a uma IA de
 * fora ou ao YouTube.
 *
 * Não existe LLM aqui e não vai existir: o app não chama API paga. O valor que
 * ele agrega é o contexto que a IA de fora não tem — o subtópico exato do edital
 * mais as questões reais da banca já classificadas naquele assunto.
 */

import { useMemo, useState } from "react";
import { Copy, Check, Sparkles, Youtube } from "lucide-react";
import { toast } from "sonner";

import { concursoPorId } from "@/data/concursos";
import { useQuestoes } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { linkYouTube, montarPromptEstudo } from "@/lib/promptEstudo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Disciplina } from "@/types";

interface Props {
  disciplina: Disciplina;
  topicoNome: string;
  subtopicoId: string;
  subtopicoNome: string;
  /** true quando o "subtópico" é na verdade o próprio tópico (disciplina sem subdivisão). */
  ehTopico: boolean;
}

export function PromptEstudo({
  disciplina,
  topicoNome,
  subtopicoId,
  subtopicoNome,
  ehTopico,
}: Props) {
  const [aberto, setAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { questoes } = useQuestoes();
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const concurso = concursoPorId(concursoAtivoId);

  const questoesDoAssunto = useMemo(
    () =>
      questoes.filter((q) =>
        ehTopico ? q.topicoId === subtopicoId : q.subtopicoId === subtopicoId,
      ),
    [questoes, subtopicoId, ehTopico],
  );

  // O peso do assunto se mede dentro da disciplina, não no acervo inteiro: o
  // acervo mistura cargos, e "3 de 271" seria um número sem sentido para quem
  // vai fazer a prova de TI.
  const daDisciplina = useMemo(
    () => questoes.filter((q) => q.disciplinaId === disciplina.id),
    [questoes, disciplina.id],
  );

  const prompt = useMemo(() => {
    if (!concurso) return "";
    return montarPromptEstudo({
      disciplina,
      topicoNome,
      subtopicoNome: ehTopico ? null : subtopicoNome,
      subtopicoId,
      concurso,
      questoes: questoesDoAssunto,
      totalDaDisciplina: daDisciplina.length,
      naoClassificadasNaDisciplina: daDisciplina.filter((q) => !q.topicoId).length,
    });
  }, [
    concurso,
    disciplina,
    topicoNome,
    subtopicoNome,
    subtopicoId,
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
      toast.success("Prompt copiado", { description: "Cole numa IA gratuita para gerar a aula." });
    } catch {
      // clipboard exige contexto seguro e permissão; sem isso o texto continua
      // visível na tela para seleção manual, então o fluxo não trava.
      toast.error("Não consegui copiar", { description: "Selecione o texto e copie manualmente." });
    }
  };

  return (
    <Dialog open={aberto} onOpenChange={setAberto}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5" />
          Estudar
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="pr-6 text-base leading-snug">{subtopicoNome}</DialogTitle>
          <DialogDescription>
            {questoesDoAssunto.length > 0 ? (
              <>
                Prompt com <strong>{questoesDoAssunto.length}</strong>{" "}
                {questoesDoAssunto.length === 1 ? "questão real" : "questões reais"} deste assunto.
              </>
            ) : (
              <>
                Nenhuma questão deste assunto foi classificada ainda — o prompt sai sem exemplo da
                banca e fica mais fraco.
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button onClick={copiar} className="gap-1.5">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar prompt"}
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <a
              href={linkYouTube(subtopicoNome, disciplina.nome, concurso.banca)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Youtube className="h-4 w-4" />
              Buscar no YouTube
            </a>
          </Button>
        </div>

        <pre className="max-h-[45vh] overflow-auto whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-xs leading-relaxed">
          {prompt}
        </pre>

        <p className="text-xs text-muted-foreground">
          O texto que a IA devolver é <strong>conteúdo gerado</strong>, não material da banca —
          confira contra o edital oficial antes de estudar por ele.
        </p>
      </DialogContent>
    </Dialog>
  );
}
