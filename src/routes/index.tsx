import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/store/useStore";
import { MINIMO_PARA_JULGAR, pontosFracos } from "@/lib/desempenho";
import { incentivoPorMeta, incentivoPorStreak, incentivoPorTaxa } from "@/lib/incentivo";
import { CONCURSO_PADRAO } from "@/store/useStore";
import { AvisoAcervo } from "@/components/AvisoAcervo";
import { useAcervoDoConcurso } from "@/services/hooks";
import { SemAcervo } from "@/components/SemAcervo";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { Flame, Target, CheckCircle2, TrendingUp, Calendar } from "lucide-react";
import { useMemo } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Foco BB TI 2026" },
      {
        name: "description",
        content: "Acompanhe seu progresso rumo à aprovação no concurso do Banco do Brasil TI.",
      },
      { property: "og:title", content: "Foco BB TI 2026" },
      {
        property: "og:description",
        content: "Plataforma pessoal de estudos para o BB Agente de Tecnologia.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { dataProva, historico, editalStatus, streak, metaDiaria, concursoAtivoId } = useStore();
  const { concurso, disciplinas, questoes, vazio } = useAcervoDoConcurso(concursoAtivoId);

  // A data vem do concurso; `dataProva` do store é a sobrescrita do usuário,
  // que pode saber uma data mais precisa que a notícia. Quando nenhuma das duas
  // existe, a tela NÃO conta dias: o app fazia contagem regressiva para
  // 25/10/2026, uma data que nunca foi anunciada por ninguém.
  const dataEfetiva = concurso?.dataProva ?? (concurso?.id === CONCURSO_PADRAO ? dataProva : null);
  const diasRestantes = dataEfetiva
    ? Math.max(0, Math.ceil((new Date(dataEfetiva).getTime() - Date.now()) / 86400000))
    : null;
  // A contagem só é "oficial" quando o concurso tem data publicada. No BB ela sai
  // de `dataProva` do store, que é um chute do usuário (ou o padrão do protótipo)
  // — contar dias sem dizer isso é a mesma mentira de antes, só mais discreta.
  const dataEstimada = diasRestantes !== null && !concurso?.dataProva;

  // Só o histórico deste concurso: respostas de outro concurso inflariam o
  // total e a taxa de acerto de um edital que a pessoa nem está estudando.
  const doConcurso = useMemo(
    () => historico.filter((h) => h.concursoId === concursoAtivoId),
    [historico, concursoAtivoId],
  );
  const totalRespondidas = doConcurso.length;
  const acertos = doConcurso.filter((h) => h.correta).length;
  const taxa = totalRespondidas ? Math.round((acertos / totalRespondidas) * 100) : 0;

  const respondidasHoje = useMemo(() => {
    const hoje = new Date().toISOString().slice(0, 10);
    // slice(0,10) e não comparação de ISO completo: o ISO carrega hora, e
    // comparar tudo faria "hoje" nunca casar (§2.5 do CLAUDE.md).
    return doConcurso.filter((h) => h.data.slice(0, 10) === hoje).length;
  }, [doConcurso]);
  const mensagemStreak = incentivoPorStreak(streak.dias);

  const topicosConcluidos = Object.values(editalStatus).filter(
    (s) => s.teoria && s.revisao && s.questoes,
  ).length;

  const barData = useMemo(() => {
    return disciplinas.map((d) => {
      const hs = historico.filter((h) => h.disciplinaId === d.id);
      const t = hs.length ? Math.round((hs.filter((x) => x.correta).length / hs.length) * 100) : 0;
      return { nome: d.nome.split(" ")[0], acerto: t, fill: d.cor };
    });
  }, [disciplinas, historico]);

  const lineData = useMemo(() => {
    const arr: { dia: string; qtd: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const qtd = historico.filter((h) => h.data.slice(0, 10) === key).length;
      arr.push({ dia: d.getDate() + "/" + (d.getMonth() + 1), qtd });
    }
    return arr;
  }, [historico]);

  // Fraqueza por **assunto do edital**, não por disciplina. "Você vai mal em TI"
  // não diz o que estudar — TI tem 21 subtópicos. "Você vai mal em normalização
  // de banco de dados" diz. Só ficou possível depois que as questões passaram a
  // ter tópico; antes disso o dashboard só sabia agrupar por disciplina.
  const fracos = useMemo(
    () => pontosFracos(historico, questoes, concursoAtivoId, 3),
    [historico, questoes, concursoAtivoId],
  );

  /** Nome legível de uma unidade do edital, para não exibir o id cru na tela. */
  const nomeDaUnidade = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const d of disciplinas) {
      for (const t of d.topicos) {
        mapa.set(t.id, t.nome);
        for (const s of t.subtopicos) mapa.set(s.id, s.nome);
      }
    }
    return mapa;
  }, [disciplinas]);

  // Mesma regra da tela do edital: tópico sem subtópico conta como uma unidade.
  // No edital real, disciplinas inteiras (Português, Matemática) não têm
  // subdivisão, e contar só subtópico deixaria o denominador errado nas duas telas.
  const totalSubtopicos = disciplinas.reduce(
    (acc, d) => acc + d.topicos.reduce((a, t) => a + Math.max(1, t.subtopicos.length), 0),
    0,
  );
  const progressoEdital = totalSubtopicos
    ? Math.round((topicosConcluidos / totalSubtopicos) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <AvisoAcervo />

      {vazio && <SemAcervo nomeDoConcurso={concurso?.nome} />}

      <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg">
        <CardContent className="p-6 flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-sm opacity-90">Olá, futuro aprovado 👋</p>
            <h1 className="text-2xl md:text-3xl font-black mt-1">
              {concurso?.nome ?? "Escolha um concurso"}
            </h1>
            <p className="text-sm opacity-90 mt-2">
              {incentivoPorMeta(respondidasHoje, metaDiaria)}
            </p>
            {mensagemStreak && <p className="mt-1 text-xs opacity-80">{mensagemStreak}</p>}
          </div>
          <div className="rounded-xl bg-accent px-5 py-3 text-accent-foreground">
            <div className="flex items-center gap-2 text-xs font-bold uppercase">
              <Calendar className="h-4 w-4" /> {diasRestantes === null ? "Data" : "Faltam"}
            </div>
            {diasRestantes === null ? (
              <>
                <p className="mt-1 text-xl font-black leading-tight">a definir</p>
                <p className="mt-1 text-xs">edital não publicado</p>
              </>
            ) : (
              <>
                <p className="text-4xl font-black leading-none mt-1">{diasRestantes}</p>
                <p className="text-xs mt-1">
                  {dataEstimada ? "dias — data estimada" : "dias para a prova"}
                </p>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Target className="h-4 w-4" />}
          label="Questões"
          value={String(totalRespondidas)}
        />
        <StatCard
          icon={<TrendingUp className="h-4 w-4" />}
          label="Acerto geral"
          value={`${taxa}%`}
        />
        <StatCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tópicos concluídos"
          value={`${topicosConcluidos}/${totalSubtopicos}`}
        />
        <StatCard icon={<Flame className="h-4 w-4" />} label="Streak" value={`${streak.dias}d`} />
      </div>

      <p className="text-sm text-muted-foreground">{incentivoPorTaxa(taxa, totalRespondidas)}</p>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Progresso do edital</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressoEdital} className="h-3" />
          <p className="text-xs text-muted-foreground mt-2">
            {progressoEdital}% do edital concluído
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Acerto por disciplina</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="nome" fontSize={11} />
                <YAxis domain={[0, 100]} fontSize={11} />
                <Tooltip />
                <Bar dataKey="acerto" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Questões nos últimos 30 dias</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="dia" fontSize={10} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="qtd"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Pontos fracos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {fracos.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Responda pelo menos {MINIMO_PARA_JULGAR} questões de um mesmo assunto para ele poder
              aparecer aqui. Com uma ou duas respostas, errar é acaso, não fraqueza.
            </p>
          )}
          {fracos.map((p) => (
            <div
              key={p.unidadeId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:border-primary/40"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {nomeDaUnidade.get(p.unidadeId) ?? p.unidadeId}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.taxa}% de acerto em {p.respondidas}{" "}
                  {p.respondidas === 1 ? "questão" : "questões"} ·{" "}
                  {disciplinas.find((d) => d.id === p.disciplinaId)?.nome ?? p.disciplinaId}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to="/edital">Gerar aula</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/questoes">Praticar</Link>
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        {questoes.length} questões disponíveis no banco.
      </p>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
          {icon}
          {label}
        </div>
        <p className="text-2xl font-black mt-1">{value}</p>
      </CardContent>
    </Card>
  );
}
