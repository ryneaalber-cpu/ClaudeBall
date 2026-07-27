/**
 * Client for the balldontlie NBA API (https://balldontlie.io).
 *
 * Verified against their published docs and OpenAPI spec: base URL
 * `https://api.balldontlie.io`, API key passed in the `Authorization`
 * header, endpoints under `/nba/v1/...`, responses shaped as
 * `{ data: [...], meta: { next_cursor, per_page } }`.
 *
 * One thing NOT independently verified (couldn't hit the live API from
 * this sandbox — no network access): the exact query-string format for
 * array filters like game_ids/player_ids on the /stats endpoint. This
 * file assumes repeated keys (`game_ids=1&game_ids=2`); if balldontlie
 * actually expects bracket notation (`game_ids[]=1`), that's a one-line
 * fix in `toSearchParams` below. Worth a quick check against
 * https://docs.balldontlie.io before you rely on it.
 *
 * Sign up for a free API key at https://app.balldontlie.io, then set
 * BALLDONTLIE_API_KEY in your .env.
 */

const BASE_URL = "https://api.balldontlie.io/nba/v1";

export class BallDontLieError extends Error {}

export interface ProviderTeam {
  id: number;
  abbreviation: string;
  full_name: string;
}

export interface ProviderPlayer {
  id: number;
  first_name: string;
  last_name: string;
  /** Single position string from the provider (e.g. "F", "G", "C") — there's
   * no dual-eligibility concept here. That's set manually on our Player
   * model; see schema.prisma's comment on secondaryPosition. */
  position: string;
  team: ProviderTeam;
}

export interface ProviderGame {
  id: number;
  date: string;
  season: number;
  home_team: ProviderTeam;
  visitor_team: ProviderTeam;
  home_team_score: number;
  visitor_team_score: number;
  status: string;
}

export interface ProviderStatLine {
  id: number;
  player: ProviderPlayer;
  game: ProviderGame;
  /** Minutes as a string, e.g. "34" or "34:12" — use parseMinutes(). */
  min: string | null;
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  turnover: number;
  fgm: number;
  fga: number;
  fg3m: number;
  fg3a: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  pf: number;
}

interface ProviderResponse<T> {
  data: T;
  meta?: { next_cursor?: number; per_page?: number };
}

function requireApiKey(): string {
  const key = process.env.BALLDONTLIE_API_KEY;
  if (!key) {
    throw new BallDontLieError(
      "Missing BALLDONTLIE_API_KEY — get a free key at app.balldontlie.io and add it to .env"
    );
  }
  return key;
}

function toSearchParams(params: Record<string, string | number | number[] | undefined>): URLSearchParams {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) search.append(key, String(v));
    } else {
      search.set(key, String(value));
    }
  }
  return search;
}

async function bdlFetch<T>(
  path: string,
  params: Record<string, string | number | number[] | undefined> = {}
): Promise<ProviderResponse<T>> {
  const url = `${BASE_URL}${path}?${toSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { Authorization: requireApiKey() } });

  if (!res.ok) {
    throw new BallDontLieError(`balldontlie ${path} → ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<ProviderResponse<T>>;
}

/** Parses balldontlie's minute strings ("34", "34:12", null) into decimal minutes. */
export function parseMinutes(raw: string | null): number {
  if (!raw) return 0;
  if (raw.includes(":")) {
    const [minutes, seconds] = raw.split(":").map(Number);
    return minutes + seconds / 60;
  }
  const n = Number(raw);
  return Number.isNaN(n) ? 0 : n;
}

/** Games on a given date (YYYY-MM-DD). Paginate with the returned cursor if games.length hits per_page. */
export async function fetchGamesByDate(date: string, cursor?: number) {
  return bdlFetch<ProviderGame[]>("/games", { dates: date, cursor });
}

/** All box-score stat lines for one or more games. */
export async function fetchStatsForGames(gameIds: number[], cursor?: number) {
  return bdlFetch<ProviderStatLine[]>("/stats", { game_ids: gameIds, cursor });
}

/** Players on a given NBA team (by provider team id). */
export async function fetchPlayersByTeam(teamId: number, cursor?: number) {
  return bdlFetch<ProviderPlayer[]>("/players", { team_ids: [teamId], cursor });
}
