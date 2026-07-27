/**
 * Checks nextSeason across a normal case, a decade rollover, and a
 * century rollover, plus malformed input.
 * Run with: npx tsx lib/season.validate.ts
 */

import assert from "node:assert";
import { nextSeason } from "./season";

assert.strictEqual(nextSeason("2026-27"), "2027-28");
console.log("✓ Normal case: 2026-27 -> 2027-28");

assert.strictEqual(nextSeason("2029-30"), "2030-31");
console.log("✓ Decade rollover: 2029-30 -> 2030-31 (trailing part doesn't stay '30')");

assert.strictEqual(nextSeason("2099-00"), "2100-01");
console.log("✓ Century rollover: 2099-00 -> 2100-01, not 2100-100");

assert.strictEqual(nextSeason("not-a-season"), "not-a-season");
console.log("✓ Malformed input is handed back unchanged instead of producing NaN-anything");
