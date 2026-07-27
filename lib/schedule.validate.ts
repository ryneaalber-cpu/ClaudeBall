/**
 * Checks generateRoundRobinSchedule against a 4-team example worked out
 * by hand first (see the comments below), plus an odd-team-count case
 * to confirm byes work.
 * Run with: npx tsx lib/schedule.validate.ts
 */

import assert from "node:assert";
import { generateRoundRobinSchedule } from "./schedule";

// --- 4 teams, one full cycle (3 rounds) --------------------------------
// Hand-worked circle method for [A, B, C, D]:
//   Round 1 (fixed A, no rotation):      A-D, B-C
//   Round 2 (rest rotated right by 1):   A-C, D-B
//   Round 3 (rest rotated right by 2):   A-B, C-D
// Every pair (AB, AC, AD, BC, BD, CD) appears exactly once across the
// three rounds — that's what a correct round-robin guarantees.
{
  const schedule = generateRoundRobinSchedule(["A", "B", "C", "D"], 3);

  assert.strictEqual(schedule.length, 6, "4 teams, 3 rounds, 2 matchups per round = 6 total");

  const asPairs = (gameNumber: number) =>
    schedule
      .filter((m) => m.gameNumber === gameNumber)
      .map((m) => [m.teamAId, m.teamBId].sort().join("-"));

  assert.deepStrictEqual(asPairs(1), ["A-D", "B-C"]);
  assert.deepStrictEqual(asPairs(2), ["A-C", "B-D"]);
  assert.deepStrictEqual(asPairs(3), ["A-B", "C-D"]);

  const allPairs = schedule.map((m) => [m.teamAId, m.teamBId].sort().join("-")).sort();
  assert.deepStrictEqual(
    allPairs,
    ["A-B", "A-C", "A-D", "B-C", "B-D", "C-D"],
    "every possible pair appears exactly once in one full cycle"
  );

  console.log("✓ 4-team round robin matches the hand-worked example exactly");
}

// --- Cycle repeats correctly for more game numbers than one cycle needs
{
  const schedule = generateRoundRobinSchedule(["A", "B", "C", "D"], 9); // 3 full cycles
  assert.strictEqual(schedule.length, 18, "3 full cycles of 6 matchups each");
  // Game 4 should repeat game 1's pairing (cycle length 3).
  const game1 = schedule.filter((m) => m.gameNumber === 1).map((m) => [m.teamAId, m.teamBId].sort().join("-"));
  const game4 = schedule.filter((m) => m.gameNumber === 4).map((m) => [m.teamAId, m.teamBId].sort().join("-"));
  assert.deepStrictEqual(game4, game1, "the schedule cycles once it runs out of unique rounds");
  console.log("✓ Longer seasons correctly repeat the round-robin cycle");
}

// --- Odd team count: someone sits out each round -----------------------
{
  const schedule = generateRoundRobinSchedule(["A", "B", "C"], 3);
  // 3 teams -> bye added -> 2 matchups possible per round, but only 1
  // actual matchup per round since one of the 2 "teams" each round is the bye.
  const perRound = [1, 2, 3].map((g) => schedule.filter((m) => m.gameNumber === g).length);
  assert.deepStrictEqual(perRound, [1, 1, 1], "with 3 teams, exactly one matchup happens per round (one team byes)");
  assert.strictEqual(schedule.length, 3);
  console.log("✓ Odd team count correctly gives everyone a bye in rotation, no crash");
}
