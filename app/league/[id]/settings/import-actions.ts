"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { matchPlayers, type ImportPlayer } from "@/lib/nfba-import";
import { nextSeason } from "@/lib/season";
import importData from "@/lib/nfba-import-data.json";

export interface ImportTeamResult {
  team: string;
  ok: boolean;
  message: string;
  matched: number;
  unmatched: string[];
}

/**
 * Imports one team from the baked-in spreadsheet data: links it to an
 * existing user by username, then creates a roster entry + contract for
 * every player that matches an already-synced real Player record.
 * Deliberately one team per call rather than all 30 in one request —
 * the season sync feature hit Vercel's per-request time limit doing
 * everything in a single call; this avoids that by construction, with
 * the client (see import-form.tsx) calling this once per team in
 * sequence instead.
 *
 * Draft picks from the spreadsheet aren't imported — this app doesn't
 * have a tradeable-future-pick model yet (see the roadmap), so there's
 * nowhere for that data to go yet.
 */
export async function importTeam(
  leagueId: string,
  teamKey: string,
  username: string
): Promise<ImportTeamResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return { team: teamKey, ok: false, message: "Not signed in.", matched: 0, unmatched: [] };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    return { team: teamKey, ok: false, message: "Only the commissioner can import teams.", matched: 0, unmatched: [] };
  }

  const teamData = (importData as Record<string, { players: ImportPlayer[] }>)[teamKey];
  if (!teamData) {
    return { team: teamKey, ok: false, message: "Unknown team key.", matched: 0, unmatched: [] };
  }

  const owner = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (!owner) {
    return {
      team: teamKey,
      ok: false,
      message: `No account found for username "${username}".`,
      matched: 0,
      unmatched: [],
    };
  }

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });

  const existingTeam = await prisma.team.findFirst({ where: { leagueId, name: teamKey } });
  if (existingTeam) {
    return {
      team: teamKey,
      ok: false,
      message: `${teamKey} was already imported into this league — skipped to avoid creating a duplicate.`,
      matched: 0,
      unmatched: [],
    };
  }

  const syncedPlayers = await prisma.player.findMany({
    select: { id: true, firstName: true, lastName: true },
  });
  const matches = matchPlayers(teamData.players, syncedPlayers);

  await prisma.leagueMembership.upsert({
    where: { userId_leagueId: { userId: owner.id, leagueId } },
    create: { userId: owner.id, leagueId, role: "OWNER" },
    update: {},
  });

  const team = await prisma.team.create({
    data: { name: teamKey, leagueId, ownerId: owner.id },
  });

  let matched = 0;
  const unmatched: string[] = [];

  for (const [i, result] of matches.entries()) {
    if (!result.matchedPlayerId) {
      unmatched.push(result.importPlayer.name);
      continue;
    }

    await prisma.rosterEntry.create({
      data: { teamId: team.id, playerId: result.matchedPlayerId, priorityOrder: i },
    });

    if (result.importPlayer.contractType) {
      const contract = await prisma.contract.create({
        data: {
          playerId: result.matchedPlayerId,
          teamId: team.id,
          contractType: result.importPlayer.contractType,
          restriction: result.importPlayer.restriction,
          spotracUrl: result.importPlayer.spotracUrl,
          isActive: true,
        },
      });

      if (result.importPlayer.salaryYears.length > 0) {
        const seasons = [league.currentSeason];
        for (let y = 1; y < result.importPlayer.salaryYears.length; y++) {
          seasons.push(nextSeason(seasons[y - 1]));
        }
        await prisma.contractYear.createMany({
          data: result.importPlayer.salaryYears.map((salary, y) => ({
            contractId: contract.id,
            season: seasons[y],
            salary: Math.round(salary),
          })),
        });
      }
    }

    matched++;
  }

  return {
    team: teamKey,
    ok: true,
    message: `${teamKey}: ${matched} matched, ${unmatched.length} not found.`,
    matched,
    unmatched,
  };
}
