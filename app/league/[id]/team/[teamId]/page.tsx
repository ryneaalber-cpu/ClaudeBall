import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addPlayerToRoster, removeFromRoster, moveRosterEntry } from "./actions";

const POSITION_COLOR: Record<string, string> = {
  C: "bg-pos-center",
  F: "bg-pos-forward",
  G: "bg-pos-guard",
};

export default async function TeamRosterPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; teamId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id: leagueId, teamId } = await params;
  const { q } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: true,
      owner: true,
      rosterEntries: {
        include: { player: true },
        orderBy: { priorityOrder: "asc" },
      },
    },
  });
  if (!team || team.leagueId !== leagueId) notFound();

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();

  const canManage =
    membership.role === "COMMISSIONER" || team.ownerId === session.user.id;

  const rosteredPlayerIds = new Set(team.rosterEntries.map((e) => e.playerId));

  const searchResults = q
    ? await prisma.player.findMany({
        where: {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
          ],
        },
        take: 15,
        orderBy: { lastName: "asc" },
      })
    : [];

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {team.league.name}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          {team.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {team.owner ? `Owned by ${team.owner.username}` : "Unclaimed — no owner yet"}
        </p>
        <div className="mt-2 flex gap-4">
          <Link
            href={`/league/${leagueId}/team/${teamId}/matchup`}
            className="text-sm text-pos-forward hover:underline"
          >
            Score a matchup →
          </Link>
          <Link
            href={`/league/${leagueId}/team/${teamId}/contracts`}
            className="text-sm text-pos-forward hover:underline"
          >
            Contracts &amp; cap →
          </Link>
        </div>

        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-medium text-paper">
              Roster
            </h2>
            <span className="font-mono text-xs uppercase tracking-wide text-muted">
              Priority order
            </span>
          </div>

          <div className="overflow-hidden rounded-md ring-1 ring-line">
            {team.rosterEntries.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No players yet — search below to add the first one.
              </p>
            )}
            {team.rosterEntries.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0"
              >
                <span className="font-mono text-xs text-muted">{i + 1}</span>
                <div className="flex gap-1">
                  <span
                    className={`${POSITION_COLOR[entry.player.primaryPosition]} rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-ink`}
                  >
                    {entry.player.primaryPosition}
                  </span>
                  {entry.player.secondaryPosition && (
                    <span
                      className={`${POSITION_COLOR[entry.player.secondaryPosition]} rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-ink`}
                    >
                      {entry.player.secondaryPosition}
                    </span>
                  )}
                </div>
                <span className="flex-1 text-sm font-medium text-paper">
                  {entry.player.firstName} {entry.player.lastName}
                </span>
                <span className="font-mono text-xs text-muted">
                  {entry.player.nbaTeam}
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <form
                      action={moveRosterEntry.bind(
                        null,
                        leagueId,
                        teamId,
                        entry.id,
                        "up"
                      )}
                    >
                      <button
                        type="submit"
                        disabled={i === 0}
                        aria-label={`Move ${entry.player.firstName} ${entry.player.lastName} up`}
                        className="rounded-sm px-1.5 py-1 text-xs text-muted hover:text-paper disabled:opacity-30"
                      >
                        ↑
                      </button>
                    </form>
                    <form
                      action={moveRosterEntry.bind(
                        null,
                        leagueId,
                        teamId,
                        entry.id,
                        "down"
                      )}
                    >
                      <button
                        type="submit"
                        disabled={i === team.rosterEntries.length - 1}
                        aria-label={`Move ${entry.player.firstName} ${entry.player.lastName} down`}
                        className="rounded-sm px-1.5 py-1 text-xs text-muted hover:text-paper disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </form>
                    <form
                      action={removeFromRoster.bind(
                        null,
                        leagueId,
                        teamId,
                        entry.id
                      )}
                    >
                      <button
                        type="submit"
                        aria-label={`Remove ${entry.player.firstName} ${entry.player.lastName}`}
                        className="rounded-sm px-1.5 py-1 text-xs text-muted hover:text-red-400"
                      >
                        ✕
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {canManage && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-medium text-paper">
              Add players
            </h2>
            <form className="mt-3 flex gap-2">
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Search by name…"
                className="w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
              />
              <button
                type="submit"
                className="shrink-0 rounded-sm bg-line px-4 py-2 text-sm font-medium text-paper hover:bg-line/70"
              >
                Search
              </button>
            </form>

            {q && (
              <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
                {searchResults.length === 0 && (
                  <p className="bg-surface px-4 py-4 text-center text-sm text-muted">
                    No players found for &ldquo;{q}&rdquo;.
                  </p>
                )}
                {searchResults.map((player) => {
                  const alreadyRostered = rosteredPlayerIds.has(player.id);
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 last:border-b-0"
                    >
                      <span className="text-sm text-paper">
                        {player.firstName} {player.lastName}
                        <span className="ml-2 font-mono text-xs text-muted">
                          {player.nbaTeam} · {player.primaryPosition}
                        </span>
                      </span>
                      {alreadyRostered ? (
                        <span className="text-xs text-muted">On roster</span>
                      ) : (
                        <form
                          action={addPlayerToRoster.bind(
                            null,
                            leagueId,
                            teamId,
                            player.id
                          )}
                        >
                          <button
                            type="submit"
                            className="rounded-sm bg-pos-forward px-3 py-1 text-xs font-semibold text-ink hover:opacity-90"
                          >
                            Add
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
