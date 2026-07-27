/**
 * Projects each team's salary cap situation after a proposed set of
 * player moves — without touching the database. This is what makes the
 * trade builder's cap preview "live": it's plain arithmetic that can run
 * directly in the browser as someone checks boxes, instead of needing a
 * round trip to find out whether an offer would actually be valid.
 *
 * Pure and dependency-free, same reasoning as scoring-engine.ts,
 * matchup-scoring.ts, and draft.ts: worth trusting because it's testable
 * without a database, not just because it's careful.
 */

export interface ContractYearInput {
  season: string;
  salary: number;
}

/**
 * Resolves what a contract actually costs for one specific season, now
 * that salary is a per-year breakdown (ContractYear) instead of one
 * flat number. Returns 0 for a season the contract doesn't cover —
 * either it hasn't started yet or it's already run out — same as
 * having no contract at all for cap purposes that season.
 */
export function resolveSalaryForSeason(
  years: ContractYearInput[],
  season: string
): number {
  return years.find((y) => y.season === season)?.salary ?? 0;
}

export interface TeamCapInput {
  teamId: string;
  capAmount: number;
  currentCommitted: number;
}

export interface PlayerSalaryInput {
  playerId: string;
  /** The player's team BEFORE the proposed trade. */
  teamId: string;
  salary: number;
}

export interface CapProjection {
  teamId: string;
  currentCommitted: number;
  projectedCommitted: number;
  capAmount: number;
  projectedSpace: number;
}

/**
 * @param destinations playerId -> new teamId. A player absent from this
 *   map, or mapped to their own current team, is treated as not moving.
 */
export function projectCapImpact(
  teams: TeamCapInput[],
  players: PlayerSalaryInput[],
  destinations: Record<string, string>
): CapProjection[] {
  return teams.map((team) => {
    let delta = 0;

    for (const player of players) {
      const dest = destinations[player.playerId];
      if (!dest || dest === player.teamId) continue; // not moving

      if (player.teamId === team.teamId) delta -= player.salary; // leaving this team
      if (dest === team.teamId) delta += player.salary; // arriving at this team
    }

    const projectedCommitted = team.currentCommitted + delta;

    return {
      teamId: team.teamId,
      currentCommitted: team.currentCommitted,
      projectedCommitted,
      capAmount: team.capAmount,
      projectedSpace: team.capAmount - projectedCommitted,
    };
  });
}
