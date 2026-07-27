import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { respondToTrade, cancelTrade, declineAndCounter } from "./actions";

const RESPONSE_LABEL: Record<string, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

const STATUS_LABEL: Record<string, string> = {
  ACCEPTED: "Accepted",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export default async function TradesPage({
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

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  const trades = await prisma.trade.findMany({
    where: { leagueId },
    include: {
      participants: { include: { team: true } },
      items: { include: { player: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const pending = trades.filter((t) => t.status === "PENDING");
  const resolved = trades.filter((t) => t.status !== "PENDING");

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
          ← {league.name}
        </Link>
        <div className="mt-3 flex items-center justify-between">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            Trades
          </h1>
          <Link
            href={`/league/${leagueId}/trades/new`}
            className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink hover:opacity-90"
          >
            Propose a trade
          </Link>
        </div>

        <section className="mt-8">
          <h2 className="font-display text-lg font-medium text-paper">Pending</h2>
          <div className="mt-3 space-y-4">
            {pending.length === 0 && (
              <p className="rounded-md bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-line">
                No pending trades.
              </p>
            )}
            {pending.map((trade) => (
              <div key={trade.id} className="rounded-md bg-surface p-4 ring-1 ring-line">
                <div className="space-y-1 text-sm">
                  {trade.items.map((item) => {
                    const from = trade.participants.find((p) => p.teamId === item.fromTeamId)?.team.name ?? "?";
                    const to = trade.participants.find((p) => p.teamId === item.toTeamId)?.team.name ?? "?";
                    return (
                      <p key={item.id} className="text-paper">
                        <span className="text-muted">{from} → {to}:</span>{" "}
                        {item.player.firstName} {item.player.lastName}
                      </p>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-2 border-t border-line pt-3">
                  {trade.participants.map((participant) => {
                    const canActForThis =
                      isCommissioner || participant.team.ownerId === session.user.id;
                    const isPendingResponse = participant.response === "PENDING";

                    return (
                      <div key={participant.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="text-muted">
                          {participant.team.name}
                          {participant.isProposer && " (proposer)"} —{" "}
                          <span className="text-paper">{RESPONSE_LABEL[participant.response]}</span>
                        </span>

                        {canActForThis && isPendingResponse && !participant.isProposer && (
                          <div className="flex gap-1.5">
                            <form action={respondToTrade.bind(null, leagueId, trade.id, participant.teamId, "ACCEPTED")}>
                              <button type="submit" className="rounded-sm bg-pos-forward px-2.5 py-1 font-semibold text-ink hover:opacity-90">
                                Accept
                              </button>
                            </form>
                            <form action={respondToTrade.bind(null, leagueId, trade.id, participant.teamId, "DECLINED")}>
                              <button type="submit" className="rounded-sm bg-line px-2.5 py-1 text-paper hover:bg-line/70">
                                Decline
                              </button>
                            </form>
                            <form action={declineAndCounter.bind(null, leagueId, trade.id, participant.teamId)}>
                              <button type="submit" className="rounded-sm bg-line px-2.5 py-1 text-paper hover:bg-line/70">
                                Decline &amp; counter
                              </button>
                            </form>
                          </div>
                        )}

                        {canActForThis && participant.isProposer && (
                          <form action={cancelTrade.bind(null, leagueId, trade.id)}>
                            <button type="submit" className="rounded-sm bg-line px-2.5 py-1 text-paper hover:bg-line/70">
                              Cancel offer
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-medium text-paper">History</h2>
          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
            {resolved.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No resolved trades yet.
              </p>
            )}
            {resolved.map((trade) => (
              <div
                key={trade.id}
                className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 text-sm last:border-b-0"
              >
                <span className="text-paper">
                  {trade.participants.map((p) => p.team.name).join(" ↔ ")}
                </span>
                <span className="font-mono text-xs text-muted">
                  {STATUS_LABEL[trade.status] ?? trade.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
