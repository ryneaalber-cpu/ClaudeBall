import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveSalaryForSeason } from "@/lib/cap";
import { setContract, removeContract, seasonLabelsFrom, MAX_CONTRACT_YEARS } from "./actions";

const CONTRACT_TYPE_LABEL: Record<string, string> = {
  STANDARD: "Standard",
  TWO_WAY: "Two-way",
  EXHIBIT_10: "Exhibit 10",
  UNSIGNED_PICK: "Unsigned pick",
};

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
      contracts: { where: { isActive: true }, include: { years: true } },
    },
  });
  if (!team || team.leagueId !== leagueId) notFound();

  const canManage =
    membership.role === "COMMISSIONER" || team.ownerId === session.user.id;

  const seasons = seasonLabelsFrom(team.league.currentSeason, MAX_CONTRACT_YEARS);
  const contractByPlayer = new Map(team.contracts.map((c) => [c.playerId, c]));

  const totalCommitted = team.contracts.reduce(
    (sum, c) => sum + resolveSalaryForSeason(c.years, team.league.currentSeason),
    0
  );
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
          {team.league.name} · {team.league.currentSeason}
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          Contracts &amp; cap
        </h1>

        <section className="mt-8">
          {team.league.capEnabled ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-surface px-4 py-3 ring-1 ring-line">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Cap</p>
                <p className="stat-figure mt-1 font-display text-2xl font-semibold text-paper">
                  {team.league.capAmount}
                </p>
              </div>
              <div className="rounded-md bg-surface px-4 py-3 ring-1 ring-line">
                <p className="font-mono text-xs uppercase tracking-wide text-muted">
                  Committed ({team.league.currentSeason})
                </p>
                <p className="stat-figure mt-1 font-display text-2xl font-semibold text-paper">
                  {totalCommitted}
                </p>
              </div>
              <div
                className={`rounded-md px-4 py-3 ring-1 ring-line ${capSpace < 0 ? "bg-red-950/40" : "bg-surface"}`}
              >
                <p className="font-mono text-xs uppercase tracking-wide text-muted">Space</p>
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
                Committed, {team.league.currentSeason} (cap off)
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
          <h2 className="font-display text-lg font-medium text-paper">Roster contracts</h2>
          <p className="mt-1 text-xs text-muted">
            Click a player to see or edit the full year-by-year breakdown.
          </p>

          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
            {team.rosterEntries.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No roster yet — add players first.
              </p>
            )}
            {team.rosterEntries.map(({ player }) => {
              const contract = contractByPlayer.get(player.id);
              const fullName = `${player.firstName} ${player.lastName}`;
              const currentSalary = contract
                ? resolveSalaryForSeason(contract.years, team.league.currentSeason)
                : 0;
              const yearsLeft = contract?.years.length ?? 0;
              const salaryBySeason = new Map(contract?.years.map((y) => [y.season, y.salary]) ?? []);

              return (
                <details key={player.id} className="border-b border-line bg-surface last:border-b-0">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
                    <span className="truncate text-sm text-paper">{fullName}</span>
                    <span className="stat-figure shrink-0 font-mono text-xs text-muted">
                      {contract
                        ? contract.contractType === "STANDARD"
                          ? `${currentSalary.toLocaleString()} · ${yearsLeft} yr${yearsLeft === 1 ? "" : "s"}${contract.restriction ? ` · ${contract.restriction}` : ""}`
                          : `${CONTRACT_TYPE_LABEL[contract.contractType]}${contract.restriction ? ` · ${contract.restriction}` : ""}`
                        : "No contract"}
                    </span>
                  </summary>

                  {canManage ? (
                    <form
                      action={setContract.bind(null, leagueId, teamId, player.id)}
                      className="space-y-3 border-t border-line px-4 py-4"
                    >
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs uppercase tracking-wide text-muted">
                            Contract type
                          </label>
                          <select
                            name="contractType"
                            defaultValue={contract?.contractType ?? "STANDARD"}
                            className="mt-1 w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-sm text-paper outline-none focus:border-pos-forward"
                          >
                            <option value="STANDARD">Standard</option>
                            <option value="TWO_WAY">Two-way</option>
                            <option value="EXHIBIT_10">Exhibit 10</option>
                            <option value="UNSIGNED_PICK">Unsigned pick</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs uppercase tracking-wide text-muted">
                            Becomes
                          </label>
                          <select
                            name="restriction"
                            defaultValue={contract?.restriction ?? ""}
                            className="mt-1 w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-sm text-paper outline-none focus:border-pos-forward"
                          >
                            <option value="">—</option>
                            <option value="UFA">UFA</option>
                            <option value="RFA">RFA</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs uppercase tracking-wide text-muted">
                          Spotrac link
                        </label>
                        <input
                          type="url"
                          name="spotracUrl"
                          defaultValue={contract?.spotracUrl ?? ""}
                          placeholder="https://www.spotrac.com/..."
                          className="mt-1 w-full rounded-sm border border-line bg-ink px-2 py-1.5 text-sm text-paper outline-none focus:border-pos-forward"
                        />
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted">
                          Salary by season — leave blank past where the deal ends
                        </p>
                        <div className="mt-1 grid grid-cols-3 gap-2 sm:grid-cols-6">
                          {seasons.map((season, i) => (
                            <div key={season}>
                              <label className="block text-[10px] text-muted">{season}</label>
                              <input
                                type="number"
                                min={0}
                                name={`year${i}salary`}
                                defaultValue={salaryBySeason.get(season) ?? ""}
                                className="mt-0.5 w-full rounded-sm border border-line bg-ink px-1.5 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="submit"
                          className="rounded-sm bg-pos-forward px-3 py-1.5 text-xs font-semibold text-ink hover:opacity-90"
                        >
                          Save
                        </button>
                        {contract && (
                          <button
                            type="submit"
                            formAction={removeContract.bind(null, leagueId, teamId, contract.id)}
                            className="text-xs text-muted hover:text-red-400"
                          >
                            Remove contract
                          </button>
                        )}
                      </div>
                    </form>
                  ) : contract?.spotracUrl ? (
                    <div className="border-t border-line px-4 py-3">
                      <a
                        href={contract.spotracUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-pos-forward hover:underline"
                      >
                        View on Spotrac →
                      </a>
                    </div>
                  ) : null}
                </details>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
