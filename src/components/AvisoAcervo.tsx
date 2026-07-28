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
import { useAcervo, useAcervoDoConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";

export function AvisoAcervo() {
  const { acervo } = useAcervo();
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const { vazio } = useAcervoDoConcurso(concursoAtivoId);

  if (!acervo) return null;

  const { online, questoes, editalVigente } = acervo;

  // Com o concurso em foco sem acervo, este aviso descreveria o conteúdo de
  // OUTRO concurso — anunciando o edital do BB para quem escolheu o TCE-RJ.
  // Quem fala nesse caso é o `SemAcervo` da tela. O aviso de servidor fora do ar
  // continua, porque esse é problema de infraestrutura, não de recorte.
  if (vazio && online) return null;

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
