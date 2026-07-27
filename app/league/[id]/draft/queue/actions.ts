"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Same shape as everywhere else: the team's own owner, or the commissioner, can act for a team. */
async function assertCanManageQueue(leagueId: string, teamId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const [membership, team] = await Promise.all([
    prisma.leagueMembership.findUnique({
      where: { userId_leagueId: { userId: session.user.id, leagueId } },
    }),
    prisma.team.findUnique({ where: { id: teamId } }),
  ]);

  if (!team || team.leagueId !== leagueId) throw new Error("Team not found");
  const isCommissioner = membership?.role === "COMMISSIONER";
  if (!isCommissioner && team.ownerId !== session.user.id) {
    throw new Error("Not authorized to manage this team's queue");
  }
}

export async function addToQueue(
  leagueId: string,
  draftId: string,
  teamId: string,
  playerId: string,
  _formData: FormData
) {
  await assertCanManageQueue(leagueId, teamId);

  const existing = await prisma.draftQueueEntry.findUnique({
    where: { draftId_teamId_playerId: { draftId, teamId, playerId } },
  });
  if (existing) return; // already queued — nothing to do

  const highest = await prisma.draftQueueEntry.aggregate({
    where: { draftId, teamId },
    _max: { rank: true },
  });

  await prisma.draftQueueEntry.create({
    data: { draftId, teamId, playerId, rank: (highest._max.rank ?? 0) + 1 },
  });

  revalidatePath(`/league/${leagueId}/draft/queue`);
}

export async function removeFromQueue(
  leagueId: string,
  draftId: string,
  queueEntryId: string,
  _formData: FormData
) {
  const entry = await prisma.draftQueueEntry.findUnique({ where: { id: queueEntryId } });
  if (!entry || entry.draftId !== draftId) throw new Error("Queue entry not found");
  await assertCanManageQueue(leagueId, entry.teamId);

  await prisma.draftQueueEntry.delete({ where: { id: queueEntryId } });
  revalidatePath(`/league/${leagueId}/draft/queue`);
}

export async function moveQueueEntry(
  leagueId: string,
  draftId: string,
  queueEntryId: string,
  direction: "up" | "down",
  _formData: FormData
) {
  const entry = await prisma.draftQueueEntry.findUnique({ where: { id: queueEntryId } });
  if (!entry || entry.draftId !== draftId) throw new Error("Queue entry not found");
  await assertCanManageQueue(leagueId, entry.teamId);

  const queue = await prisma.draftQueueEntry.findMany({
    where: { draftId, teamId: entry.teamId },
    orderBy: { rank: "asc" },
  });

  const index = queue.findIndex((e) => e.id === queueEntryId);
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || swapIndex < 0 || swapIndex >= queue.length) return;

  const current = queue[index];
  const neighbor = queue[swapIndex];

  await prisma.$transaction([
    prisma.draftQueueEntry.update({ where: { id: current.id }, data: { rank: neighbor.rank } }),
    prisma.draftQueueEntry.update({ where: { id: neighbor.id }, data: { rank: current.rank } }),
  ]);

  revalidatePath(`/league/${leagueId}/draft/queue`);
}
