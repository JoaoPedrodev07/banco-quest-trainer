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
import { ehTreinoDeFormato } from "@/data/concursos";
import { useAcervo, useAcervoDoConcurso } from "@/services/hooks";
import { useStore } from "@/store/useStore";

export function AvisoAcervo() {
  const { acervo } = useAcervo();
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const { vazio, concurso, questoes: doConcurso } = useAcervoDoConcurso(concursoAtivoId);

  if (!acervo) return null;

  const { online, questoes, editalVigente } = acervo;

  // Os números têm que ser os do concurso em foco, não os do acervo inteiro.
  // Antes este aviso dizia "838 questões" e citava o edital do BB mesmo depois
  // de trocar para um concurso de treino, que tem 114 e outro edital — ou seja,
  // afirmava sobre a tela um número que não era o da tela.
  const total = doConcurso.length;
  const anuladas = doConcurso.filter((q) => q.anulada).length;
  const ehTreino = ehTreinoDeFormato(concurso);

  // Quantas questões existem no acervo mas **fora** deste concurso. Aparecem
  // como linha à parte, nunca somadas: elas são de outro órgão e outro edital,
  // então entrar na mesma contagem inflaria o acervo do candidato com material
  // que ele não vai encontrar na prova. Dizer que existem, e onde, é diferente
  // de contá-las como se fossem dele.
  const emOutrosConcursos = Math.max(0, questoes.total - total);

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
        {total} questões, todas de caderno oficial
        {anuladas > 0 && ` (${anuladas} anuladas pela banca)`}
      </AlertTitle>
      <AlertDescription>
        {ehTreino ? (
          <>
            Prova de <strong>{concurso?.orgao}</strong>, no catálogo para treinar o estilo da banca.
            O conteúdo programático é <strong>outro</strong>: serve para sentir como a banca cobra,
            não para medir o seu edital.
          </>
        ) : editalVigente.titulo ? (
          <>
            Conteúdo programático: {editalVigente.titulo}. É o edital <strong>anterior</strong> — o
            do concurso de 2026 substitui este quando sair.
          </>
        ) : (
          "Nenhum edital importado ainda: o conteúdo programático está vazio."
        )}
        {/* `total > 0` evita a linha aparecer durante o carregamento, quando o
            recorte ainda está vazio e a subtração daria o acervo inteiro. */}
        {total > 0 && emOutrosConcursos > 0 && (
          <>
            {" "}
            Há outras <strong>{emOutrosConcursos}</strong> questões no acervo, em concursos de
            treino de formato — de outro órgão, fora desta contagem. Troque o concurso em
            Configurações para treinar nelas.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
