/**
 * Checks projectCapImpact's arithmetic with both a simple 2-team swap
 * and a 3-team trade — the multi-team case is the whole point of this
 * feature, so it gets its own scenario, not just an extrapolation from
 * the 2-team one.
 * Run with: npx tsx lib/cap.validate.ts
 */

import assert from "node:assert";
import { projectCapImpact, resolveSalaryForSeason } from "./cap";

// --- Resolving a season's salary from a per-year breakdown -------------
{
  const years = [
    { season: "2026-27", salary: 40 },
    { season: "2027-28", salary: 44 },
    { season: "2028-29", salary: 47 },
  ];

  assert.strictEqual(resolveSalaryForSeason(years, "2026-27"), 40, "first year of the deal");
  assert.strictEqual(resolveSalaryForSeason(years, "2028-29"), 47, "last year of the deal");
  assert.strictEqual(resolveSalaryForSeason(years, "2029-30"), 0, "a season after the deal ends costs nothing, same as no contract");
  assert.strictEqual(resolveSalaryForSeason([], "2026-27"), 0, "no years at all (e.g. a free agent) resolves to 0, not a crash");

  console.log("✓ Per-season salary resolves correctly for in-range, out-of-range, and empty contracts");
}

// --- Two-team swap ----------------------------------------------------
{
  const teams = [
    { teamId: "A", capAmount: 200, currentCommitted: 150 },
    { teamId: "B", capAmount: 200, currentCommitted: 180 },
  ];
  const players = [
    { playerId: "x", teamId: "A", salary: 30 }, // A -> B
    { playerId: "y", teamId: "B", salary: 20 }, // B -> A
  ];
  const destinations = { x: "B", y: "A" };

  const result = projectCapImpact(teams, players, destinations);
  const teamA = result.find((r) => r.teamId === "A")!;
  const teamB = result.find((r) => r.teamId === "B")!;

  assert.strictEqual(teamA.projectedCommitted, 140, "A: 150 - 30 (x leaves) + 20 (y arrives) = 140");
  assert.strictEqual(teamA.projectedSpace, 60, "A: 200 cap - 140 committed = 60 space");
  assert.strictEqual(teamB.projectedCommitted, 190, "B: 180 - 20 (y leaves) + 30 (x arrives) = 190");
  assert.strictEqual(teamB.projectedSpace, 10, "B: 200 cap - 190 committed = 10 space");

  console.log("✓ Two-team swap: A → 140 committed / 60 space, B → 190 committed / 10 space");
}

// --- Three-team trade ---------------------------------------------------
// A sends its player to B, B sends its player to C, C sends its player to A
// — a genuine three-way rotation, not just two separate 2-team trades.
{
  const teams = [
    { teamId: "A", capAmount: 200, currentCommitted: 100 },
    { teamId: "B", capAmount: 200, currentCommitted: 100 },
    { teamId: "C", capAmount: 200, currentCommitted: 100 },
  ];
  const players = [
    { playerId: "p1", teamId: "A", salary: 40 }, // A -> B
    { playerId: "p2", teamId: "B", salary: 25 }, // B -> C
    { playerId: "p3", teamId: "C", salary: 10 }, // C -> A
  ];
  const destinations = { p1: "B", p2: "C", p3: "A" };

  const result = projectCapImpact(teams, players, destinations);
  const teamA = result.find((r) => r.teamId === "A")!;
  const teamB = result.find((r) => r.teamId === "B")!;
  const teamC = result.find((r) => r.teamId === "C")!;

  assert.strictEqual(teamA.projectedCommitted, 70, "A: 100 - 40 (p1 leaves) + 10 (p3 arrives) = 70");
  assert.strictEqual(teamB.projectedCommitted, 115, "B: 100 - 25 (p2 leaves) + 40 (p1 arrives) = 115");
  assert.strictEqual(teamC.projectedCommitted, 115, "C: 100 - 10 (p3 leaves) + 25 (p2 arrives) = 115");
  assert.strictEqual(
    teamA.projectedCommitted + teamB.projectedCommitted + teamC.projectedCommitted,
    300,
    "a trade redistributes committed salary, it doesn't create or destroy it — total across all teams must stay 300"
  );

  console.log("✓ Three-team rotation: A → 70, B → 115, C → 115 committed (total conserved at 300)");
}

// --- A player not involved in the trade shouldn't move anyone's number --
{
  const teams = [{ teamId: "A", capAmount: 200, currentCommitted: 50 }];
  const players = [{ playerId: "bystander", teamId: "A", salary: 15 }];
  const result = projectCapImpact(teams, players, {}); // empty destinations — nobody moves

  assert.strictEqual(result[0].projectedCommitted, 50, "no destinations set means no cap change at all");
  console.log("✓ Untouched roster: no destination selected means committed salary doesn't move");
}
