/**
 * Checks matchPlayers against realistic name-formatting edge cases
 * pulled from the actual imported data, plus a deliberate non-match.
 * Run with: npx tsx lib/nfba-import.validate.ts
 */

import assert from "node:assert";
import { matchPlayers, type ImportPlayer, type SyncedPlayer } from "./nfba-import";

function importPlayer(name: string): ImportPlayer {
  return { position: "G", name, spotracUrl: null, contractType: "STANDARD", restriction: "UFA", salaryYears: [1] };
}

const synced: SyncedPlayer[] = [
  { id: "1", firstName: "E.J.", lastName: "Liddell" }, // periods in the synced record itself
  { id: "2", firstName: "Karl-Anthony", lastName: "Towns" }, // hyphenated first name
  { id: "3", firstName: "De'Aaron", lastName: "Fox" }, // apostrophe
  { id: "4", firstName: "LeBron", lastName: "James" },
];

const results = matchPlayers(
  [
    importPlayer("E.J. Liddell"), // exact punctuation match
    importPlayer("EJ Liddell"), // periods dropped on the import side
    importPlayer("Karl-Anthony Towns"), // hyphen preserved both sides — must still match
    importPlayer("DeAaron Fox"), // apostrophe dropped on the import side
    importPlayer("Some Retired Guy"), // genuinely not in the synced set
  ],
  synced
);

assert.strictEqual(results[0].matchedPlayerId, "1", "exact match, including periods");
assert.strictEqual(results[1].matchedPlayerId, "1", "periods stripped on import side still match the punctuated synced record");
assert.strictEqual(results[2].matchedPlayerId, "2", "hyphenated name matches exactly — hyphens are NOT stripped");
assert.strictEqual(results[3].matchedPlayerId, "3", "apostrophe stripped on import side still matches");
assert.strictEqual(results[4].matchedPlayerId, null, "a genuine non-match resolves to null, not a false positive");

console.log("✓ Periods and apostrophes are treated as formatting noise; hyphens are not; genuine non-matches stay null");
