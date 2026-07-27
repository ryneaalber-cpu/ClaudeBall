/**
 * Computes win-loss standings from a list of matchups. Pure and
 * dependency-free — same reasoning as everywhere else in this project:
 * the logic worth trusting shouldn't need a database to test.
 */

export interface MatchupResult {
  teamAId: string;
  teamBId: string;
  teamAScore: number | null;
  teamBScore: number | null;
}

export interface TeamStanding {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
}

/** Matchups with a null score on either side are treated as not yet played and skipped. */
export function computeStandings(
  teamIds: string[],
  matchups: MatchupResult[]
): TeamStanding[] {
  const standings = new Map<string, TeamStanding>(
    teamIds.map((id) => [
      id,
      { teamId: id, wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 },
    ])
  );

  for (const m of matchups) {
    if (m.teamAScore === null || m.teamBScore === null) continue;

    const a = standings.get(m.teamAId);
    const b = standings.get(m.teamBId);
    if (!a || !b) continue;

    a.pointsFor += m.teamAScore;
    a.pointsAgainst += m.teamBScore;
    b.pointsFor += m.teamBScore;
    b.pointsAgainst += m.teamAScore;

    if (m.teamAScore > m.teamBScore) {
      a.wins += 1;
      b.losses += 1;
    } else if (m.teamBScore > m.teamAScore) {
      b.wins += 1;
      a.losses += 1;
    } else {
      a.ties += 1;
      b.ties += 1;
    }
  }

  return [...standings.values()].sort(
    (x, y) => y.wins - x.wins || y.pointsFor - x.pointsFor
  );
}
