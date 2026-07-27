/**
 * Scoring engine for the sports.ws-style minutes-pool format.
 *
 * The mechanic, in short: instead of a fixed starting five, each team fills
 * a pool of playing-time minutes per position (a default split is 48 for
 * center, 96 each for forward and guard — one full game's worth of minutes
 * at each spot, since two forward and two guard slots are in play). Players
 * on the roster are processed in priority order (the order the owner sets);
 * each one's real minutes played get "consumed" from their eligible
 * position pool(s) until either the player runs out of minutes or the pool
 * runs out of room. A player only scores for the fraction of their minutes
 * that get consumed — if the pools fill up before reaching a player on the
 * roster, they score zero for that game, no matter how well they played.
 *
 * Dual-eligible players (e.g. a forward/guard) fill their first-listed
 * position pool, and if it fills up before their minutes run out, the
 * leftover minutes spill into their second position's pool.
 *
 * This file is a from-scratch, best-effort reconstruction based on
 * sports.ws's own public explainer and its worked example (Drummond/Noah
 * filling center minutes, Bazemore spilling from forward into guard).
 * scoring-engine.validate.ts checks this implementation against that exact
 * example. It has NOT been validated against your league's actual settings
 * or edge cases (what happens on overtime, players who exit a game
 * injured, etc.) — treat this as a strong first draft to test against the
 * real thing together, not a guaranteed-exact clone.
 */

export type Position = "C" | "F" | "G";

export interface PositionPoolConfig {
  position: Position;
  minutePool: number;
}

export interface PlayerGameStats {
  playerId: string;
  minutesPlayed: number;
  /** Raw box score stats, keyed however your scoring weights are keyed (PTS, REB, AST, ...). */
  stats: Record<string, number>;
}

export interface RosterEntry {
  playerId: string;
  /** Eligible positions in priority order — the first is tried before any spillover to the second. */
  eligiblePositions: Position[];
  /** Lower = processed (and thus filled) first. This is the lineup order the team owner sets. */
  priorityOrder: number;
}

export type ScoringWeights = Record<string, number>;

export interface PlayerContribution {
  playerId: string;
  minutesPlayed: number;
  minutesConsumed: number;
  /** Fraction of the player's minutes that actually counted, 0–1. */
  fraction: number;
  rawFantasyPoints: number;
  proratedFantasyPoints: number;
  positionsFilled: Partial<Record<Position, number>>;
}

export interface TeamGameResult {
  totalScore: number;
  contributions: PlayerContribution[];
}

/**
 * Computes one team's fantasy score for a single real NBA game, given their
 * lineup priority order and the box scores for that game.
 *
 * Players missing a game log (didn't play, inactive, etc.) are included in
 * the result with zero contribution rather than skipped, so you can see the
 * full roster's outcome in the UI.
 */
export function calculateTeamGameScore(
  roster: RosterEntry[],
  gameStats: Map<string, PlayerGameStats>,
  positionPools: PositionPoolConfig[],
  weights: ScoringWeights
): TeamGameResult {
  const remaining = new Map<Position, number>(
    positionPools.map((p) => [p.position, p.minutePool])
  );

  const orderedRoster = [...roster].sort(
    (a, b) => a.priorityOrder - b.priorityOrder
  );

  const contributions: PlayerContribution[] = [];
  let totalScore = 0;

  for (const entry of orderedRoster) {
    const gameLine = gameStats.get(entry.playerId);

    if (!gameLine || gameLine.minutesPlayed <= 0) {
      contributions.push({
        playerId: entry.playerId,
        minutesPlayed: gameLine?.minutesPlayed ?? 0,
        minutesConsumed: 0,
        fraction: 0,
        rawFantasyPoints: 0,
        proratedFantasyPoints: 0,
        positionsFilled: {},
      });
      continue;
    }

    let minutesLeftToPlace = gameLine.minutesPlayed;
    const positionsFilled: Partial<Record<Position, number>> = {};

    for (const pos of entry.eligiblePositions) {
      if (minutesLeftToPlace <= 0) break;
      const availableInPool = remaining.get(pos) ?? 0;
      if (availableInPool <= 0) continue;

      const used = Math.min(availableInPool, minutesLeftToPlace);
      remaining.set(pos, availableInPool - used);
      positionsFilled[pos] = (positionsFilled[pos] ?? 0) + used;
      minutesLeftToPlace -= used;
    }

    const minutesConsumed = gameLine.minutesPlayed - minutesLeftToPlace;
    const fraction = minutesConsumed / gameLine.minutesPlayed;

    const rawFantasyPoints = Object.entries(weights).reduce(
      (sum, [statKey, weight]) => sum + (gameLine.stats[statKey] ?? 0) * weight,
      0
    );
    const proratedFantasyPoints = rawFantasyPoints * fraction;

    contributions.push({
      playerId: entry.playerId,
      minutesPlayed: gameLine.minutesPlayed,
      minutesConsumed,
      fraction,
      rawFantasyPoints,
      proratedFantasyPoints,
      positionsFilled,
    });

    totalScore += proratedFantasyPoints;
  }

  return { totalScore, contributions };
}

export const DEFAULT_POSITION_POOLS: PositionPoolConfig[] = [
  { position: "C", minutePool: 48 },
  { position: "F", minutePool: 96 },
  { position: "G", minutePool: 96 },
];

// A reasonable starting scoring format — editable per-league once a
// settings page exists (see ScoringCategory in schema.prisma). Weighting
// steals/blocks highest and turnovers negative is a common efficiency-style
// baseline, not a sports.ws-specific number; there's no single "default"
// published since sports.ws leaves this fully commissioner-defined too.
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  PTS: 1,
  REB: 1.2,
  AST: 1.5,
  STL: 3,
  BLK: 3,
  TOV: -1,
};
