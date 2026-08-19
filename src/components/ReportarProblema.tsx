/**
 * Reportar problema numa questão (ADR-014).
 *
 * O acervo vem de parser de PDF, e defeito de importação já aconteceu. Quem
 * percebe gabarito errado ou enunciado truncado no meio do estudo reporta daqui;
 * o report vai para a fila de curadoria (tela de Classificação) e **não muda a
 * questão** — corrigir sem conferir o PDF seria pior que o defeito.
 */

import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";

import { useReportarProblema } from "@/services/hooks";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { TipoProblema } from "@/types";

const TIPOS: { valor: TipoProblema; rotulo: string }[] = [
  { valor: "gabarito_errado", rotulo: "Gabarito errado" },
  { valor: "enunciado_incompleto", rotulo: "Enunciado incompleto ou truncado" },
  { valor: "alternativa_faltando", rotulo: "Alternativa faltando ou vazia" },
  { valor: "classificacao_errada", rotulo: "Assunto/classificação errada" },
  { valor: "outro", rotulo: "Outro" },
];

export function ReportarProblema({ questaoId }: { questaoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [tipo, setTipo] = useState<TipoProblema | "">("");
  const [descricao, setDescricao] = useState("");
  const reportar = useReportarProblema();

  const enviar = () => {
    if (!tipo) return;
    reportar.mutate(
      { questaoId, tipo, descricao: descricao.trim() },
      {
        onSuccess: () => {
          setAberto(false);
          setTipo("");
          setDescricao("");
          toast.success("Problema reportado", {
            description: "Entrou na fila de curadoria. A questão só muda depois de conferida.",
          });
        },
        onError: (erro) =>
          toast.error("Não consegui reportar", {
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
          variant="ghost"
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <Flag className="h-3.5 w-3.5" />
          Reportar problema
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar problema nesta questão</DialogTitle>
          <DialogDescription>
            O report entra na fila de curadoria — nada muda na questão até alguém conferir contra o
            PDF original.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Select value={tipo} onValueChange={(v) => setTipo(v as TipoProblema)}>
            <SelectTrigger>
              <SelectValue placeholder="Qual é o problema?" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.valor} value={t.valor}>
                  {t.rotulo}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Detalhe se puder — ex.: 'o gabarito oficial da banca diz B, não D'."
            className="min-h-20 text-sm"
          />
          <Button onClick={enviar} disabled={!tipo || reportar.isPending} className="w-full">
            {reportar.isPending ? "Enviando…" : "Reportar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
