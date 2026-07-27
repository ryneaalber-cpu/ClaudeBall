import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateTeamMatchupScore } from "@/lib/matchup-scoring-db";
import {
  DEFAULT_POSITION_POOLS,
  DEFAULT_SCORING_WEIGHTS,
  type RosterEntry,
  type Position,
} from "@/lib/scoring-engine";

export default async function MatchupPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; teamId: string }>;
  searchParams: Promise<{ gameNumber?: string }>;
}) {
  const { id: leagueId, teamId } = await params;
  const { gameNumber: gameNumberRaw } = await searchParams;
  const gameNumber = gameNumberRaw ? Number(gameNumberRaw) : undefined;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: { include: { positionPools: true, scoringCategories: true } },
      rosterEntries: {
        include: { player: true },
        orderBy: { priorityOrder: "asc" },
      },
    },
  });
  if (!team || team.leagueId !== leagueId) notFound();

  // Use the league's actual configured settings, falling back to the
  // engine's defaults only if the league somehow has none — same
  // pattern as league creation, so there's still one source of truth.
  const positionPools =
    team.league.positionPools.length > 0
      ? team.league.positionPools.map((p) => ({
          position: p.position as Position,
          minutePool: p.minutesTotal,
        }))
      : DEFAULT_POSITION_POOLS;

  const weights =
    team.league.scoringCategories.length > 0
      ? Object.fromEntries(
          team.league.scoringCategories.map((c) => [c.statKey, c.weight])
        )
      : DEFAULT_SCORING_WEIGHTS;

  const roster: RosterEntry[] = team.rosterEntries.map((entry) => ({
    playerId: entry.playerId,
    eligiblePositions: (entry.player.secondaryPosition
      ? [entry.player.primaryPosition, entry.player.secondaryPosition]
      : [entry.player.primaryPosition]) as Position[],
    priorityOrder: entry.priorityOrder,
  }));

  const playerName = new Map(
    team.rosterEntries.map((e) => [e.playerId, `${e.player.firstName} ${e.player.lastName}`])
  );

  const result =
    gameNumber && roster.length > 0
      ? await calculateTeamMatchupScore(roster, gameNumber, positionPools, weights)
      : null;

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/league/${leagueId}/team/${teamId}`}
          className="text-sm text-muted hover:text-paper"
        >
          ← {team.name}
        </Link>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {team.league.name}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Score a fantasy matchup against real synced games.
        </p>

        <form className="mt-8 flex items-end gap-2">
          <div>
            <label
              htmlFor="gameNumber"
              className="block text-xs uppercase tracking-wide text-muted"
            >
              Game number
            </label>
            <input
              id="gameNumber"
              name="gameNumber"
              type="number"
              min={1}
              max={82}
              defaultValue={gameNumberRaw}
              placeholder="e.g. 12"
              className="mt-1 w-32 rounded-sm border border-line bg-surface px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
            />
          </div>
          <button
            type="submit"
            className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Score it
          </button>
        </form>

        {gameNumber && roster.length === 0 && (
          <p className="mt-6 text-sm text-muted">
            This team has no roster yet — add players first.
          </p>
        )}

        {result && (
          <>
            <section className="mt-8">
              <h2 className="font-display text-lg font-medium text-paper">
                Underlying games
              </h2>
              {result.perGame.length === 0 && (
                <p className="mt-3 text-sm text-muted">
                  None of your players&apos; NBA teams have reached game{" "}
                  {gameNumber} yet — no synced games to score. Run the sync
                  for more dates, or try an earlier game number.
                </p>
              )}
              <div className="mt-3 space-y-3">
                {result.perGame.map(({ nbaTeam, result: gameResult }) => (
                  <div
                    key={nbaTeam}
                    className="overflow-hidden rounded-md ring-1 ring-line"
                  >
                    <div className="flex items-center justify-between bg-surfaceRaised px-4 py-2">
                      <span className="font-mono text-xs uppercase tracking-wide text-muted">
                        {nbaTeam} · game {gameNumber}
                      </span>
                      <span className="stat-figure font-mono text-sm text-paper">
                        {gameResult.totalScore.toFixed(1)} pts
                      </span>
                    </div>
                    {gameResult.contributions
                      .filter((c) => c.minutesConsumed > 0)
                      .map((c) => (
                        <div
                          key={c.playerId}
                          className="flex items-center justify-between bg-surface px-4 py-2 text-sm"
                        >
                          <span className="text-paper">
                            {playerName.get(c.playerId)}
                          </span>
                          <span className="stat-figure font-mono text-xs text-muted">
                            {c.minutesConsumed.toFixed(1)}/{c.minutesPlayed} min ·{" "}
                            {c.proratedFantasyPoints.toFixed(1)} pts
                          </span>
                        </div>
                      ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="mt-8 flex items-baseline justify-between rounded-md bg-surfaceRaised px-5 py-4 ring-1 ring-line">
              <span className="font-display text-sm uppercase tracking-wide text-muted">
                Matchup total
              </span>
              <span className="stat-figure font-display text-3xl font-semibold text-paper">
                {result.totalScore.toFixed(1)}
              </span>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
