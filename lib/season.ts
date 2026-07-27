/**
 * Pure season-label helpers. Pure and dependency-free, same reasoning as
 * everywhere else in this project — used to auto-fill contract-year
 * inputs (see contracts/page.tsx and contracts/actions.ts) from a
 * league's currentSeason instead of asking someone to type several
 * season labels by hand.
 *
 * Lives outside any "use server" file on purpose: those files can only
 * export async functions, and neither of these is one — that exact
 * mistake (both landing in contracts/actions.ts) is what broke the
 * first deploy of the contract redesign.
 */
export function nextSeason(season: string): string {
  const [startRaw] = season.split("-");
  const start = Number(startRaw);
  if (!Number.isFinite(start)) return season; // malformed input — hand it back rather than guess

  const nextStart = start + 1;
  const nextEnd = (nextStart + 1) % 100;
  return `${nextStart}-${String(nextEnd).padStart(2, "0")}`;
}

export const MAX_CONTRACT_YEARS = 6;

/** The MAX_CONTRACT_YEARS season labels a contract form should show, starting from the league's current season. */
export function seasonLabelsFrom(currentSeason: string, count: number): string[] {
  const labels = [currentSeason];
  for (let i = 1; i < count; i++) labels.push(nextSeason(labels[i - 1]));
  return labels;
}
