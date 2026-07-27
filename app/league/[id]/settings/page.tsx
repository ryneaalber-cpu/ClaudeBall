import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { updateCapSettings } from "./actions";
import { SyncForm } from "./sync-form";

export default async function LeagueSettingsPage({
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

  const league = await prisma.league.findUnique({ where: { id: leagueId } });
  if (!league) notFound();

  if (membership.role !== "COMMISSIONER") {
    return (
      <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
        <div className="mx-auto max-w-3xl">
          <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
            ← {league.name}
          </Link>
          <p className="mt-6 text-sm text-muted">
            Only the commissioner can change league settings.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <Link href={`/league/${leagueId}`} className="text-sm text-muted hover:text-paper">
          ← {league.name}
        </Link>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          Settings
        </h1>

        <div className="mt-8">
          <SyncForm leagueId={leagueId} />
        </div>

        <form
          action={updateCapSettings.bind(null, leagueId)}
          className="mt-6 w-full max-w-sm space-y-5 rounded-md bg-surface p-6 ring-1 ring-line"
        >
          <div>
            <h2 className="font-display text-lg font-medium text-paper">
              Salary cap
            </h2>
            <p className="mt-1 text-xs text-muted">
              Turning this off doesn&apos;t delete anyone&apos;s contracts —
              salaries stay on record, they just stop being enforced or
              shown as a hard limit on the contracts and trade pages.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-paper">
            <input
              type="checkbox"
              name="capEnabled"
              defaultChecked={league.capEnabled}
            />
            Enable salary cap
          </label>

          <div>
            <label htmlFor="capAmount" className="block text-xs uppercase tracking-wide text-muted">
              Cap amount
            </label>
            <input
              id="capAmount"
              name="capAmount"
              type="number"
              min={0}
              defaultValue={league.capAmount}
              className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Save
          </button>
        </form>

        <p className="mt-4 text-xs text-muted">
          More league settings (scoring weights, position minute-pools,
          league name/season) belong here too eventually — this page is
          scoped to just the cap for now since that was the immediate ask.
        </p>
      </div>
    </main>
  );
}
