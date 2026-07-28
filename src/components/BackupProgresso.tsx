/**
 * Exportar e importar o progresso.
 *
 * Enquanto não houver conta e servidor, o progresso vive só no localStorage
 * deste navegador. Limpar dados de navegação, trocar de máquina ou usar aba
 * anônima apaga meses de estudo — sem aviso e sem recuperação. Um arquivo que o
 * usuário guarda é a única rede honesta contra isso.
 */

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import { useStore } from "@/store/useStore";
import { ErroDeBackup, lerBackup, montarBackup, nomeDoArquivo } from "@/lib/backup";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BackupProgresso() {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendente, setPendente] = useState<ReturnType<typeof lerBackup> | null>(null);
  const aplicar = useStore((s) => s.aplicarBackup);

  const exportar = () => {
    const s = useStore.getState();
    const conteudo = montarBackup({
      concursoAtivoId: s.concursoAtivoId,
      dataProva: s.dataProva,
      metaDiaria: s.metaDiaria,
      editalStatus: s.editalStatus,
      historico: s.historico,
      revisoes: s.revisoes,
      streak: s.streak,
    });

    const url = URL.createObjectURL(new Blob([conteudo], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = nomeDoArquivo();
    link.click();
    // Sem revogar, o Blob fica na memória até a aba fechar.
    URL.revokeObjectURL(url);
    toast.success("Progresso exportado", {
      description: "Guarde o arquivo fora deste computador.",
    });
  };

  const escolherArquivo = async (arquivo: File) => {
    try {
      // Só valida aqui; a gravação espera confirmação, porque importar
      // SUBSTITUI o progresso atual e não há como desfazer.
      setPendente(lerBackup(await arquivo.text()));
    } catch (erro) {
      toast.error("Não consegui ler o arquivo", {
        description: erro instanceof ErroDeBackup ? erro.message : String(erro),
      });
    }
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={exportar} className="gap-1.5">
          <Download className="h-4 w-4" />
          Exportar progresso
        </Button>
        <Button variant="outline" onClick={() => entrada.current?.click()} className="gap-1.5">
          <Upload className="h-4 w-4" />
          Importar
        </Button>
        <input
          ref={entrada}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) void escolherArquivo(arquivo);
            // Zera o input para reescolher o mesmo arquivo depois de um erro.
            e.target.value = "";
          }}
        />
      </div>

      <AlertDialog open={pendente !== null} onOpenChange={(a) => !a && setPendente(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Substituir o progresso atual?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo tem <strong>{pendente?.historico.length ?? 0}</strong> respostas e{" "}
              <strong>{pendente?.revisoes.length ?? 0}</strong> revisões. Importar{" "}
              <strong>apaga o progresso que está neste navegador</strong> e põe o do arquivo no
              lugar. Não dá para desfazer — exporte o atual antes, se ele tiver algo que você queira
              manter.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!pendente) return;
                aplicar(pendente);
                setPendente(null);
                toast.success("Progresso importado", {
                  description: `${pendente.historico.length} respostas restauradas.`,
                });
              }}
            >
              Substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
