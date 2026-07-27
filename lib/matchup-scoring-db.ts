/**
 * The database-fetching half of matchup scoring. See matchup-scoring.ts
 * for the actual logic and the reasoning for keeping this split — this
 * file exists purely to assemble real data and hand it to the pure
 * function; it makes no scoring decisions itself.
 */

import { prisma } from "./prisma";
import {
  aggregateMatchupScore,
  type PerGameInput,
  type MatchupResult,
} from "./matchup-scoring";
import type {
  RosterEntry,
  PlayerGameStats,
  PositionPoolConfig,
  ScoringWeights,
} from "./scoring-engine";

/**
 * Fetches what aggregateMatchupScore needs and runs it. This is the
 * function a page/route actually calls.
 */
export async function calculateTeamMatchupScore(
  roster: RosterEntry[],
  gameNumber: number,
  positionPools: PositionPoolConfig[],
  weights: ScoringWeights
): Promise<MatchupResult> {
  const players = await prisma.player.findMany({
    where: { id: { in: roster.map((r) => r.playerId) } },
  });
  const playerTeam = new Map(players.map((p) => [p.id, p.nbaTeam]));
  const nbaTeams = [...new Set(players.map((p) => p.nbaTeam))];

  const perGameInputs: PerGameInput[] = [];

  for (const nbaTeam of nbaTeams) {
    // This team's games in chronological order — index gameNumber - 1 is
    // their Nth game. See schema.prisma's note on why this is computed
    // here instead of read from a stored column.
    const games = await prisma.game.findMany({
      where: { OR: [{ homeTeam: nbaTeam }, { awayTeam: nbaTeam }] },
      orderBy: { date: "asc" },
    });

    const game = games[gameNumber - 1];
    if (!game) continue; // this team hasn't played that many games yet

    const rosterForThisTeam = roster.filter(
      (r) => playerTeam.get(r.playerId) === nbaTeam
    );

    const logs = await prisma.playerGameLog.findMany({
      where: {
        gameId: game.id,
        playerId: { in: rosterForThisTeam.map((r) => r.playerId) },
      },
    });

    const gameStats = new Map<string, PlayerGameStats>(
      logs.map((log) => [
        log.playerId,
        {
          playerId: log.playerId,
          minutesPlayed: log.minutesPlayed,
          stats: log.stats as Record<string, number>,
        },
      ])
    );

    perGameInputs.push({
      nbaTeam,
      gameId: game.id,
      roster: rosterForThisTeam,
      gameStats,
    });
  }

  return aggregateMatchupScore(perGameInputs, positionPools, weights);
}
