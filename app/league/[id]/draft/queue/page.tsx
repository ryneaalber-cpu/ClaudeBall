import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { addToQueue, removeFromQueue, moveQueueEntry } from "./actions";

export default async function DraftQueuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ team?: string; q?: string }>;
}) {
  const { id: leagueId } = await params;
  const { team: teamParam, q } = await searchParams;

  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();
  const isCommissioner = membership.role === "COMMISSIONER";

  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { teams: { include: { owner: true } } },
  });
  if (!league) notFound();

  const draft = await prisma.draft.findFirst({
    where: { leagueId, season: league.currentSeason },
    orderBy: { createdAt: "desc" },
  });

  if (!draft) {
    return (
      <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href={`/league/${leagueId}/draft`} className="text-sm text-muted hover:text-paper">
            ← Draft
          </Link>
          <p className="mt-6 text-sm text-muted">
            No draft has been started yet — a queue needs a draft to
            belong to.
          </p>
        </div>
      </main>
    );
  }

  const myTeam = league.teams.find((t) => t.ownerId === session.user.id);
  const selectedTeamId = teamParam ?? myTeam?.id ?? league.teams[0]?.id;
  const selectedTeam = league.teams.find((t) => t.id === selectedTeamId);

  if (!selectedTeam) {
    return (
      <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm text-muted">No teams in this league yet.</p>
        </div>
      </main>
    );
  }

  const canManage = isCommissioner || selectedTeam.ownerId === session.user.id;

  const queue = await prisma.draftQueueEntry.findMany({
    where: { draftId: draft.id, teamId: selectedTeam.id },
    include: { player: true },
    orderBy: { rank: "asc" },
  });

  let searchResults: { id: string; firstName: string; lastName: string; nbaTeam: string; primaryPosition: string }[] = [];
  if (q && canManage) {
    const draftedIds = new Set(
      (
        await prisma.draftPick.findMany({
          where: { draftId: draft.id, playerId: { not: null } },
          select: { playerId: true },
        })
      ).map((p) => p.playerId as string)
    );
    const queuedIds = new Set(queue.map((entry) => entry.playerId));

    const found = await prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 15,
      orderBy: { lastName: "asc" },
    });
    searchResults = found.filter((p) => !draftedIds.has(p.id) && !queuedIds.has(p.id));
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}/draft`} className="text-sm text-muted hover:text-paper">
          ← Draft
        </Link>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          {selectedTeam.name}&apos;s queue
        </h1>
        <p className="mt-1 text-sm text-muted">
          Rank players in order of preference. When it&apos;s this team&apos;s
          turn, anyone in the league can auto-pick the highest-ranked
          player here who&apos;s still available — no need to be present
          the moment it happens.
        </p>

        {isCommissioner && league.teams.length > 1 && (
          <form className="mt-4 flex items-center gap-2 text-sm">
            <label htmlFor="team" className="text-muted">
              Viewing queue for
            </label>
            <select
              id="team"
              name="team"
              defaultValue={selectedTeam.id}
              className="rounded-sm border border-line bg-surface px-2 py-1 text-paper outline-none focus:border-pos-forward"
            >
              {league.teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="rounded-sm bg-line px-3 py-1 text-paper hover:bg-line/70"
            >
              Switch
            </button>
          </form>
        )}

        <section className="mt-8">
          <h2 className="font-display text-lg font-medium text-paper">
            Current queue
          </h2>
          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
            {queue.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                Nothing queued yet — search below to add players.
              </p>
            )}
            {queue.map((entry, i) => (
              <div
                key={entry.id}
                className="flex items-center gap-3 border-b border-line bg-surface px-4 py-3 text-sm last:border-b-0"
              >
                <span className="font-mono text-xs text-muted">{i + 1}</span>
                <span className="flex-1 truncate text-paper">
                  {entry.player.firstName} {entry.player.lastName}
                  <span className="ml-2 font-mono text-xs text-muted">
                    {entry.player.nbaTeam} · {entry.player.primaryPosition}
                  </span>
                </span>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <form action={moveQueueEntry.bind(null, leagueId, draft.id, entry.id, "up")}>
                      <button
                        type="submit"
                        disabled={i === 0}
                        aria-label={`Move ${entry.player.firstName} ${entry.player.lastName} up`}
                        className="rounded-sm px-1.5 py-1 text-xs text-muted hover:text-paper disabled:opacity-30"
                      >
                        ↑
                      </button>
                    </form>
                    <form action={moveQueueEntry.bind(null, leagueId, draft.id, entry.id, "down")}>
                      <button
                        type="submit"
                        disabled={i === queue.length - 1}
                        aria-label={`Move ${entry.player.firstName} ${entry.player.lastName} down`}
                        className="rounded-sm px-1.5 py-1 text-xs text-muted hover:text-paper disabled:opacity-30"
                      >
                        ↓
                      </button>
                    </form>
                    <form action={removeFromQueue.bind(null, leagueId, draft.id, entry.id)}>
                      <button
                        type="submit"
                        aria-label={`Remove ${entry.player.firstName} ${entry.player.lastName} from queue`}
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
          <section className="mt-8">
            <h2 className="font-display text-lg font-medium text-paper">
              Add players
            </h2>
            <form className="mt-3 flex gap-2">
              <input type="hidden" name="team" value={selectedTeam.id} />
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
                    No available players found for &ldquo;{q}&rdquo;.
                  </p>
                )}
                {searchResults.map((player) => (
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
                    <form
                      action={addToQueue.bind(null, leagueId, draft.id, selectedTeam.id, player.id)}
                    >
                      <button
                        type="submit"
                        className="rounded-sm bg-pos-forward px-3 py-1 text-xs font-semibold text-ink hover:opacity-90"
                      >
                        Add to queue
                      </button>
                    </form>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
