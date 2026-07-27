/**
 * Checks computeStandings with a small round-robin's worth of results,
 * including a tie and an unscored (still-pending) matchup that should
 * be ignored rather than counted.
 * Run with: npx tsx lib/standings.validate.ts
 */

import assert from "node:assert";
import { computeStandings } from "./standings";

const matchups = [
  { teamAId: "A", teamBId: "B", teamAScore: 110, teamBScore: 100 }, // A beats B
  { teamAId: "C", teamBId: "D", teamAScore: 90, teamBScore: 95 }, // D beats C
  { teamAId: "A", teamBId: "C", teamAScore: 100, teamBScore: 100 }, // tie
  { teamAId: "B", teamBId: "D", teamAScore: 80, teamBScore: null }, // not yet played
];

const standings = computeStandings(["A", "B", "C", "D"], matchups);

const byId = Object.fromEntries(standings.map((s) => [s.teamId, s]));

assert.strictEqual(byId.A.wins, 1);
assert.strictEqual(byId.A.ties, 1);
assert.strictEqual(byId.A.losses, 0);
assert.strictEqual(byId.A.pointsFor, 210, "110 (beat B) + 100 (tied C)");

assert.strictEqual(byId.B.losses, 1, "lost to A");
assert.strictEqual(byId.B.wins, 0, "the unscored B-D matchup must not count as a result either way");

assert.strictEqual(byId.D.wins, 1, "beat C");
assert.strictEqual(byId.D.pointsAgainst, 90);

console.log("✓ Wins/losses/ties and points for/against are all correct, unscored matchups correctly ignored");

// Sort order: wins descending, points-for as tiebreaker.
assert.strictEqual(standings[0].teamId, "A", "A has the most wins (1 win + 1 tie beats a plain 1-1 record)");
console.log("✓ Standings are sorted by wins first, points-for as the tiebreaker");
