"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Only the league commissioner or the team's own owner can edit a roster — everyone else can view it. */
async function assertCanManageRoster(leagueId: string, teamId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const [membership, team] = await Promise.all([
    prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId: session.user.id, leagueId } },
    }),
    prisma.team.findUnique({ where: { id: teamId } }),
  ]);

  if (!team || team.leagueId !== leagueId) notFound();

  const isCommissioner = membership?.role === "COMMISSIONER";
  const isOwner = team.ownerId === session.user.id;
  if (!isCommissioner && !isOwner) {
    throw new Error("Not authorized to manage this roster");
  }
}

export async function addPlayerToRoster(
  leagueId: string,
  teamId: string,
  playerId: string,
  _formData: FormData
) {
  await assertCanManageRoster(leagueId, teamId);

  const highest = await prisma.rosterEntry.aggregate({
    where: { teamId },
    _max: { priorityOrder: true },
  });

  await prisma.rosterEntry.create({
    data: { teamId, playerId, priorityOrder: (highest._max.priorityOrder ?? 0) + 1 },
  });

  revalidatePath(`/league/${leagueId}/team/${teamId}`);
}

export async function removeFromRoster(
  leagueId: string,
  teamId: string,
  rosterEntryId: string,
  _formData: FormData
) {
  await assertCanManageRoster(leagueId, teamId);
  await prisma.rosterEntry.delete({ where: { id: rosterEntryId } });
  revalidatePath(`/league/${leagueId}/team/${teamId}`);
}

/**
 * Swaps priorityOrder with the adjacent entry. This is what the scoring
 * engine actually reads to decide fill order, so "moving a player up"
 * here is the same lever as "who gets minutes first" in a real game.
 */
export async function moveRosterEntry(
  leagueId: string,
  teamId: string,
  rosterEntryId: string,
  direction: "up" | "down",
  _formData: FormData
) {
  await assertCanManageRoster(leagueId, teamId);

  const entries = await prisma.rosterEntry.findMany({
    where: { teamId },
    orderBy: { priorityOrder: "asc" },
  });

  const index = entries.findIndex((e) => e.id === rosterEntryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= entries.length) return;

  const current = entries[index];
  const neighbor = entries[swapIndex];

  await prisma.$transaction([
    prisma.rosterEntry.update({
      where: { id: current.id },
      data: { priorityOrder: neighbor.priorityOrder },
    }),
    prisma.rosterEntry.update({
      where: { id: neighbor.id },
      data: { priorityOrder: current.priorityOrder },
    }),
  ]);

  revalidatePath(`/league/${leagueId}/team/${teamId}`);
}
