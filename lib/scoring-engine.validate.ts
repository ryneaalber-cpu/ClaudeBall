/**
 * Sanity-checks calculateTeamGameScore against the exact worked example
 * from sports.ws's own public "fantasy primer" page (2018-19 season
 * averages example). Run with: npx tsx lib/scoring-engine.validate.ts
 *
 * The primer describes two specific, checkable behaviors:
 *   1. Drummond (C) uses 34 of a 48-minute center pool; Noah (C) then uses
 *      14 of his 17 played minutes to fill the remaining 14 — an ~82%
 *      "used" rate, which the primer states explicitly.
 *   2. Bazemore (F/G dual-eligible) fills the last 21 minutes of the
 *      forward pool, then spills his remaining 4 minutes into guard.
 *
 * It does NOT describe a full 12-15 man roster, so this script tests those
 * two documented behaviors directly rather than guessing at unstated
 * numbers (e.g. exactly how many minutes Randle/Markkanen/Chriss played).
 */

import assert from "node:assert";
import { calculateTeamGameScore, type RosterEntry, type PlayerGameStats } from "./scoring-engine";

function approxEqual(a: number, b: number, tolerance = 0.01) {
  assert.ok(
    Math.abs(a - b) <= tolerance,
    `Expected ${a} to be within ${tolerance} of ${b}`
  );
}

// --- Test 1: center pool (Drummond + Noah) ---------------------------------
{
  const roster: RosterEntry[] = [
    { playerId: "drummond", eligiblePositions: ["C"], priorityOrder: 1 },
    { playerId: "noah", eligiblePositions: ["C"], priorityOrder: 2 },
  ];

  const gameStats = new Map<string, PlayerGameStats>([
    ["drummond", { playerId: "drummond", minutesPlayed: 34, stats: {} }],
    ["noah", { playerId: "noah", minutesPlayed: 17, stats: {} }],
  ]);

  const result = calculateTeamGameScore(
    roster,
    gameStats,
    [{ position: "C", minutePool: 48 }],
    {} // weights don't matter for this test — we're checking minutes, not points
  );

  const drummond = result.contributions.find((c) => c.playerId === "drummond")!;
  const noah = result.contributions.find((c) => c.playerId === "noah")!;

  assert.strictEqual(drummond.minutesConsumed, 34, "Drummond should fully use his 34 minutes");
  assert.strictEqual(noah.minutesConsumed, 14, "Noah should only fill the remaining 14 center minutes");
  approxEqual(noah.fraction, 14 / 17, 0.001); // primer states this as "82%"
  approxEqual(noah.fraction * 100, 82, 0.5);

  console.log("✓ Test 1 passed: center pool fills to 48 via Drummond (34) + Noah (14/17, ~82% used)");
}

// --- Test 2: dual-eligibility spillover (Bazemore) --------------------------
{
  // Filler forward who uses 75 of the 96 forward minutes, leaving exactly
  // 21 — matching "there were only 21 forward minutes available" when
  // Bazemore's turn comes up.
  const roster: RosterEntry[] = [
    { playerId: "filler-forward", eligiblePositions: ["F"], priorityOrder: 1 },
    { playerId: "bazemore", eligiblePositions: ["F", "G"], priorityOrder: 2 },
  ];

  const gameStats = new Map<string, PlayerGameStats>([
    ["filler-forward", { playerId: "filler-forward", minutesPlayed: 75, stats: {} }],
    ["bazemore", { playerId: "bazemore", minutesPlayed: 25, stats: {} }],
  ]);

  const result = calculateTeamGameScore(
    roster,
    gameStats,
    [
      { position: "F", minutePool: 96 },
      { position: "G", minutePool: 96 },
    ],
    {}
  );

  const bazemore = result.contributions.find((c) => c.playerId === "bazemore")!;

  assert.strictEqual(bazemore.positionsFilled.F, 21, "Bazemore should fill the last 21 forward minutes");
  assert.strictEqual(bazemore.positionsFilled.G, 4, "Bazemore's remaining 4 minutes should spill into guard");
  assert.strictEqual(bazemore.minutesConsumed, 25, "All of Bazemore's 25 minutes should be used (100%)");

  console.log("✓ Test 2 passed: Bazemore fills 21 forward + spills 4 into guard, exactly as in the primer");
}

console.log("\nAll checks passed against the sports.ws worked example.");
