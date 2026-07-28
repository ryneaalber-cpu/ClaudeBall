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
export function normalizeName(name: string): string {
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

export interface ParsedPosition {
  primary: "C" | "F" | "G";
  secondary: "C" | "F" | "G" | null;
}

/** Parses the spreadsheet's own position tags ("G", "GF", "FC", ...)
 * into primary/secondary — this is real, commissioner-curated
 * dual-eligibility data (see schema.prisma's note on
 * Player.secondaryPosition), which should win over whatever a stats
 * provider's own single-position label happens to say. Only the first
 * two valid letters are kept; the schema has no room for a third
 * position, and no tag in the actual data needs one. */
export function parsePosition(raw: string): ParsedPosition {
  const valid = raw
    .trim()
    .toUpperCase()
    .split("")
    .filter((c): c is "C" | "F" | "G" => c === "C" || c === "F" || c === "G");

  return {
    primary: valid[0] ?? "F", // same "default to F" fallback as lib/sync.ts's mapPosition, for consistency
    secondary: valid[1] ?? null,
  };
}

const NAME_SUFFIXES = new Set(["jr", "jr.", "sr", "sr.", "ii", "iii", "iv", "v"]);

/** Best guess at a good search term for balldontlie's /players?search=
 * endpoint — the last non-suffix word, since that's normally the actual
 * last name and the most discriminating single term to search on.
 * "Tarris Reed Jr." -> "Reed", not "Jr." */
export function guessSearchTerm(name: string): string {
  const words = name.trim().split(/\s+/);
  for (let i = words.length - 1; i >= 0; i--) {
    if (!NAME_SUFFIXES.has(words[i].toLowerCase().replace(/\.$/, ""))) {
      return words[i];
    }
  }
  return words[words.length - 1] ?? name;
}
