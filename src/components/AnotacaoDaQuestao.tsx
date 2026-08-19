/**
 * Nota privada de uma questão (ADR-011).
 *
 * O lugar de escrever "pegadinha: a banca troca média por mediana aqui" — o
 * tipo de observação que só vale se reaparecer no reencontro com a questão.
 * Grava no blur, não a cada tecla: o persist serializa o store inteiro a cada
 * escrita, e histórico grande tornaria a digitação pegajosa.
 */

import { useEffect, useState } from "react";
import { StickyNote } from "lucide-react";

import { useStore } from "@/store/useStore";
import { Textarea } from "@/components/ui/textarea";

export function AnotacaoDaQuestao({ questaoId }: { questaoId: string }) {
  const salva = useStore((s) => s.anotacoes[questaoId] ?? "");
  const anotarQuestao = useStore((s) => s.anotarQuestao);
  const [rascunho, setRascunho] = useState(salva);

  // Trocar de questão reusa o componente montado: sem sincronizar, a nota da
  // questão anterior apareceria dentro da seguinte.
  useEffect(() => {
    setRascunho(salva);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [questaoId]);

  return (
    <div className="space-y-1">
      <p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <StickyNote className="h-3.5 w-3.5" />
        Sua anotação (privada — volta a aparecer quando você reencontrar a questão)
      </p>
      <Textarea
        value={rascunho}
        onChange={(e) => setRascunho(e.target.value)}
        onBlur={() => anotarQuestao(questaoId, rascunho)}
        placeholder="Pegadinha, macete, o que você quer lembrar da próxima vez…"
        className="min-h-14 text-sm"
      />
    </div>
  );
}
