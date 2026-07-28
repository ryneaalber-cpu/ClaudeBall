/**
 * Matches players from the imported spreadsheet data against the real,
 * already-synced Player records (from balldontlie — see lib/sync.ts).
 * Pure and dependency-free, same reasoning as everywhere else in this
 * project: name matching has real edge cases (periods in initials,
 * apostrophes, suffixes) worth getting right with a test, not just
 * trusting a direct string comparison by eye.
 */

export interface ImportPlayer {
  position: string;
  name: string;
  spotracUrl: string | null;
  contractType: "STANDARD" | "TWO_WAY" | "EXHIBIT_10" | "UNSIGNED_PICK" | null;
  restriction: "UFA" | "RFA" | null;
  salaryYears: number[];
}

export interface SyncedPlayer {
  id: string;
  firstName: string;
  lastName: string;
}

export interface MatchResult {
  importPlayer: ImportPlayer;
  matchedPlayerId: string | null;
}

/** Lowercase, trim, drop periods/apostrophes (formatting noise that
 * varies between sources), collapse whitespace — but keep hyphens,
 * since those are meaningfully part of a name, not formatting noise. */
function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[.'']/g, "")
    .replace(/\s+/g, " ");
}

export function matchPlayers(
  importPlayers: ImportPlayer[],
  syncedPlayers: SyncedPlayer[]
): MatchResult[] {
  const bySyncedName = new Map<string, string>();
  for (const p of syncedPlayers) {
    bySyncedName.set(normalizeName(`${p.firstName} ${p.lastName}`), p.id);
  }

  return importPlayers.map((importPlayer) => ({
    importPlayer,
    matchedPlayerId: bySyncedName.get(normalizeName(importPlayer.name)) ?? null,
  }));
}

/** The team names available to import, read directly off the baked-in
 * data — used to build the import form without duplicating the list by
 * hand. Takes the parsed JSON as a parameter rather than importing it
 * directly, so this stays a pure function with no file I/O of its own. */
export function importableTeamNames(importData: Record<string, unknown>): string[] {
  return Object.keys(importData);
}
