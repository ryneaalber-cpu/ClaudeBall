import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSchedule, scoreMatchup } from "./actions";

export default async function SchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: leagueId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();
  const isCommissioner = membership.role === "COMMISSIONER";

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });
  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({
    where: { leagueId },
    include: { teamA: true, teamB: true },
    orderBy: { gameNumber: "asc" },
  });

  const byGameNumber = new Map<number, typeof matchups>();
  for (const m of matchups) {
    const list = byGameNumber.get(m.gameNumber) ?? [];
    list.push(m);
    byGameNumber.set(m.gameNumber, list);
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
          ← {league.name}
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            Schedule
          </h1>
          <Link
            href={`/league/${leagueId}/standings`}
            className="text-sm text-pos-forward hover:underline"
          >
            Standings →
          </Link>
        </div>

        {matchups.length === 0 ? (
          isCommissioner ? (
            <form
              action={generateSchedule.bind(null, leagueId)}
              className="mt-8 w-full max-w-sm space-y-4 rounded-md bg-surface p-6 ring-1 ring-line"
            >
              <p className="text-sm text-muted">
                No schedule yet. This pairs up every team round-robin
                style (everyone plays everyone else in turn, repeating
                for however many game numbers you set) and creates every
                matchup up front.
              </p>
              <div>
                <label
                  htmlFor="gameNumbers"
                  className="block text-xs uppercase tracking-wide text-muted"
                >
                  Number of games
                </label>
                <input
                  id="gameNumbers"
                  name="gameNumbers"
                  type="number"
                  min={1}
                  max={82}
                  defaultValue={82}
                  className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
                />
              </div>
              <button
                type="submit"
                className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Generate schedule
              </button>
            </form>
          ) : (
            <p className="mt-8 text-sm text-muted">
              The commissioner hasn&apos;t generated a schedule yet.
            </p>
          )
        ) : (
          <div className="mt-8 space-y-6">
            {[...byGameNumber.entries()].map(([gameNumber, games]) => (
              <section key={gameNumber}>
                <h2 className="font-mono text-xs uppercase tracking-wide text-muted">
                  Game {gameNumber}
                </h2>
                <div className="mt-2 overflow-hidden rounded-md ring-1 ring-line">
                  {games.map((m) => {
                    const scored = m.teamAScore !== null && m.teamBScore !== null;
                    return (
                      <div
                        key={m.id}
                        className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 text-sm last:border-b-0"
                      >
                        <span className="flex-1 truncate text-paper">
                          {m.teamA.name}
                          {scored && (
                            <span className="stat-figure ml-2 font-mono text-xs text-muted">
                              {m.teamAScore!.toFixed(1)}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted">vs</span>
                        <span className="flex-1 truncate text-right text-paper">
                          {scored && (
                            <span className="stat-figure mr-2 font-mono text-xs text-muted">
                              {m.teamBScore!.toFixed(1)}
                            </span>
                          )}
                          {m.teamB.name}
                        </span>
                        <form action={scoreMatchup.bind(null, leagueId, m.id)}>
                          <button
                            type="submit"
                            className="shrink-0 rounded-sm bg-line px-2.5 py-1 text-xs font-medium text-paper hover:bg-line/70"
                          >
                            {scored ? "Rescore" : "Score it"}
                          </button>
                        </form>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
