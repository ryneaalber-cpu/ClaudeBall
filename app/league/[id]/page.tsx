import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AddTeamForm } from "./add-team-form";
import { ClaimTeamForm } from "./claim-team-form";
import { SignOutButton } from "@/components/sign-out-button";

export default async function LeagueDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const league = await prisma.league.findUnique({
    where: { id },
    include: {
      teams: { include: { owner: true } },
      memberships: { where: { userId: session.user.id } },
    },
  });

  // Not found AND not-a-member both 404, rather than leaking whether a
  // given league id exists to people who aren't in it.
  if (!league || league.memberships.length === 0) notFound();

  const isCommissioner = league.memberships[0].role === "COMMISSIONER";

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-start justify-between">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
            {league.currentSeason}
          </p>
          <SignOutButton />
        </div>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          {league.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Cap {league.capAmount} · {league.teams.length} team
          {league.teams.length === 1 ? "" : "s"}
        </p>
        <div className="mt-2 flex flex-wrap gap-4">
          <Link
            href={`/league/${league.id}/schedule`}
            className="text-sm text-pos-forward hover:underline"
          >
            Schedule →
          </Link>
          <Link
            href={`/league/${league.id}/standings`}
            className="text-sm text-pos-forward hover:underline"
          >
            Standings →
          </Link>
          <Link
            href={`/league/${league.id}/draft`}
            className="text-sm text-pos-forward hover:underline"
          >
            Draft →
          </Link>
          <Link
            href={`/league/${league.id}/trades`}
            className="text-sm text-pos-forward hover:underline"
          >
            Trades →
          </Link>
          <Link
            href={`/league/${league.id}/settings`}
            className="text-sm text-pos-forward hover:underline"
          >
            Settings →
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="font-display text-lg font-medium text-paper">
            Teams
          </h2>
          <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
            {league.teams.length === 0 && (
              <p className="bg-surface px-4 py-6 text-center text-sm text-muted">
                No teams yet — add the first one below.
              </p>
            )}
            {league.teams.map((team) => (
              <div
                key={team.id}
                className="flex items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 last:border-b-0"
              >
                <Link
                  href={`/league/${league.id}/team/${team.id}`}
                  className="flex-1 truncate text-sm font-medium text-paper transition hover:underline"
                >
                  {team.name}
                </Link>
                {team.owner ? (
                  <span className="font-mono text-xs text-muted">
                    {team.owner.username}
                  </span>
                ) : isCommissioner ? (
                  <ClaimTeamForm leagueId={league.id} teamId={team.id} />
                ) : (
                  <span className="font-mono text-xs text-muted">Unclaimed</span>
                )}
              </div>
            ))}
          </div>
        </section>

        {isCommissioner && (
          <section className="mt-10">
            <h2 className="font-display text-lg font-medium text-paper">
              Add a team
            </h2>
            <div className="mt-3">
              <AddTeamForm leagueId={league.id} />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
