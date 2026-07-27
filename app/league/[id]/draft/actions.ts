"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSnakeOrder } from "@/lib/draft";

async function requireCommissioner(leagueId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    throw new Error("Only the commissioner can do this");
  }
}

/** Starts a new draft: randomizes team order, generates every pick slot up front via generateSnakeOrder. */
export async function startDraft(leagueId: string, formData: FormData) {
  await requireCommissioner(leagueId);

  const rounds = Math.max(1, Math.min(30, Number(formData.get("rounds")) || 1));

  const [league, teams] = await Promise.all([
    prisma.league.findUniqueOrThrow({ where: { id: leagueId } }),
    prisma.team.findMany({ where: { leagueId } }),
  ]);

  if (teams.length === 0) {
    throw new Error("Add at least one team before starting a draft");
  }

  const shuffled = [...teams].sort(() => Math.random() - 0.5);
  const slots = generateSnakeOrder(shuffled.map((t) => t.id), rounds);

  await prisma.draft.create({
    data: {
      leagueId,
      season: league.currentSeason,
      rounds,
      status: "IN_PROGRESS",
      picks: {
        create: slots.map((s) => ({
          pickNumber: s.pickNumber,
          round: s.round,
          teamId: s.teamId,
        })),
      },
    },
  });

  revalidatePath(`/league/${leagueId}/draft`);
}

/**
 * Shared by makePick and autoPickForOnTheClock: records the pick,
 * creates the matching roster entry, and checks whether the draft is
 * now complete. Pulled out once there were two different ways a pick
 * could be made, so the "what actually happens when a pick is made"
 * logic only exists in one place.
 */
async function executePick(
  draftId: string,
  pick: { id: string; teamId: string; pickNumber: number },
  playerId: string
) {
  await prisma.$transaction([
    prisma.draftPick.update({
      where: { id: pick.id },
      data: { playerId, madeAt: new Date() },
    }),
    prisma.rosterEntry.create({
      data: {
        teamId: pick.teamId,
        playerId,
        priorityOrder: pick.pickNumber,
      },
    }),
  ]);

  const remaining = await prisma.draftPick.count({
    where: { draftId, playerId: null },
  });
  if (remaining === 0) {
    await prisma.draft.update({
      where: { id: draftId },
      data: { status: "COMPLETED" },
    });
  }
}

export async function makePick(
  leagueId: string,
  draftId: string,
  playerId: string,
  _formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const nextPick = await prisma.draftPick.findFirst({
    where: { draftId, playerId: null },
    orderBy: { pickNumber: "asc" },
    include: { team: true },
  });
  if (!nextPick) throw new Error("This draft is already complete");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  const isCommissioner = membership?.role === "COMMISSIONER";
  const isOnTheClock = nextPick.team.ownerId === session.user.id;
  if (!isCommissioner && !isOnTheClock) {
    throw new Error("It's not your pick");
  }

  const alreadyDrafted = await prisma.draftPick.findFirst({
    where: { draftId, playerId },
  });
  if (alreadyDrafted) throw new Error("That player is already drafted");

  await executePick(draftId, nextPick, playerId);
  revalidatePath(`/league/${leagueId}/draft`);
}

/**
 * Drafts the highest-ranked available player from the on-the-clock
 * team's queue (see DraftQueueEntry). Any signed-in league member can
 * trigger this — it only ever executes a choice that team already made
 * in advance by building their queue, so acting on their behalf doesn't
 * override anything. That's the actual point of a "passive" draft:
 * queued preferences count even when the owner isn't around to click
 * themselves.
 */
export async function autoPickForOnTheClock(
  leagueId: string,
  draftId: string,
  _formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) throw new Error("Not a member of this league");

  const nextPick = await prisma.draftPick.findFirst({
    where: { draftId, playerId: null },
    orderBy: { pickNumber: "asc" },
  });
  if (!nextPick) throw new Error("This draft is already complete");

  const queue = await prisma.draftQueueEntry.findMany({
    where: { draftId, teamId: nextPick.teamId },
    orderBy: { rank: "asc" },
  });

  for (const entry of queue) {
    const alreadyDrafted = await prisma.draftPick.findFirst({
      where: { draftId, playerId: entry.playerId },
    });
    if (!alreadyDrafted) {
      await executePick(draftId, nextPick, entry.playerId);
      revalidatePath(`/league/${leagueId}/draft`);
      return;
    }
  }

  throw new Error(
    "This team has no queued players left available — someone needs to make a manual pick instead"
  );
}
