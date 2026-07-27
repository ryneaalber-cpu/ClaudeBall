/**
 * Checks splitIntoChunks against the 2025-26 NBA regular season
 * breakdown that was worked out by hand first (13 chunks, Oct 21 2025
 * through Apr 12 2026) — this is the same set of dates already
 * double-checked one by one, now used as the test oracle instead of
 * just trusting the code by eye.
 * Run with: npx tsx lib/date-chunks.validate.ts
 */

import assert from "node:assert";
import { splitIntoChunks } from "./date-chunks";

// --- Full 2025-26 regular season, 14-day chunks ------------------------
{
  const chunks = splitIntoChunks("2025-10-21", "2026-04-12", 14);

  const expected = [
    ["2025-10-21", "2025-11-03"],
    ["2025-11-04", "2025-11-17"],
    ["2025-11-18", "2025-12-01"],
    ["2025-12-02", "2025-12-15"],
    ["2025-12-16", "2025-12-29"],
    ["2025-12-30", "2026-01-12"],
    ["2026-01-13", "2026-01-26"],
    ["2026-01-27", "2026-02-09"],
    ["2026-02-10", "2026-02-23"],
    ["2026-02-24", "2026-03-09"],
    ["2026-03-10", "2026-03-23"],
    ["2026-03-24", "2026-04-06"],
    ["2026-04-07", "2026-04-12"], // final partial chunk, only 6 days
  ];

  assert.strictEqual(chunks.length, 13, "13 chunks total, matching the hand-worked table");
  chunks.forEach((chunk, i) => {
    assert.strictEqual(chunk.start, expected[i][0], `chunk ${i + 1} start`);
    assert.strictEqual(chunk.end, expected[i][1], `chunk ${i + 1} end`);
  });

  console.log("✓ Matches the hand-worked 13-chunk season breakdown exactly, including the Feb/March-end edge cases");
}

// --- Range shorter than maxDays: exactly one chunk, unchanged ----------
{
  const chunks = splitIntoChunks("2026-02-01", "2026-02-14", 14);
  assert.strictEqual(chunks.length, 1);
  assert.deepStrictEqual(chunks[0], { start: "2026-02-01", end: "2026-02-14" });
  console.log("✓ A range at or under maxDays produces exactly one unchanged chunk");
}

// --- Single-day range -----------------------------------------------
{
  const chunks = splitIntoChunks("2026-02-01", "2026-02-01", 14);
  assert.deepStrictEqual(chunks, [{ start: "2026-02-01", end: "2026-02-01" }]);
  console.log("✓ A single-day range produces one single-day chunk, no crash");
}

// --- Invalid range (end before start): no chunks, no crash -------------
{
  const chunks = splitIntoChunks("2026-02-14", "2026-02-01", 14);
  assert.deepStrictEqual(chunks, []);
  console.log("✓ End-before-start returns no chunks instead of an infinite loop or crash");
}
