/**
 * Pesquisa global (ADR-013): questão, assunto do edital, prova e concurso, num
 * `Ctrl+K`.
 *
 * A busca é client-side sobre o acervo que o TanStack Query já carregou — 600
 * questões filtram em microssegundos no navegador, e criar endpoint de busca
 * para isso seria abstração sem necessidade. Como a fonte é
 * `useAcervoDoConcurso`, o recorte por concurso/cargo vem de graça: a busca não
 * vaza disciplina de outro cargo.
 *
 * Questão selecionada abre em **diálogo de leitura**, não em simulado: não
 * existe "página da questão", e quem busca quer consultar (rever o gabarito, a
 * anotação), não treinar.
 */

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { BookOpen, FileText, ListChecks, Search, Trophy } from "lucide-react";

import { AnotacaoDaQuestao } from "@/components/AnotacaoDaQuestao";
import { GabaritoComentado } from "@/components/GabaritoComentado";
import { TextoDaQuestao } from "@/components/Markdown";
import { useAcervoDoConcurso, useConcursos } from "@/services/hooks";
import { useStore } from "@/store/useStore";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Questao } from "@/types";

const MINIMO_CARACTERES = 3;
const MAX_POR_GRUPO = 8;

/** Sem acento e minúsculo, para "revisao" achar "Revisão". */
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

export function BuscaGlobal() {
  const [aberta, setAberta] = useState(false);
  const [consulta, setConsulta] = useState("");
  // Adia a filtragem para a digitação não travar em acervo grande.
  const consultaAdiada = useDeferredValue(consulta);
  const [questaoAberta, setQuestaoAberta] = useState<Questao | null>(null);

  const navigate = useNavigate();
  const concursoAtivoId = useStore((s) => s.concursoAtivoId);
  const { disciplinas, questoes, provas } = useAcervoDoConcurso(concursoAtivoId);
  const { concursos } = useConcursos();

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setAberta((a) => !a);
      }
    };
    document.addEventListener("keydown", aoTeclar);
    return () => document.removeEventListener("keydown", aoTeclar);
  }, []);

  const resultados = useMemo(() => {
    const q = normalizar(consultaAdiada.trim());
    if (q.length < MINIMO_CARACTERES) return null;

    const assuntos: { id: string; nome: string; disciplina: string }[] = [];
    for (const d of disciplinas) {
      for (const t of d.topicos) {
        const unidades = t.subtopicos.length ? t.subtopicos : [{ id: t.id, nome: t.nome }];
        for (const u of unidades) {
          if (normalizar(u.nome).includes(q)) {
            assuntos.push({ id: u.id, nome: u.nome, disciplina: d.nome });
          }
        }
      }
    }

    const provasEncontradas = provas.filter((p) =>
      normalizar(`${p.orgao} ${p.cargo} ${p.ano} ${p.banca} ${p.id}`).includes(q),
    );

    const concursosEncontrados = concursos.filter((c) =>
      normalizar(`${c.nome} ${c.orgao} ${c.cargo} ${c.banca ?? ""}`).includes(q),
    );

    // Id exato primeiro: quem cola um id quer AQUELA questão, não parecidas.
    const porId = questoes.filter((questao) => normalizar(questao.id) === q);
    const porTexto = questoes.filter(
      (questao) => normalizar(questao.id) !== q && normalizar(questao.enunciado).includes(q),
    );
    const questoesEncontradas = [...porId, ...porTexto];

    return {
      assuntos: assuntos.slice(0, MAX_POR_GRUPO),
      provas: provasEncontradas.slice(0, MAX_POR_GRUPO),
      concursos: concursosEncontrados.slice(0, MAX_POR_GRUPO),
      questoes: questoesEncontradas.slice(0, MAX_POR_GRUPO),
      total:
        assuntos.length +
        provasEncontradas.length +
        concursosEncontrados.length +
        questoesEncontradas.length,
    };
  }, [consultaAdiada, disciplinas, provas, questoes, concursos]);

  const fecharENavegar = (fn: () => void) => {
    setAberta(false);
    setConsulta("");
    fn();
  };

  const disciplinaDaQuestao = (questao: Questao) =>
    disciplinas.find((d) => d.id === questao.disciplinaId)?.nome ?? questao.disciplinaId;

  return (
    <>
      <button
        onClick={() => setAberta(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <Search className="h-4 w-4" />
        Buscar…
        <kbd className="ml-auto rounded border border-sidebar-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      <Dialog open={aberta} onOpenChange={setAberta}>
        <DialogContent className="overflow-hidden p-0">
          {/* Command direto, não CommandDialog: o wrapper do shadcn não repassa
              `shouldFilter`, e o filtro interno do cmdk descartaria tudo — os
              values dos itens não contêm o texto buscado (o filtro é nosso, com
              acentos normalizados e id exato primeiro). */}
          <Command
            shouldFilter={false}
            className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]]:px-2 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3"
          >
            <CommandInput
              placeholder="Questão, assunto do edital, prova ou concurso…"
              value={consulta}
              onValueChange={setConsulta}
            />
            <CommandList>
              {!resultados && (
                <p className="p-4 text-center text-sm text-muted-foreground">
                  Digite pelo menos {MINIMO_CARACTERES} caracteres. Também dá para colar o id de uma
                  questão.
                </p>
              )}
              {resultados && resultados.total === 0 && (
                <CommandEmpty>Nada encontrado no acervo deste concurso.</CommandEmpty>
              )}

              {resultados && resultados.assuntos.length > 0 && (
                <CommandGroup heading="Assuntos do edital">
                  {resultados.assuntos.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`assunto-${a.id}`}
                      onSelect={() =>
                        fecharENavegar(() => navigate({ to: "/edital", search: { unidade: a.id } }))
                      }
                    >
                      <BookOpen className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{a.nome}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {a.disciplina}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {resultados && resultados.questoes.length > 0 && (
                <CommandGroup heading="Questões">
                  {resultados.questoes.map((questao) => (
                    <CommandItem
                      key={questao.id}
                      value={`questao-${questao.id}`}
                      onSelect={() => {
                        setAberta(false);
                        setConsulta("");
                        setQuestaoAberta(questao);
                      }}
                    >
                      <ListChecks className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{questao.enunciado}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">
                        {questao.banca} {questao.ano}
                      </span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {resultados && resultados.provas.length > 0 && (
                <CommandGroup heading="Provas">
                  {resultados.provas.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={`prova-${p.id}`}
                      onSelect={() =>
                        fecharENavegar(() => navigate({ to: "/questoes", search: { prova: p.id } }))
                      }
                    >
                      <FileText className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {p.orgao} {p.ano} — {p.cargo}
                      </span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{p.banca}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              {resultados && resultados.concursos.length > 0 && (
                <CommandGroup heading="Concursos">
                  {resultados.concursos.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`concurso-${c.id}`}
                      onSelect={() =>
                        fecharENavegar(() =>
                          navigate({ to: "/concursos/$concursoId", params: { concursoId: c.id } }),
                        )
                      }
                    >
                      <Trophy className="mr-2 h-4 w-4 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">{c.nome}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Leitura da questão encontrada — consultar, não treinar. */}
      <Dialog open={questaoAberta !== null} onOpenChange={(a) => !a && setQuestaoAberta(null)}>
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col overflow-hidden">
          {questaoAberta && (
            <>
              <DialogHeader>
                <DialogTitle className="text-base">
                  {questaoAberta.banca} · {questaoAberta.ano}
                  {questaoAberta.numeroNaProva ? ` · questão ${questaoAberta.numeroNaProva}` : ""}
                </DialogTitle>
                <DialogDescription>
                  {disciplinaDaQuestao(questaoAberta)}
                  {questaoAberta.anulada && (
                    <Badge variant="destructive" className="ml-2">
                      anulada
                    </Badge>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                {questaoAberta.textoBase && (
                  <details className="rounded-lg border border-border bg-muted/40 p-3">
                    <summary className="cursor-pointer text-sm font-semibold">
                      Texto de apoio
                    </summary>
                    <TextoDaQuestao className="mt-2 block whitespace-pre-line text-sm leading-relaxed">
                      {questaoAberta.textoBase}
                    </TextoDaQuestao>
                  </details>
                )}
                <TextoDaQuestao className="block whitespace-pre-line text-sm leading-relaxed">
                  {questaoAberta.enunciado}
                </TextoDaQuestao>
                {questaoAberta.tipo !== "certo_errado" &&
                  questaoAberta.alternativas.map((a) => (
                    <div
                      key={a.letra}
                      className={cn(
                        "flex items-start gap-2 rounded-md border p-2 text-sm",
                        a.letra === questaoAberta.correta
                          ? "border-sucesso bg-sucesso-suave"
                          : "border-transparent opacity-75",
                      )}
                    >
                      <span className="font-black text-primary">{a.letra}</span>
                      <TextoDaQuestao className="flex-1 text-sm">{a.texto}</TextoDaQuestao>
                    </div>
                  ))}
                <div className="rounded-lg bg-muted p-4">
                  <GabaritoComentado
                    questao={questaoAberta}
                    disciplinaNome={disciplinaDaQuestao(questaoAberta)}
                  />
                </div>
                <AnotacaoDaQuestao questaoId={questaoAberta.id} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
