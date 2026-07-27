/**
 * Checks generateSnakeOrder does what a snake draft is supposed to do:
 * reverse team order every round, keep pick numbers sequential.
 * Run with: npx tsx lib/draft.validate.ts
 */

import assert from "node:assert";
import { generateSnakeOrder } from "./draft";

const order = generateSnakeOrder(["A", "B", "C"], 3);

assert.strictEqual(order.length, 9, "3 teams x 3 rounds = 9 picks");

assert.deepStrictEqual(
  order.slice(0, 3).map((s) => s.teamId),
  ["A", "B", "C"],
  "round 1 goes in the order given"
);
assert.deepStrictEqual(
  order.slice(3, 6).map((s) => s.teamId),
  ["C", "B", "A"],
  "round 2 reverses (the actual 'snake')"
);
assert.deepStrictEqual(
  order.slice(6, 9).map((s) => s.teamId),
  ["A", "B", "C"],
  "round 3 goes forward again"
);

assert.strictEqual(order[0].pickNumber, 1);
assert.strictEqual(order[0].round, 1);
assert.strictEqual(order[8].pickNumber, 9, "pick numbers are sequential across the whole draft, not reset each round");
assert.strictEqual(order[8].round, 3);

console.log("✓ Snake draft order test passed: A-B-C, C-B-A, A-B-C, pick numbers 1 through 9");
