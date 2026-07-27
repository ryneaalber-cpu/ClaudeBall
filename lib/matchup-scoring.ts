/**
 * Turns a roster + a fantasy "game number" into a matchup score.
 *
 * sports.ws describes a fantasy matchup as bundling together each NBA
 * team's Nth game of the season — which can fall on different calendar
 * days for different teams, since teams don't all play on the same
 * schedule. A fantasy roster usually spans several real NBA teams, so
 * "your score for game 12" is really the sum of several independent
 * real games, one per NBA team your roster touches, each landing
 * whenever that team's 12th game actually happens.
 *
 * Best-effort interpretation, flagged honestly: the position-pool fill
 * (see scoring-engine.ts) is run FRESH for each of those underlying real
 * games, not shared across them — a 48/96/96 minute pool only makes
 * sense as one game's worth of clock time, and there's no real-world
 * "shared pool" spanning multiple days. The primer describes the
 * per-game mechanic and the matchup-bundling separately but doesn't
 * spell out how they combine, so this is inferred, not confirmed
 * against the real platform.
 *
 * Split into a pure aggregation function (this file — zero dependencies,
 * safe to import and test anywhere) and a database-fetching wrapper
 * around it (lib/matchup-scoring-db.ts). They were briefly in one file;
 * that broke the point of the split, since importing the file at all
 * pulled in @prisma/client even to use just the pure part. Same
 * reasoning as keeping scoring-engine.ts pure: the logic worth trusting
 * shouldn't depend on a live database connection to even load, let
 * alone verify.
 */

import {
  calculateTeamGameScore,
  type RosterEntry,
  type PlayerGameStats,
  type PositionPoolConfig,
  type ScoringWeights,
  type TeamGameResult,
} from "./scoring-engine";

export interface PerGameInput {
  nbaTeam: string;
  gameId: string;
  /** Just the roster subset whose players are on nbaTeam for this game. */
  roster: RosterEntry[];
  gameStats: Map<string, PlayerGameStats>;
}

export interface MatchupResult {
  totalScore: number;
  perGame: { nbaTeam: string; gameId: string; result: TeamGameResult }[];
}

/** Pure aggregation — given already-fetched per-game data, no database access. */
export function aggregateMatchupScore(
  perGameInputs: PerGameInput[],
  positionPools: PositionPoolConfig[],
  weights: ScoringWeights
): MatchupResult {
  let totalScore = 0;
  const perGame = perGameInputs.map((input) => {
    const result = calculateTeamGameScore(
      input.roster,
      input.gameStats,
      positionPools,
      weights
    );
    totalScore += result.totalScore;
    return { nbaTeam: input.nbaTeam, gameId: input.gameId, result };
  });

  return { totalScore, perGame };
}
