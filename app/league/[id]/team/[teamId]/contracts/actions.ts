"use server";

import { revalidatePath } from "next/cache";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { nextSeason } from "@/lib/season";

export const MAX_CONTRACT_YEARS = 6;

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

/** The MAX_CONTRACT_YEARS season labels a contract form should show, starting from the league's current season. */
export function seasonLabelsFrom(currentSeason: string, count: number): string[] {
  const labels = [currentSeason];
  for (let i = 1; i < count; i++) labels.push(nextSeason(labels[i - 1]));
  return labels;
}

/**
 * Creates or updates the one active contract a player has with this
 * team, including its full per-season salary breakdown. Assumes a
 * player has at most one active contract per team at a time —
 * reasonable for now, but if this league ever wants contract HISTORY
 * (past deals kept for reference instead of overwritten), this is the
 * spot that changes: set isActive: false on the old row and create a
 * new one, instead of updating in place.
 *
 * Year inputs are named year0salary..year{N-1}salary, matching
 * whatever season labels the form rendered (see seasonLabelsFrom) — a
 * blank one just means the deal doesn't run that far, not an error.
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

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });
  const seasons = seasonLabelsFrom(league.currentSeason, MAX_CONTRACT_YEARS);

  const contractTypeRaw = formData.get("contractType") as string;
  const contractType = ["STANDARD", "TWO_WAY", "EXHIBIT_10", "UNSIGNED_PICK"].includes(contractTypeRaw)
    ? (contractTypeRaw as "STANDARD" | "TWO_WAY" | "EXHIBIT_10" | "UNSIGNED_PICK")
    : "STANDARD";

  const restrictionRaw = formData.get("restriction") as string;
  const restriction = restrictionRaw === "UFA" || restrictionRaw === "RFA" ? restrictionRaw : null;

  const spotracUrl = ((formData.get("spotracUrl") as string) || "").trim() || null;

  const years = seasons
    .map((season, i) => ({
      season,
      salary: Math.max(0, Number(formData.get(`year${i}salary`)) || 0),
    }))
    .filter((y) => y.salary > 0);

  const existing = await prisma.contract.findFirst({
    where: { playerId, teamId, isActive: true },
  });

  const contractId = existing
    ? (
        await prisma.contract.update({
          where: { id: existing.id },
          data: { contractType, restriction, spotracUrl },
        })
      ).id
    : (
        await prisma.contract.create({
          data: { playerId, teamId, contractType, restriction, spotracUrl, isActive: true },
        })
      ).id;

  // Replace the year breakdown wholesale rather than trying to diff it —
  // a handful of rows per contract, so simplest to just clear and
  // recreate instead of matching up which specific years changed.
  await prisma.$transaction([
    prisma.contractYear.deleteMany({ where: { contractId } }),
    prisma.contractYear.createMany({
      data: years.map((y) => ({ contractId, season: y.season, salary: y.salary })),
    }),
  ]);

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
