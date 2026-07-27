"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateRoundRobinSchedule } from "@/lib/schedule";
import { calculateTeamMatchupScore } from "@/lib/matchup-scoring-db";
import {
  DEFAULT_POSITION_POOLS,
  DEFAULT_SCORING_WEIGHTS,
  type RosterEntry,
  type Position,
} from "@/lib/scoring-engine";

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

/**
 * Wipes and regenerates the whole season's matchups. Deliberately
 * destructive on re-run (clears existing Matchup rows for this league
 * first) rather than trying to merge — regenerating a schedule mid-way
 * through a season is a real "start over" decision a commissioner would
 * make on purpose, not something to paper over with partial updates.
 */
export async function generateSchedule(leagueId: string, formData: FormData) {
  await requireCommissioner(leagueId);

  const gameNumbers = Math.max(1, Math.min(82, Number(formData.get("gameNumbers")) || 82));

  const teams = await prisma.team.findMany({ where: { leagueId } });
  if (teams.length < 2) {
    throw new Error("Need at least two teams to generate a schedule");
  }

  const scheduled = generateRoundRobinSchedule(
    teams.map((t) => t.id),
    gameNumbers
  );

  await prisma.$transaction([
    prisma.matchup.deleteMany({ where: { leagueId } }),
    prisma.matchup.createMany({
      data: scheduled.map((m) => ({
        leagueId,
        gameNumber: m.gameNumber,
        teamAId: m.teamAId,
        teamBId: m.teamBId,
      })),
    }),
  ]);

  revalidatePath(`/league/${leagueId}/schedule`);
  revalidatePath(`/league/${leagueId}/standings`);
}

/**
 * Computes and saves both teams' scores for one stored matchup, reusing
 * the same calculateTeamMatchupScore used on the per-team matchup page
 * — this is that same engine, just run for both sides and persisted
 * instead of shown ad hoc. Any signed-in league member can trigger this
 * (it's a read-and-compute operation on real game data, not a decision
 * that needs commissioner authority the way roster/contract/trade
 * changes do).
 */
export async function scoreMatchup(
  leagueId: string,
  matchupId: string,
  _formData: FormData
) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in");

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (!membership) throw new Error("Not a member of this league");

  const matchup = await prisma.matchup.findUnique({ where: { id: matchupId } });
  if (!matchup || matchup.leagueId !== leagueId) throw new Error("Matchup not found");

  const league = await prisma.league.findUniqueOrThrow({
    where: { id: leagueId },
    include: { positionPools: true, scoringCategories: true },
  });

  const positionPools =
    league.positionPools.length > 0
      ? league.positionPools.map((p) => ({
          position: p.position as Position,
          minutePool: p.minutesTotal,
        }))
      : DEFAULT_POSITION_POOLS;

  const weights =
    league.scoringCategories.length > 0
      ? Object.fromEntries(league.scoringCategories.map((c) => [c.statKey, c.weight]))
      : DEFAULT_SCORING_WEIGHTS;

  async function rosterFor(teamId: string): Promise<RosterEntry[]> {
    const entries = await prisma.rosterEntry.findMany({
      where: { teamId },
      include: { player: true },
    });
    return entries.map((entry) => ({
      playerId: entry.playerId,
      eligiblePositions: (entry.player.secondaryPosition
        ? [entry.player.primaryPosition, entry.player.secondaryPosition]
        : [entry.player.primaryPosition]) as Position[],
      priorityOrder: entry.priorityOrder,
    }));
  }

  const [rosterA, rosterB] = await Promise.all([
    rosterFor(matchup.teamAId),
    rosterFor(matchup.teamBId),
  ]);

  const [resultA, resultB] = await Promise.all([
    calculateTeamMatchupScore(rosterA, matchup.gameNumber, positionPools, weights),
    calculateTeamMatchupScore(rosterB, matchup.gameNumber, positionPools, weights),
  ]);

  await prisma.matchup.update({
    where: { id: matchupId },
    data: { teamAScore: resultA.totalScore, teamBScore: resultB.totalScore },
  });

  revalidatePath(`/league/${leagueId}/schedule`);
  revalidatePath(`/league/${leagueId}/standings`);
}
