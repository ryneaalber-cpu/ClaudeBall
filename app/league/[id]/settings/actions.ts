"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncGamesForDate } from "@/lib/sync";

async function requireCommissioner(leagueId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    throw new Error("Only the commissioner can change league settings");
  }
}

export async function updateCapSettings(leagueId: string, formData: FormData) {
  await requireCommissioner(leagueId);

  const capEnabled = formData.get("capEnabled") === "on";
  const capAmount = Math.max(0, Number(formData.get("capAmount")) || 0);

  await prisma.league.update({
    where: { id: leagueId },
    data: { capEnabled, capAmount },
  });

  revalidatePath(`/league/${leagueId}`);
  revalidatePath(`/league/${leagueId}/settings`);
  revalidatePath(`/league/${leagueId}/trades/new`);
}

/**
 * The missing piece: nothing in this app ever actually triggered
 * lib/sync.ts before now. Player search, drafting, and live scoring all
 * read from the Player/Game/PlayerGameLog tables that only this fills
 * in — without running this at least once, those tables are empty and
 * every search everywhere in the app returns nothing, which looks like
 * a bug but is really just "there's no data yet."
 *
 * Capped at 14 days per run — balldontlie's rate limits make longer
 * ranges unreliable in a single request, and this app has no background
 * job system to retry a partial failure. Run it again with a different
 * range to cover more of a season.
 */
export async function syncDateRange(
  leagueId: string,
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  const session = await auth();
  if (!session?.user?.id) return "Not signed in.";

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    return "Only the commissioner can trigger a sync.";
  }

  const startRaw = formData.get("startDate") as string;
  const endRaw = formData.get("endDate") as string;
  if (!startRaw || !endRaw) return "Pick both a start and end date.";

  const start = new Date(startRaw);
  const end = new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Those dates didn't parse — check the format.";
  }
  if (start > end) return "Start date must be on or before the end date.";

  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
  const maxDays = 14;
  if (totalDays > maxDays) {
    return `Pick a range of ${maxDays} days or fewer at a time — longer ranges risk hitting balldontlie's rate limits partway through.`;
  }

  try {
    let totalGames = 0;
    for (let i = 0; i < totalDays; i++) {
      const d = new Date(start.getTime() + i * dayMs);
      const dateStr = d.toISOString().slice(0, 10);
      const result = await syncGamesForDate(dateStr);
      totalGames += result.gamesProcessed;
    }

    revalidatePath(`/league/${leagueId}/settings`);
    return `Done — synced ${totalGames} game${totalGames === 1 ? "" : "s"} across ${totalDays} day${totalDays === 1 ? "" : "s"}. Players from those games should now show up in search everywhere.`;
  } catch (err) {
    return `Sync failed: ${err instanceof Error ? err.message : "unknown error"}. If this mentions an API key, double check BALLDONTLIE_API_KEY is set correctly in Vercel's environment variables.`;
  }
}
