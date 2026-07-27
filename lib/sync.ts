/**
 * Pulls games + box scores from balldontlie for a given date and upserts
 * them into the database, in the shape lib/scoring-engine.ts expects.
 *
 * Not run against a live database from this sandbox (no DB connection
 * here) — reviewed carefully, but treat it as an untested first pass, the
 * same as the rest of this scaffold.
 *
 * Usage once the DB is connected:
 *   import { syncGamesForDate } from "@/lib/sync";
 *   await syncGamesForDate("2026-11-04");
 */

import { prisma } from "./prisma";
import {
  fetchGamesByDate,
  fetchStatsForGames,
  parseMinutes,
  type ProviderGame,
  type ProviderStatLine,
} from "./stats-provider";

async function upsertGame(game: ProviderGame) {
  return prisma.game.upsert({
    where: { externalId: String(game.id) },
    create: {
      externalId: String(game.id),
      date: new Date(game.date),
      homeTeam: game.home_team.abbreviation,
      awayTeam: game.visitor_team.abbreviation,
    },
    update: {
      date: new Date(game.date),
    },
  });
}

async function upsertPlayerFromStatLine(stat: ProviderStatLine) {
  return prisma.player.upsert({
    where: { externalId: String(stat.player.id) },
    create: {
      externalId: String(stat.player.id),
      firstName: stat.player.first_name,
      lastName: stat.player.last_name,
      nbaTeam: stat.team.abbreviation,
      // The provider gives one position string; map to our C/F/G enum as a
      // starting point. Multi-position strings (e.g. "F-C") take the first
      // letter — a commissioner can correct primary/secondary by hand
      // afterward, same as any dual-eligibility call.
      primaryPosition: mapPosition(stat.player.position),
    },
    update: {
      nbaTeam: stat.team.abbreviation,
    },
  });
}

function mapPosition(raw: string): "C" | "F" | "G" {
  const first = raw.trim().charAt(0).toUpperCase();
  if (first === "C") return "C";
  if (first === "G") return "G";
  return "F"; // covers "F", "F-C", "F-G", and anything unrecognized
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Syncs every game on a given date, plus the box score for each. Which
 * fantasy "game number" window a given real game belongs to isn't
 * decided here — see lib/matchup-scoring.ts, which computes each NBA
 * team's Nth game by date order at query time instead of relying on a
 * number assigned during sync.
 *
 * Stats for every game on the date are fetched together in as few
 * requests as possible (balldontlie's game_ids filter accepts an
 * array) rather than one request per game — a busy NBA night can have
 * 10+ games, and firing that many requests back to back risks the
 * rate limit regardless of tier.
 */
export async function syncGamesForDate(date: string) {
  const { data: games } = await fetchGamesByDate(date);

  for (const game of games) {
    await upsertGame(game);
  }

  if (games.length === 0) {
    return { gamesProcessed: 0 };
  }

  const gameIds = games.map((g) => g.id);
  let cursor: number | undefined;

  do {
    const { data: stats, meta } = await fetchStatsForGames(gameIds, cursor);

    for (const stat of stats) {
      const player = await upsertPlayerFromStatLine(stat);
      const dbGame = await prisma.game.findUniqueOrThrow({
        where: { externalId: String(stat.game.id) },
      });

      await prisma.playerGameLog.upsert({
        where: { playerId_gameId: { playerId: player.id, gameId: dbGame.id } },
        create: {
          playerId: player.id,
          gameId: dbGame.id,
          minutesPlayed: parseMinutes(stat.min),
          stats: {
            PTS: stat.pts,
            REB: stat.reb,
            AST: stat.ast,
            STL: stat.stl,
            BLK: stat.blk,
            TOV: stat.turnover,
            FGM: stat.fgm,
            FGA: stat.fga,
            FG3M: stat.fg3m,
            FG3A: stat.fg3a,
            FTM: stat.ftm,
            FTA: stat.fta,
            OREB: stat.oreb,
            DREB: stat.dreb,
            PF: stat.pf,
          },
        },
        update: {
          minutesPlayed: parseMinutes(stat.min),
        },
      });
    }

    cursor = meta?.next_cursor;
    // Only matters on an unusually busy date that needs a second page —
    // a small pause here costs almost nothing but adds real safety margin.
    if (cursor !== undefined) await sleep(1100);
  } while (cursor !== undefined);

  return { gamesProcessed: games.length };
}
