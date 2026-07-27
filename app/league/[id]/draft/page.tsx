import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { startDraft, makePick, autoPickForOnTheClock } from "./actions";

export default async function DraftPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { id: leagueId } = await params;
  const { q } = await searchParams;

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

  const draft = await prisma.draft.findFirst({
    where: { leagueId, season: league.currentSeason },
    orderBy: { createdAt: "desc" },
    include: {
      picks: {
        orderBy: { pickNumber: "asc" },
        include: { team: true, player: true },
      },
    },
  });

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
          ← {league.name}
        </Link>
        <p className="mt-3 font-mono text-xs uppercase tracking-[0.2em] text-muted">
          {league.currentSeason}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          Draft
        </h1>
        <Link
          href={`/league/${leagueId}/draft/queue`}
          className="mt-1 inline-block text-sm text-pos-forward hover:underline"
        >
          Manage your queue →
        </Link>

        {!draft && (
          <section className="mt-8">
            {isCommissioner ? (
              <form
                action={startDraft.bind(null, leagueId)}
                className="w-full max-w-sm space-y-4 rounded-md bg-surface p-6 ring-1 ring-line"
              >
                <p className="text-sm text-muted">
                  No draft yet for {league.currentSeason}. This randomizes
                  team order and lays out every pick as a snake draft —
                  rounds reverse order each time through.
                </p>
                <div>
                  <label htmlFor="rounds" className="block text-xs uppercase tracking-wide text-muted">
                    Rounds
                  </label>
                  <input
                    id="rounds"
                    name="rounds"
                    type="number"
                    min={1}
                    max={30}
                    defaultValue={13}
                    className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90"
                >
                  Start the draft
                </button>
              </form>
            ) : (
              <p className="text-sm text-muted">
                The commissioner hasn&apos;t started a draft for{" "}
                {league.currentSeason} yet.
              </p>
            )}
          </section>
        )}

        {draft && (
          <DraftBoard
            leagueId={leagueId}
            draft={draft}
            currentUserId={session.user.id}
            isCommissioner={isCommissioner}
            searchQuery={q}
          />
        )}
      </div>
    </main>
  );
}

type DraftWithPicks = Prisma.DraftGetPayload<{
  include: {
    picks: {
      include: { team: true; player: true };
    };
  };
}>;

async function DraftBoard({
  leagueId,
  draft,
  currentUserId,
  isCommissioner,
  searchQuery,
}: {
  leagueId: string;
  draft: DraftWithPicks;
  currentUserId: string;
  isCommissioner: boolean;
  searchQuery?: string;
}) {
  const nextPick = draft.picks.find((p) => !p.playerId);
  const isOnTheClock = nextPick?.team.ownerId === currentUserId;
  const canPick = Boolean(nextPick) && (isCommissioner || isOnTheClock);

  const queuedCount = nextPick
    ? await prisma.draftQueueEntry.count({
        where: { draftId: draft.id, teamId: nextPick.teamId },
      })
    : 0;

  let searchResults: { id: string; firstName: string; lastName: string; nbaTeam: string; primaryPosition: string }[] = [];
  if (searchQuery && canPick) {
    const excluded = new Set(
      draft.picks.filter((p) => p.playerId).map((p) => p.playerId as string)
    );
    const rostered = await prisma.rosterEntry.findMany({
      where: { team: { leagueId } },
      select: { playerId: true },
    });
    rostered.forEach((r) => excluded.add(r.playerId));

    const found = await prisma.player.findMany({
      where: {
        OR: [
          { firstName: { contains: searchQuery, mode: "insensitive" } },
          { lastName: { contains: searchQuery, mode: "insensitive" } },
        ],
      },
      take: 15,
      orderBy: { lastName: "asc" },
    });
    searchResults = found.filter((p) => !excluded.has(p.id));
  }

  return (
    <>
      <section className="mt-8 flex items-center justify-between rounded-md bg-surfaceRaised px-5 py-4 ring-1 ring-line">
        <div>
          <p className="font-mono text-xs uppercase tracking-wide text-muted">
            {draft.status === "COMPLETED" ? "Draft complete" : "On the clock"}
          </p>
          <p className="mt-1 font-display text-xl font-semibold text-paper">
            {nextPick ? nextPick.team.name : "All picks made"}
          </p>
          {nextPick && (
            <p className="mt-1 text-xs text-muted">
              {queuedCount > 0
                ? `${queuedCount} player${queuedCount === 1 ? "" : "s"} queued`
                : "No queue set for this team"}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {nextPick && (
            <span className="stat-figure font-mono text-sm text-muted">
              Pick {nextPick.pickNumber} · Round {nextPick.round}
            </span>
          )}
          {nextPick && (
            <form action={autoPickForOnTheClock.bind(null, leagueId, draft.id)}>
              <button
                type="submit"
                disabled={queuedCount === 0}
                title={
                  queuedCount === 0
                    ? "This team has no queue set — nothing to auto-pick from"
                    : `Drafts ${nextPick.team.name}'s top available queued player`
                }
                className="rounded-sm bg-line px-3 py-1.5 text-xs font-medium text-paper hover:bg-line/70 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Auto-pick from queue
              </button>
            </form>
          )}
        </div>
      </section>

      {canPick && (
        <section className="mt-6">
          <form className="flex gap-2">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search available players…"
              className="w-full rounded-sm border border-line bg-surface px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
            />
            <button
              type="submit"
              className="shrink-0 rounded-sm bg-line px-4 py-2 text-sm font-medium text-paper hover:bg-line/70"
            >
              Search
            </button>
          </form>

          {searchQuery && (
            <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
              {searchResults.length === 0 && (
                <p className="bg-surface px-4 py-4 text-center text-sm text-muted">
                  No available players found for &ldquo;{searchQuery}&rdquo;.
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
                  <form action={makePick.bind(null, leagueId, draft.id, player.id)}>
                    <button
                      type="submit"
                      className="rounded-sm bg-pos-forward px-3 py-1 text-xs font-semibold text-ink hover:opacity-90"
                    >
                      Draft
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="mt-10">
        <h2 className="font-display text-lg font-medium text-paper">
          Draft board
        </h2>
        <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
          {draft.picks.map((pick) => (
            <div
              key={pick.id}
              className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2 text-sm last:border-b-0"
            >
              <span className="w-12 shrink-0 font-mono text-xs text-muted">
                {pick.pickNumber}.
              </span>
              <span className="w-32 shrink-0 truncate text-muted">
                {pick.team.name}
              </span>
              <span className="flex-1 text-paper">
                {pick.player
                  ? `${pick.player.firstName} ${pick.player.lastName}`
                  : "—"}
              </span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
