"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Same shape as everywhere else: the team's own owner, or the commissioner, can act for a team. */
async function assertCanActFor(
  leagueId: string,
  userId: string,
  team: { ownerId: string }
) {
  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId, leagueId } },
  });
  const isCommissioner = membership?.role === "COMMISSIONER";
  if (!isCommissioner && team.ownerId !== userId) {
    throw new Error("Not authorized for this team");
  }
}

/** Moves one player's roster spot and active contract (if any) from one team to the other. */
async function moveRosterAndContract(
  tx: Prisma.TransactionClient,
  playerId: string,
  fromTeamId: string,
  toTeamId: string
) {
  const rosterEntry = await tx.rosterEntry.findUnique({
    where: { teamId_playerId: { teamId: fromTeamId, playerId } },
  });
  if (rosterEntry) {
    const highest = await tx.rosterEntry.aggregate({
      where: { teamId: toTeamId },
      _max: { priorityOrder: true },
    });
    await tx.rosterEntry.update({
      where: { id: rosterEntry.id },
      data: {
        teamId: toTeamId,
        priorityOrder: (highest._max.priorityOrder ?? 0) + 1,
      },
    });
  }

  const contract = await tx.contract.findFirst({
    where: { playerId, teamId: fromTeamId, isActive: true },
  });
  if (contract) {
    await tx.contract.update({
      where: { id: contract.id },
      data: { teamId: toTeamId },
    });
  }
}

/**
 * Creates a trade across any number of teams (2 or more). Called
 * directly from the client TradeBuilder component — not a plain form
 * action — since the builder needs live cap math before submitting, not
 * just a one-shot form post. Because of that, this returns instead of
 * redirecting: a redirect() thrown here would land inside the client's
 * own try/catch and get treated as an error instead of a navigation.
 * The component navigates itself once this resolves successfully.
 *
 * @param teamIds every team involved, proposer included
 * @param destinations playerId -> destination teamId. A player missing
 *   from this map, or mapped to their own current team, isn't part of
 *   the trade.
 * @returns the new trade's id
 */
export async function proposeTrade(
  leagueId: string,
  teamIds: string[],
  destinations: Record<string, string>
): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");
  if (teamIds.length < 2) throw new Error("A trade needs at least two teams");

  const teams = await prisma.team.findMany({
    where: { id: { in: teamIds }, leagueId },
  });
  if (teams.length !== teamIds.length) throw new Error("Invalid teams for this league");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  const isCommissioner = membership?.role === "COMMISSIONER";
  const myTeam = teams.find((t) => t.ownerId === session.user.id);
  if (!isCommissioner && !myTeam) {
    throw new Error("You need to own one of the teams in this trade");
  }
  // A commissioner proposing without a team of their own has no natural
  // "proposer" — falls back to the first selected team. Doesn't affect
  // who has to accept what; every non-proposer still responds normally.
  const proposerTeamId = myTeam?.id ?? teams[0].id;

  const moves = Object.entries(destinations).filter(
    ([, toTeamId]) => toTeamId && toTeamId !== ""
  );
  if (moves.length === 0) throw new Error("Select at least one player to move");

  const rosterEntries = await prisma.rosterEntry.findMany({
    where: { playerId: { in: moves.map(([playerId]) => playerId) }, teamId: { in: teamIds } },
  });
  const currentTeamOf = new Map(rosterEntries.map((r) => [r.playerId, r.teamId]));

  const items = moves
    .filter(([playerId, toTeamId]) => currentTeamOf.get(playerId) && currentTeamOf.get(playerId) !== toTeamId)
    .map(([playerId, toTeamId]) => ({
      playerId,
      fromTeamId: currentTeamOf.get(playerId)!,
      toTeamId,
    }));

  if (items.length === 0) throw new Error("Selected players aren't on any involved team's roster");

  const trade = await prisma.trade.create({
    data: {
      leagueId,
      status: "PENDING",
      participants: {
        create: teamIds.map((teamId) => ({
          teamId,
          isProposer: teamId === proposerTeamId,
          response: teamId === proposerTeamId ? "ACCEPTED" : "PENDING",
        })),
      },
      items: { create: items },
    },
  });

  revalidatePath(`/league/${leagueId}/trades`);
  return trade.id;
}

/**
 * A single team's response to a pending trade. Accepting checks whether
 * EVERY participant has now accepted — if so, the trade executes right
 * here, atomically. Declining rejects the whole trade immediately;
 * there's no reason to wait on the other participants once one team
 * says no.
 */
export async function respondToTrade(
  leagueId: string,
  tradeId: string,
  teamId: string,
  response: "ACCEPTED" | "DECLINED",
  _formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team || team.leagueId !== leagueId) throw new Error("Team not found");
  await assertCanActFor(leagueId, session.user.id, team);

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { participants: true, items: true },
  });
  if (!trade || trade.leagueId !== leagueId) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade has already been resolved");

  const participant = trade.participants.find((p) => p.teamId === teamId);
  if (!participant) throw new Error("This team isn't part of this trade");
  if (participant.response !== "PENDING") throw new Error("This team has already responded");

  if (response === "DECLINED") {
    await prisma.$transaction([
      prisma.tradeParticipant.update({
        where: { id: participant.id },
        data: { response: "DECLINED" },
      }),
      prisma.trade.update({
        where: { id: tradeId },
        data: { status: "REJECTED", resolvedAt: new Date() },
      }),
    ]);
    revalidatePath(`/league/${leagueId}/trades`);
    return;
  }

  await prisma.tradeParticipant.update({
    where: { id: participant.id },
    data: { response: "ACCEPTED" },
  });

  const remaining = await prisma.tradeParticipant.findMany({ where: { tradeId } });
  const allAccepted = remaining.every((p) => p.response === "ACCEPTED");

  if (allAccepted) {
    await prisma.$transaction(async (tx) => {
      for (const item of trade.items) {
        await moveRosterAndContract(tx, item.playerId, item.fromTeamId, item.toTeamId);
      }
      await tx.trade.update({
        where: { id: tradeId },
        data: { status: "ACCEPTED", resolvedAt: new Date() },
      });
    });
  }

  revalidatePath(`/league/${leagueId}/trades`);
}

/** The proposer withdrawing their own offer before everyone has responded. */
export async function cancelTrade(
  leagueId: string,
  tradeId: string,
  _formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const trade = await prisma.trade.findUnique({
    where: { id: tradeId },
    include: { participants: { include: { team: true } } },
  });
  if (!trade || trade.leagueId !== leagueId) throw new Error("Trade not found");
  if (trade.status !== "PENDING") throw new Error("This trade has already been resolved");

  const proposer = trade.participants.find((p) => p.isProposer);
  if (!proposer) throw new Error("Malformed trade: no proposer on record");
  await assertCanActFor(leagueId, session.user.id, proposer.team);

  await prisma.trade.update({
    where: { id: tradeId },
    data: { status: "CANCELLED", resolvedAt: new Date() },
  });
  revalidatePath(`/league/${leagueId}/trades`);
}

/**
 * Declines on behalf of teamId, then sends the user straight into a new
 * trade proposal pre-filled from this one — same teams, same players in
 * the same directions — so countering is "adjust and resend," not
 * "start from a blank roster list."
 */
export async function declineAndCounter(
  leagueId: string,
  tradeId: string,
  teamId: string,
  _formData: FormData
) {
  await respondToTrade(leagueId, tradeId, teamId, "DECLINED", new FormData());
  redirect(`/league/${leagueId}/trades/new?fromTrade=${tradeId}`);
}
