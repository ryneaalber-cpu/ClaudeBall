import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { setContract, removeContract } from "./actions";

export default async function ContractsPage({
  params,
}: {
  params: Promise<{ id: string; teamId: string }>;
}) {
  const { id: leagueId, teamId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) notFound();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: true,
      rosterEntries: {
        include: { player: true },
        orderBy: { priorityOrder: "asc" },
      },
      contracts: { where: { isActive: true } },
    },
  });
  if (!team || team.leagueId !== leagueId) notFound();

  const canManage =
    membership.role === "COMMISSIONER" || team.ownerId === session.user.id;

  const contractByPlayer = new Map(team.contracts.map((c) => [c.playerId, c]));
  const totalCommitted = team.contracts.reduce((sum, c) => sum + c.salary, 0);
  const capSpace = team.league.capAmount - totalCommitted;

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
          Contracts &amp; cap
        </h1>

        <section className="mt-8">
          {team.league.capEnabled ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-surface px-4 py-3 ring-1 ring-line">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">
                  Cap
                </p>
                <p className="stat-figure mt-1 font-display text-2xl font-semibold text-paper">
                  {team.league.capAmount}
                </p>
              </div>
              <div className="rounded-md bg-surface px-4 py-3 ring-1 ring-line">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">
                  Committed
                </p>
                <p className="stat-figure mt-1 font-display text-2xl font-semibold text-paper">
                  {totalCommitted}
                </p>
              </div>
              <div
                className={`rounded-md px-4 py-3 ring-1 ring-line ${capSpace < 0 ? "bg-red-950/40" : "bg-surface"}`}
              >
                <p className="font-mono text-xs uppercase tracking-wide text-muted">
                  Space
                </p>
                <p
                  className={`stat-figure mt-1 font-display text-2xl font-semibold ${capSpace < 0 ? "text-red-400" : "text-pos-guard"}`}
                >
                  {capSpace}
                </p>
              </div>
            </div>
          ) : (
            <div className="rounded-md bg-surface px-4 py-3 ring-1 ring-line">
              <p className="font-mono text-xs uppercase tracking-wide text-muted">
                Committed (cap off)
              </p>
              <p className="stat-figure mt-1 font-display text-2xl font-semibold text-paper">
                {totalCommitted}
              </p>
              <p className="mt-1 text-xs text-muted">
                Salaries are tracked but not enforced —{" "}
                <Link href={`/league/${leagueId}/settings`} className="text-pos-forward hover:underline">
                  turn the cap on in settings
                </Link>{" "}
                if that changes.
              </p>
            </div>
          )}
        </section>

        <section className="mt-10">
          <h2 className="font-display text-lg font-medium text-paper">
            Roster contracts
          </h2>

          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
            {team.rosterEntries.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No roster yet — add players first.
              </p>
            )}
            {team.rosterEntries.map(({ player }) => {
              const contract = contractByPlayer.get(player.id);
              const fullName = `${player.firstName} ${player.lastName}`;

              return (
                <div
                  key={player.id}
                  className="flex items-center gap-2 border-b border-line bg-surface px-4 py-3 last:border-b-0"
                >
                  {canManage ? (
                    <>
                      <form
                        action={setContract.bind(null, leagueId, teamId, player.id)}
                        className="flex flex-1 flex-wrap items-center gap-2"
                      >
                        <span className="w-36 shrink-0 truncate text-sm text-paper">
                          {fullName}
                        </span>
                        <input
                          name="salary"
                          type="number"
                          min={0}
                          defaultValue={contract?.salary}
                          placeholder="Salary"
                          aria-label={`${fullName} salary`}
                          className="w-20 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                        />
                        <input
                          name="yearsTotal"
                          type="number"
                          min={1}
                          defaultValue={contract?.yearsTotal}
                          placeholder="Yrs"
                          aria-label={`${fullName} contract length in years`}
                          className="w-14 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                        />
                        <input
                          name="yearsRemaining"
                          type="number"
                          min={0}
                          defaultValue={contract?.yearsRemaining}
                          placeholder="Left"
                          aria-label={`${fullName} years remaining`}
                          className="w-14 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                        />
                        <input
                          name="startSeason"
                          type="text"
                          defaultValue={contract?.startSeason}
                          placeholder="Start"
                          aria-label={`${fullName} contract start season`}
                          className="w-20 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                        />
                        <button
                          type="submit"
                          className="rounded-sm bg-pos-forward px-2 py-1 text-xs font-semibold text-ink hover:opacity-90"
                        >
                          Save
                        </button>
                      </form>
                      {contract && (
                        <form
                          action={removeContract.bind(null, leagueId, teamId, contract.id)}
                        >
                          <button
                            type="submit"
                            aria-label={`Remove ${fullName}'s contract`}
                            className="px-1 text-xs text-muted hover:text-red-400"
                          >
                            ✕
                          </button>
                        </form>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-1 items-center justify-between">
                      <span className="text-sm text-paper">{fullName}</span>
                      <span className="stat-figure font-mono text-xs text-muted">
                        {contract
                          ? `${contract.salary} · ${contract.yearsRemaining}/${contract.yearsTotal} yrs`
                          : "No contract"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
