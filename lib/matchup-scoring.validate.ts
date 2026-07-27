/**
 * Sanity-checks aggregateMatchupScore — the pure half of
 * matchup-scoring.ts — with a synthetic two-day matchup. There's no
 * published sports.ws example for this part (unlike the single-game
 * pool-fill mechanic, which scoring-engine.validate.ts checks against
 * their real worked example), so this only confirms the arithmetic and
 * attribution are correct, not that it matches the live platform.
 *
 * Run with: npx tsx lib/matchup-scoring.validate.ts
 */

import assert from "node:assert";
import { aggregateMatchupScore } from "./matchup-scoring";
import type { RosterEntry, PlayerGameStats } from "./scoring-engine";

// Scenario: a fantasy roster with one center on the Hawks and one guard
// on the Celtics. For fantasy "game 12," the Hawks' 12th game happens to
// fall on a Monday and the Celtics' 12th game falls on a Wednesday —
// two independent real games, each scored on its own, then summed.

const mondayRoster: RosterEntry[] = [
  { playerId: "p1", eligiblePositions: ["C"], priorityOrder: 1 },
];
const mondayStats = new Map<string, PlayerGameStats>([
  ["p1", { playerId: "p1", minutesPlayed: 30, stats: { PTS: 20 } }],
]);

const wednesdayRoster: RosterEntry[] = [
  { playerId: "p2", eligiblePositions: ["G"], priorityOrder: 1 },
];
const wednesdayStats = new Map<string, PlayerGameStats>([
  ["p2", { playerId: "p2", minutesPlayed: 20, stats: { PTS: 10 } }],
]);

const result = aggregateMatchupScore(
  [
    { nbaTeam: "ATL", gameId: "monday-game", roster: mondayRoster, gameStats: mondayStats },
    { nbaTeam: "BOS", gameId: "wednesday-game", roster: wednesdayRoster, gameStats: wednesdayStats },
  ],
  [
    { position: "C", minutePool: 48 },
    { position: "G", minutePool: 96 },
  ],
  { PTS: 1 }
);

assert.strictEqual(result.perGame.length, 2, "one entry per underlying real game");
assert.strictEqual(
  result.perGame.find((g) => g.gameId === "monday-game")?.result.totalScore,
  20,
  "Monday's game: p1 used all 30 of his minutes (well under the 48 pool), so all 20 pts count"
);
assert.strictEqual(
  result.perGame.find((g) => g.gameId === "wednesday-game")?.result.totalScore,
  10,
  "Wednesday's game: same logic, p2's 10 pts count in full"
);
assert.strictEqual(result.totalScore, 30, "matchup total is the sum across both real games, not an average or a single pool");

console.log("✓ Matchup aggregation test passed: two real games on different days summed into one matchup score (20 + 10 = 30)");
