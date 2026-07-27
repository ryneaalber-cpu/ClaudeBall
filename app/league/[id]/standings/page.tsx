import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { computeStandings } from "@/lib/standings";

export default async function StandingsPage({
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

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { teams: true },
  });
  if (!league) notFound();

  const matchups = await prisma.matchup.findMany({ where: { leagueId } });

  const standings = computeStandings(
    league.teams.map((t) => t.id),
    matchups
  );

  const teamName = new Map(league.teams.map((t) => [t.id, t.name]));

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
          ← {league.name}
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            Standings
          </h1>
          <Link
            href={`/league/${leagueId}/schedule`}
            className="text-sm text-pos-forward hover:underline"
          >
            Schedule →
          </Link>
        </div>

        <div className="mt-8 overflow-hidden rounded-md ring-1 ring-line">
          <div className="grid grid-cols-[1fr_3rem_3rem_3rem_5rem_5rem] gap-2 bg-surfaceRaised px-4 py-2 font-mono text-[10px] uppercase tracking-wide text-muted">
            <span>Team</span>
            <span className="text-right">W</span>
            <span className="text-right">L</span>
            <span className="text-right">T</span>
            <span className="text-right">PF</span>
            <span className="text-right">PA</span>
          </div>
          {standings.length === 0 && (
            <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
              No teams yet.
            </p>
          )}
          {standings.map((s, i) => (
            <div
              key={s.teamId}
              className="grid grid-cols-[1fr_3rem_3rem_3rem_5rem_5rem] gap-2 border-b border-line bg-surface px-4 py-3 text-sm last:border-b-0"
            >
              <span className="truncate text-paper">
                <span className="mr-2 font-mono text-xs text-muted">{i + 1}.</span>
                {teamName.get(s.teamId) ?? "Unknown team"}
              </span>
              <span className="stat-figure text-right text-paper">{s.wins}</span>
              <span className="stat-figure text-right text-paper">{s.losses}</span>
              <span className="stat-figure text-right text-muted">{s.ties}</span>
              <span className="stat-figure text-right text-muted">{s.pointsFor.toFixed(1)}</span>
              <span className="stat-figure text-right text-muted">{s.pointsAgainst.toFixed(1)}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted">
          Only matchups that have been scored on the{" "}
          <Link href={`/league/${leagueId}/schedule`} className="text-pos-forward hover:underline">
            schedule page
          </Link>{" "}
          count here — scoring doesn&apos;t happen automatically yet, since
          that would mean checking every league&apos;s matchups on some
          kind of timer rather than on request.
        </p>
      </div>
    </main>
  );
}
