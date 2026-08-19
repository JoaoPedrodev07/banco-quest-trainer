/**
 * Card "Conta e sincronização" (ADR-021), em Configurações.
 *
 * A conta é opcional: sem login o app continua 100% local. Logado, todo avanço
 * é empurrado sozinho (debounce) e o conflito entre dispositivos é decidido
 * AQUI, pelo usuário — substitui, não mescla, como o backup sempre fez.
 */

import { useState } from "react";
import { CloudUpload, LogIn, LogOut, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { guardarSessao, limparSessao, sessaoAtual } from "@/lib/conta";
import {
  aoEntrar,
  aoSair,
  sincronizarAgora,
  usarProgressoDoServidor,
  usarProgressoLocal,
  useSyncStore,
} from "@/lib/sync";
import { contaApi } from "@/services";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ROTULO_ESTADO = {
  deslogado: "sem conta",
  ocioso: "sincronizado",
  sincronizando: "sincronizando…",
  conflito: "conflito",
  erro: "erro",
} as const;

export function ContaSync() {
  const sync = useSyncStore();
  const [modo, setModo] = useState<"entrar" | "registrar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);

  const autenticar = async () => {
    setEnviando(true);
    try {
      const resposta =
        modo === "entrar"
          ? await contaApi.entrar(email.trim(), senha)
          : await contaApi.registrar(email.trim(), senha);
      guardarSessao({ token: resposta.token, email: resposta.email });
      setSenha("");
      const resultado = await aoEntrar(resposta.email);
      if (resultado === "aplicado") {
        toast.success("Progresso da conta aplicado neste navegador.");
      } else if (resultado === "enviado") {
        toast.success("Conta pronta — seu progresso local subiu para ela.");
      }
      // "conflito" fica visível no próprio card, com a escolha.
    } catch (erro) {
      toast.error(modo === "entrar" ? "Não deu para entrar" : "Não deu para criar a conta", {
        description: erro instanceof Error ? erro.message : String(erro),
      });
    } finally {
      setEnviando(false);
    }
  };

  const sair = async () => {
    const sessao = sessaoAtual();
    try {
      if (sessao) await contaApi.sair(sessao.token);
    } catch {
      // Sair local mesmo se o servidor não respondeu: o token some daqui; se
      // sobreviver lá, expira na próxima revogação.
    }
    limparSessao();
    aoSair();
    toast.success("Você saiu. O progresso continua neste navegador.");
  };

  if (sync.estado === "deslogado") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sem conta, o progresso vive só neste navegador. Com ela, sincroniza entre dispositivos e
          sobrevive a limpar o navegador.
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={modo === "entrar" ? "default" : "outline"}
            onClick={() => setModo("entrar")}
            className="gap-1.5"
          >
            <LogIn className="h-3.5 w-3.5" />
            Entrar
          </Button>
          <Button
            size="sm"
            variant={modo === "registrar" ? "default" : "outline"}
            onClick={() => setModo("registrar")}
            className="gap-1.5"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Criar conta
          </Button>
        </div>
        <div className="space-y-2">
          <Label>E-mail</Label>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Label>Senha {modo === "registrar" && "(mínimo 8 caracteres, não só números)"}</Label>
          <Input type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        <Button onClick={autenticar} disabled={enviando || !email.trim() || !senha}>
          {enviando ? "Enviando…" : modo === "entrar" ? "Entrar" : "Criar conta e sincronizar"}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{sync.email}</span>
        <Badge
          variant={
            sync.estado === "ocioso"
              ? "secondary"
              : sync.estado === "sincronizando"
                ? "outline"
                : "destructive"
          }
        >
          {ROTULO_ESTADO[sync.estado]}
        </Badge>
        {sync.ultimaSync && (
          <span className="text-xs text-muted-foreground">
            última sync {new Date(sync.ultimaSync).toLocaleTimeString("pt-BR")}
          </span>
        )}
      </div>

      {sync.estado === "conflito" && (
        <div className="space-y-2 rounded-md border border-atencao/40 bg-atencao-suave p-3">
          <p className="text-sm">
            {sync.mensagem} A sincronização <strong>substitui, não mescla</strong> — mesclar dois
            históricos duplicaria respostas e inflaria o streak.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() =>
                usarProgressoDoServidor()
                  .then(() => toast.success("Progresso da conta aplicado."))
                  .catch((e) => toast.error("Falhou", { description: String(e) }))
              }
            >
              Usar o da conta (substitui este navegador)
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                usarProgressoLocal()
                  .then(() => toast.success("Progresso deste navegador enviado à conta."))
                  .catch((e) => toast.error("Falhou", { description: String(e) }))
              }
            >
              Manter o deste navegador (sobrescreve a conta)
            </Button>
          </div>
        </div>
      )}

      {sync.estado === "erro" && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-xs">
          {sync.mensagem ?? "Falha ao sincronizar."} O progresso continua salvo neste navegador; a
          próxima mudança tenta de novo.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5"
          disabled={sync.estado === "sincronizando"}
          onClick={() =>
            sincronizarAgora().then(() => {
              const { estado } = useSyncStore.getState();
              if (estado === "ocioso") toast.success("Sincronizado.");
            })
          }
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sincronizar agora
        </Button>
        <Button size="sm" variant="ghost" className="gap-1.5" onClick={sair}>
          <LogOut className="h-3.5 w-3.5" />
          Sair
        </Button>
      </div>
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
        <CloudUpload className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Cada avanço é enviado sozinho segundos depois. Modo escuro, pomodoro e o simulado em
        andamento ficam locais de propósito.
      </p>
    </div>
  );
}
