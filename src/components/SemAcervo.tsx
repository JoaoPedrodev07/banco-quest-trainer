/**
 * O que a tela mostra quando o concurso em foco não tem nada importado.
 *
 * Sem isto, trocar o concurso deixaria o dashboard com 0 questões e 0% de
 * acerto — números que se leem como "você vai mal", quando o certo é "não há
 * acervo aqui". Zero por ausência de dado e zero por desempenho ruim não podem
 * ter a mesma aparência.
 */

import { Link } from "@tanstack/react-router";
import { PackageOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SemAcervo({ nomeDoConcurso }: { nomeDoConcurso?: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-6 text-center">
        <PackageOpen className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="font-semibold">Nenhuma prova importada para este concurso</p>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {nomeDoConcurso ? <strong>{nomeDoConcurso}</strong> : "Este concurso"} está no catálogo
          pelos dados da vaga, mas não há questões nem edital detalhado no acervo. Os números desta
          tela ficariam zerados por falta de dado, não por desempenho.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/concursos">Trocar de concurso</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
