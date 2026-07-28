/**
 * Diz de onde veio o conteúdo que está na tela.
 *
 * Existe por causa do §2.2 do CLAUDE.md: o app pode rodar com questões de
 * exemplo escritas para o protótipo, e apresentá-las como se fossem da banca faz
 * o usuário estudar por conteúdo inventado. Então, quando o acervo não é
 * oficial, isso aparece — não em nota de rodapé.
 */

import { AlertTriangle, BadgeCheck, WifiOff } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAcervo } from "@/services/hooks";

export function AvisoAcervo() {
  const { acervo } = useAcervo();
  if (!acervo) return null;

  const { online, questoes, editalVigente } = acervo;

  if (!online) {
    return (
      <Alert variant="destructive">
        <WifiOff className="h-4 w-4" />
        <AlertTitle>Servidor de conteúdo fora do ar</AlertTitle>
        <AlertDescription>
          Você está vendo {questoes.total} questões de exemplo, escritas para o protótipo. Elas{" "}
          <strong>não são da Cesgranrio</strong> e não servem para medir desempenho. Suba o backend
          para carregar o acervo real.
        </AlertDescription>
      </Alert>
    );
  }

  if (questoes.amostra > 0) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Acervo parcialmente de exemplo</AlertTitle>
        <AlertDescription>
          {questoes.amostra} das {questoes.total} questões são amostra, não vieram do caderno da
          banca. Trate a estatística com desconfiança até importar mais provas.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert>
      <BadgeCheck className="h-4 w-4" />
      <AlertTitle>
        {questoes.total} questões, todas de caderno oficial
        {questoes.anuladas > 0 && ` (${questoes.anuladas} anuladas pela banca)`}
      </AlertTitle>
      <AlertDescription>
        {editalVigente.titulo ? (
          <>
            Conteúdo programático: {editalVigente.titulo}. É o edital <strong>anterior</strong> — o
            do concurso de 2026 substitui este quando sair.
          </>
        ) : (
          "Nenhum edital importado ainda: o conteúdo programático está vazio."
        )}
      </AlertDescription>
    </Alert>
  );
}
