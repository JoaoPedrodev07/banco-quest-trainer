/**
 * Gabarito comentado de uma questão.
 *
 * A banca publica a letra certa, nunca o raciocínio — e o que faz perder ponto é
 * não saber **por que as outras quatro estão erradas**. Este componente cobre
 * essa lacuna pelo mesmo caminho da aula: o app monta o prompt com a questão
 * inteira, o usuário gera numa IA gratuita e cola de volta, e o comentário fica
 * guardado no acervo, colado à questão.
 */

import { useState } from "react";
import { Check, Copy, MessageSquarePlus, Save } from "lucide-react";
import { toast } from "sonner";

import { useComentarGabarito, useConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { montarPromptGabarito } from "@/lib/promptEstudo";
import { Markdown, AvisoGerado } from "@/components/Markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Questao } from "@/types";

export function GabaritoComentado({
  questao,
  disciplinaNome,
}: {
  questao: Questao;
  disciplinaNome: string;
}) {
  const [montando, setMontando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const concurso = useConcurso(concursoAtivoId);
  const comentar = useComentarGabarito();

  const prompt = montarPromptGabarito(questao, disciplinaNome, concurso?.banca ?? null);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
      toast.success("Prompt copiado", { description: "Cole numa IA gratuita e traga a resposta." });
    } catch {
      toast.error("Não consegui copiar", { description: "Selecione o texto e copie manualmente." });
    }
  };

  const guardar = () => {
    const texto = rascunho.trim();
    if (!texto) return;
    comentar.mutate(
      { questaoId: questao.id, explicacao: texto },
      {
        onSuccess: () => {
          setRascunho("");
          setMontando(false);
          toast.success("Comentário salvo", { description: "Fica junto da questão no acervo." });
        },
        onError: (erro) =>
          toast.error("Não consegui salvar", {
            description:
              erro instanceof Error && erro.message.includes("Failed to fetch")
                ? "O backend não respondeu. Confira se ele está rodando na porta 8000."
                : String(erro),
          }),
      },
    );
  };

  if (questao.explicacao) {
    return (
      <div className="space-y-2">
        <p className="text-sm font-bold">Gabarito comentado</p>
        <AvisoGerado oQue="comentário" />
        <Markdown>{questao.explicacao}</Markdown>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Gabarito oficial:{" "}
        <strong className="text-foreground">{questao.correta || "anulada"}</strong>. A banca publica
        a letra, não a explicação.
      </p>

      {!montando ? (
        <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setMontando(true)}>
          <MessageSquarePlus className="h-4 w-4" />
          Montar gabarito comentado
        </Button>
      ) : (
        <div className="space-y-2">
          <Button size="sm" onClick={copiar} className="gap-1.5">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar prompt"}
          </Button>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-2 text-[11px] leading-relaxed">
            {prompt}
          </pre>
          <Textarea
            value={rascunho}
            onChange={(e) => setRascunho(e.target.value)}
            placeholder="Cole aqui a explicação que a IA gerou…"
            className="min-h-24 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={guardar}
              disabled={!rascunho.trim() || comentar.isPending}
              className="gap-1.5"
            >
              <Save className="h-4 w-4" />
              {comentar.isPending ? "Salvando…" : "Salvar comentário"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMontando(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
