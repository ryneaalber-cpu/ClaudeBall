"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Same authorization shape as roster management: the team's own owner or the league commissioner. */
async function assertCanManageContracts(leagueId: string, teamId: string) {
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
    throw new Error("Not authorized to manage this team's contracts");
  }
}

/**
 * Creates or updates the one active contract a player has with this
 * team. Assumes a player has at most one active contract per team at a
 * time — reasonable for now, but if this league ever wants contract
 * HISTORY (past deals kept for reference instead of overwritten), this
 * is the spot that changes: set isActive: false on the old row and
 * create a new one, instead of updating in place.
 *
 * Sanity-clamps input instead of a full error-message UI — keeps every
 * row a plain form instead of needing a client component per row just
 * to show validation feedback. Fine for a private league tool; revisit
 * if this ever needs to be bulletproof against bad input.
 */
export async function setContract(
  leagueId: string,
  teamId: string,
  playerId: string,
  formData: FormData
) {
  await assertCanManageContracts(leagueId, teamId);

  const salary = Math.max(0, Number(formData.get("salary")) || 0);
  const yearsTotal = Math.max(1, Number(formData.get("yearsTotal")) || 1);
  const yearsRemaining = Math.min(
    Math.max(0, Number(formData.get("yearsRemaining")) || 0),
    yearsTotal
  );
  const startSeason = (formData.get("startSeason") as string) || "";

  const existing = await prisma.contract.findFirst({
    where: { playerId, teamId, isActive: true },
  });

  if (existing) {
    await prisma.contract.update({
      where: { id: existing.id },
      data: { salary, yearsTotal, yearsRemaining, startSeason },
    });
  } else {
    await prisma.contract.create({
      data: {
        playerId,
        teamId,
        salary,
        yearsTotal,
        yearsRemaining,
        startSeason,
        isActive: true,
      },
    });
  }

  revalidatePath(`/league/${leagueId}/team/${teamId}/contracts`);
}

export async function removeContract(
  leagueId: string,
  teamId: string,
  contractId: string,
  _formData: FormData
) {
  await assertCanManageContracts(leagueId, teamId);
  await prisma.contract.delete({ where: { id: contractId } });
  revalidatePath(`/league/${leagueId}/team/${teamId}/contracts`);
}
