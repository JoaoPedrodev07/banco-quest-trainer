/**
 * Renderiza o Markdown que veio de uma IA.
 *
 * O conteúdo é **texto de terceiro colado pelo usuário**, então o renderer roda
 * sem `rehype-raw`: HTML embutido no markdown fica como texto, não vira elemento.
 * O `react-markdown` já é seguro por padrão nesse ponto — este comentário existe
 * para que ninguém ligue HTML bruto aqui "para melhorar a formatação".
 *
 * Sem plugin de fórmula (KaTeX) de propósito: o prompt pede para a IA evitar
 * LaTeX, e adicionar o renderer antes de ver conteúdo real seria peso sem
 * necessidade comprovada.
 */

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h2 className="mt-4 text-lg font-black first:mt-0">{children}</h2>,
          h2: ({ children }) => <h3 className="mt-4 text-base font-bold first:mt-0">{children}</h3>,
          h3: ({ children }) => (
            <h4 className="mt-3 text-sm font-bold text-muted-foreground first:mt-0">{children}</h4>
          ),
          p: ({ children }) => <p className="leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="ml-5 list-disc space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="ml-5 list-decimal space-y-1">{children}</ol>,
          code: ({ children, className }) =>
            className ? (
              // Bloco de código: rola sozinho para não empurrar a largura da página.
              <code className="block overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs">
                {children}
              </code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
            ),
          pre: ({ children }) => <pre className="overflow-x-auto">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-border bg-muted/50 p-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border border-border p-2">{children}</td>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-primary"
            >
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

/** Aviso fixo em todo lugar que mostra conteúdo gerado por IA. */
export function AvisoGerado({ oQue = "conteúdo" }: { oQue?: string }) {
  return (
    <p className="rounded-md border border-dashed border-border bg-muted/30 p-2 text-xs text-muted-foreground">
      Este {oQue} foi <strong>gerado por IA</strong>, não veio da banca — confira contra o edital
      oficial antes de estudar por ele.
    </p>
  );
}
