"use server";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { matchPlayers, parsePosition, guessSearchTerm, normalizeName, type ImportPlayer } from "@/lib/nfba-import";
import { nextSeason } from "@/lib/season";
import { fetchPlayersBySearch } from "@/lib/stats-provider";
import importData from "@/lib/nfba-import-data.json";

export interface ImportTeamResult {
  team: string;
  ok: boolean;
  message: string;
  matched: number;
  created: number;
  unmatched: string[];
}

/**
 * Looks up a player directly by name for anyone the regular-season sync
 * never covered — a 2026 rookie who hadn't played an NBA game yet when
 * the synced season happened is the main case, but this covers any
 * player who's on a real roster right now without being in the box
 * score data. Returns null on no match OR on any API error (e.g. a
 * rate limit) — either way, the caller falls back to leaving that
 * player unmatched rather than failing the whole team's import over
 * one lookup.
 */
async function findPlayerLive(name: string) {
  try {
    const { data: candidates } = await fetchPlayersBySearch(guessSearchTerm(name));
    const target = normalizeName(name);
    return candidates.find((c) => normalizeName(`${c.first_name} ${c.last_name}`) === target) ?? null;
  } catch {
    return null;
  }
}

/**
 * Imports one team from the baked-in spreadsheet data: links it to an
 * existing user by username, then creates a roster entry + contract for
 * every player — matched against an already-synced real Player record
 * where possible, or looked up live and created on the spot for anyone
 * who isn't (rookies, mainly). Deliberately one team per call rather
 * than all 30 in one request — the season sync feature hit Vercel's
 * per-request time limit doing everything in a single call; this
 * avoids that by construction, with the client (see import-form.tsx)
 * calling this once per team in sequence instead.
 *
 * Every matched or newly-created player's position gets set from the
 * spreadsheet's own tag ("GF", "FC", ...) rather than left as whatever
 * a stats provider's single-position label says — the spreadsheet's
 * position column is real, commissioner-curated dual-eligibility data,
 * and should win.
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
    return { team: teamKey, ok: false, message: "Not signed in.", matched: 0, created: 0, unmatched: [] };
  }

  const membership = await prisma.leagueMembership.findUnique({
    where: { userId_leagueId: { userId: session.user.id, leagueId } },
  });
  if (membership?.role !== "COMMISSIONER") {
    return {
      team: teamKey,
      ok: false,
      message: "Only the commissioner can import teams.",
      matched: 0,
      created: 0,
      unmatched: [],
    };
  }

  const teamData = (importData as Record<string, { players: ImportPlayer[] }>)[teamKey];
  if (!teamData) {
    return { team: teamKey, ok: false, message: "Unknown team key.", matched: 0, created: 0, unmatched: [] };
  }

  const trimmedUsername = username.trim();
  const owner = trimmedUsername
    ? await prisma.user.findUnique({ where: { username: trimmedUsername } })
    : null;

  const league = await prisma.league.findUniqueOrThrow({ where: { id: leagueId } });

  const existingTeam = await prisma.team.findFirst({ where: { leagueId, name: teamKey } });
  if (existingTeam) {
    return {
      team: teamKey,
      ok: false,
      message: `${teamKey} was already imported into this league — skipped to avoid creating a duplicate.`,
      matched: 0,
      created: 0,
      unmatched: [],
    };
  }

  const syncedPlayers = await prisma.player.findMany({
    select: { id: true, firstName: true, lastName: true },
  });
  const matches = matchPlayers(teamData.players, syncedPlayers);

  if (owner) {
    await prisma.leagueMembership.upsert({
      where: { userId_leagueId: { userId: owner.id, leagueId } },
      create: { userId: owner.id, leagueId, role: "OWNER" },
      update: {},
    });
  }

  const team = await prisma.team.create({
    data: { name: teamKey, leagueId, ownerId: owner?.id ?? null },
  });

  let matched = 0;
  let created = 0;
  const unmatched: string[] = [];

  for (const [i, result] of matches.entries()) {
    const { primary, secondary } = parsePosition(result.importPlayer.position);
    let playerId = result.matchedPlayerId;

    if (playerId) {
      await prisma.player.update({
        where: { id: playerId },
        data: { primaryPosition: primary, secondaryPosition: secondary },
      });
    } else {
      const found = await findPlayerLive(result.importPlayer.name);
      if (found) {
        const newPlayer = await prisma.player.upsert({
          where: { externalId: String(found.id) },
          create: {
            externalId: String(found.id),
            firstName: found.first_name,
            lastName: found.last_name,
            nbaTeam: found.team.abbreviation,
            primaryPosition: primary,
            secondaryPosition: secondary,
          },
          update: { primaryPosition: primary, secondaryPosition: secondary },
        });
        playerId = newPlayer.id;
        created++;
      }
    }

    if (!playerId) {
      unmatched.push(result.importPlayer.name);
      continue;
    }

    await prisma.rosterEntry.create({
      data: { teamId: team.id, playerId, priorityOrder: i },
    });

    if (result.importPlayer.contractType) {
      const contract = await prisma.contract.create({
        data: {
          playerId,
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

  const ownerNote = owner ? `Owner: ${owner.username}.` : "Unclaimed — no matching username yet.";
  return {
    team: teamKey,
    ok: true,
    message: `${teamKey}: ${matched} on roster (${created} newly added as rookies), ${unmatched.length} not found. ${ownerNote}`,
    matched,
    created,
    unmatched,
  };
}
