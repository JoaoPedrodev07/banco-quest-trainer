import { createFileRoute } from "@tanstack/react-router";
import { useStore } from "@/store/useStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configurações — Foco BB TI 2026" },
      { name: "description", content: "Ajuste data da prova, meta diária e preferências." },
      { property: "og:title", content: "Configurações" },
      { property: "og:description", content: "Personalize seus estudos." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { dataProva, setDataProva, metaDiaria, setMeta, darkMode, toggleDark, reset } = useStore();
  const dataInput = dataProva.slice(0, 10);

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl md:text-3xl font-black">Configurações</h1>
        <p className="text-sm text-muted-foreground">Ajuste sua jornada de estudos.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Prova</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Data estimada da prova</Label>
            <Input
              type="date"
              value={dataInput}
              onChange={(e) => setDataProva(new Date(e.target.value).toISOString())}
            />
          </div>
          <div className="space-y-2">
            <Label>Meta diária de questões</Label>
            <Input
              type="number"
              min={1}
              value={metaDiaria}
              onChange={(e) => setMeta(Math.max(1, Number(e.target.value) || 1))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Aparência</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label htmlFor="dm">Modo escuro</Label>
          <Switch id="dm" checked={darkMode} onCheckedChange={toggleDark} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base text-destructive">Zona de risco</CardTitle></CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Resetar todo o progresso</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar reset?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso apagará seu histórico de respostas, streak, checkboxes do edital e revisões. Ação irreversível.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    reset();
                    toast.success("Progresso resetado.");
                  }}
                >
                  Resetar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}
