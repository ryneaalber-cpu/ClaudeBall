import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSalaryForSeason } from "@/lib/cap";
import { TradeBuilder } from "./trade-builder";

function normalizeTeamIds(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

export default async function NewTradePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ teams?: string | string[]; fromTrade?: string }>;
}) {
  const { id: leagueId } = await params;
  const { teams: teamsParam, fromTrade } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { teams: { include: { owner: true } } },
  });
  if (!league) notFound();

  // Countering a decline arrives with ?fromTrade=<id> — derive the team
  // list and starting selections from that trade instead of making
  // someone re-pick teams and re-check players from scratch.
  let teamIds = normalizeTeamIds(teamsParam);
  let initialDestinations: Record<string, string> = {};

  if (fromTrade) {
    const original = await prisma.trade.findUnique({
      where: { id: fromTrade },
      include: { participants: true, items: true },
    });
    if (original && original.leagueId === leagueId) {
      teamIds = original.participants.map((p) => p.teamId);
      initialDestinations = Object.fromEntries(
        original.items.map((item) => [item.playerId, item.toTeamId])
      );
    }
  }

  // Step 1: pick at least two teams, if not already chosen.
  if (teamIds.length < 2) {
    return (
      <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href={`/league/${leagueId}/trades`} className="text-sm text-muted hover:text-paper">
            ← Trades
          </Link>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            Propose a trade
          </h1>
          <p className="mt-2 text-sm text-muted">
            Pick two or more teams. Three-plus-team trades work the same way
            as a straight swap — just more destinations to choose from per
            player.
          </p>

          <form className="mt-8 w-full max-w-sm space-y-3 rounded-md bg-surface p-6 ring-1 ring-line">
            {league.teams.map((team) => (
              <label key={team.id} className="flex items-center gap-2 text-sm text-paper">
                <input
                  type="checkbox"
                  name="teams"
                  value={team.id}
                  defaultChecked={team.ownerId === session.user.id}
                />
                {team.name}
              </label>
            ))}
            <button
              type="submit"
              className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Choose players →
            </button>
          </form>
        </div>
      </main>
    );
  }

  const teams = league.teams.filter((t) => teamIds.includes(t.id));
  if (teams.length !== teamIds.length) notFound();

  const isCommissioner = membership.role === "COMMISSIONER";
  const canPropose = isCommissioner || teams.some((t) => t.ownerId === session.user.id);

  if (!canPropose) {
    return (
      <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted">
            You need to own one of the selected teams (or be the
            commissioner) to propose this trade.
          </p>
        </div>
      </main>
    );
  }

  const [rosterEntries, contracts] = await Promise.all([
    prisma.rosterEntry.findMany({
      where: { teamId: { in: teamIds } },
      include: { player: true },
      orderBy: { priorityOrder: "asc" },
    }),
    prisma.contract.findMany({
      where: { teamId: { in: teamIds }, isActive: true },
      include: { years: true },
    }),
  ]);

  const salaryByPlayer = new Map(
    contracts.map((c) => [c.playerId, resolveSalaryForSeason(c.years, league.currentSeason)])
  );
  const committedByTeam = new Map<string, number>();
  for (const c of contracts) {
    const salary = resolveSalaryForSeason(c.years, league.currentSeason);
    committedByTeam.set(c.teamId, (committedByTeam.get(c.teamId) ?? 0) + salary);
  }

  const builderTeams = teams.map((t) => ({
    id: t.id,
    name: t.name,
    capAmount: league.capAmount,
    currentCommitted: committedByTeam.get(t.id) ?? 0,
  }));

  const builderPlayers = rosterEntries.map((entry) => ({
    id: entry.playerId,
    name: `${entry.player.firstName} ${entry.player.lastName}`,
    position: entry.player.primaryPosition,
    salary: salaryByPlayer.get(entry.playerId) ?? 0,
    teamId: entry.teamId,
  }));

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-5xl">
        <Link href={`/league/${leagueId}/trades/new`} className="text-sm text-muted hover:text-paper">
          ← Choose different teams
        </Link>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          {teams.map((t) => t.name).join(" ↔ ")}
        </h1>

        <div className="mt-8">
          <TradeBuilder
            leagueId={leagueId}
            teams={builderTeams}
            players={builderPlayers}
            initialDestinations={initialDestinations}
            capEnabled={league.capEnabled}
          />
        </div>
      </div>
    </main>
  );
}
