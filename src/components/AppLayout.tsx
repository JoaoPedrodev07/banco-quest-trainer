import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BookOpen,
  ListChecks,
  FileText,
  NotebookPen,
  RotateCcw,
  Settings,
  Trophy,
  BarChart3,
  Layers,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/store/useStore";
import { useConcurso } from "@/services/hooks";
import { BuscaGlobal } from "@/components/BuscaGlobal";
import { Pomodoro } from "@/components/Pomodoro";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/plano", label: "Plano", icon: CalendarDays },
  { to: "/edital", label: "Edital", icon: BookOpen },
  { to: "/questoes", label: "Questões", icon: ListChecks },
  { to: "/erros", label: "Erros", icon: NotebookPen },
  { to: "/flashcards", label: "Flashcards", icon: Layers },
  { to: "/provas", label: "Provas", icon: FileText },
  { to: "/analise", label: "Análise", icon: BarChart3 },
  { to: "/revisoes", label: "Revisões", icon: RotateCcw },
  { to: "/classificacao", label: "Classificação", icon: ClipboardCheck },
  { to: "/concursos", label: "Concursos", icon: Trophy },
];

export function AppLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const darkMode = useStore((s) => s.darkMode);
  const concursoAtivo = useConcurso(useStore((s) => s.concursoAtivoId));

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col border-r border-border bg-sidebar text-sidebar-foreground">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-black">BB</span>
          </div>
          <div className="min-w-0">
            {/* Marca o concurso em foco, não um nome fixo: depois que o app
                virou multi-concurso, "Foco BB TI 2026" na barra lateral
                contradiz a tela quando o usuário escolhe outro. */}
            <p className="text-sm font-bold truncate">{concursoAtivo?.nome ?? "Foco"}</p>
            <p className="text-xs text-muted-foreground truncate">
              {concursoAtivo?.banca ?? "banca a definir"}
            </p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <BuscaGlobal />
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive(it.to, it.exact)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <it.icon className="h-4 w-4" />
              {it.label}
            </Link>
          ))}
          <Link
            to="/config"
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive("/config")
                ? "bg-primary text-primary-foreground"
                : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Settings className="h-4 w-4" />
            Configurações
          </Link>
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-20 md:pb-6">
        <div className="mx-auto max-w-5xl px-4 py-6 md:px-8">
          <Outlet />
        </div>
      </main>

      <Pomodoro />

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur">
        <div className="grid grid-cols-5">
          {navItems.map((it) => (
            <Link
              key={it.to}
              to={it.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                isActive(it.to, it.exact) ? "text-primary" : "text-muted-foreground",
              )}
            >
              <it.icon className="h-5 w-5" />
              {it.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
