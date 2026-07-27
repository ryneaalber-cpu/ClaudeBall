/**
 * Computes the next season label from a "YYYY-YY" string, e.g.
 * "2026-27" -> "2027-28". Pure and dependency-free, same reasoning as
 * everywhere else in this project — used to auto-fill contract-year
 * inputs (see contracts/actions.ts) from a league's currentSeason
 * instead of asking someone to type five season labels by hand.
 */
export function nextSeason(season: string): string {
  const [startRaw] = season.split("-");
  const start = Number(startRaw);
  if (!Number.isFinite(start)) return season; // malformed input — hand it back rather than guess

  const nextStart = start + 1;
  const nextEnd = (nextStart + 1) % 100;
  return `${nextStart}-${String(nextEnd).padStart(2, "0")}`;
}
