/**
 * Generates a round-robin schedule using the standard "circle method":
 * fix one team, rotate everyone else by one position each round. Every
 * team plays every other team exactly once per full cycle; if more
 * game-number windows are requested than one cycle needs, the cycle
 * repeats — which is normal for fantasy sports (an 82-game NBA season
 * is far longer than a small league's team count allows for a single
 * round-robin pass).
 *
 * An odd number of teams gets a "bye" slot added internally so the
 * math stays even; whichever team lands on the bye in a given round
 * just doesn't get a matchup that round.
 *
 * Pure and dependency-free, same reasoning as every other algorithmic
 * piece in this project: worth trusting because it's testable without
 * a database, not just because it's careful.
 */

export interface ScheduledMatchup {
  gameNumber: number;
  teamAId: string;
  teamBId: string;
}

const BYE = "__BYE__";

export function generateRoundRobinSchedule(
  teamIds: string[],
  gameNumbers: number
): ScheduledMatchup[] {
  if (teamIds.length < 2) return [];

  const ids = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const roundsPerCycle = ids.length - 1;
  const schedule: ScheduledMatchup[] = [];

  for (let gameNumber = 1; gameNumber <= gameNumbers; gameNumber++) {
    const roundIndex = (gameNumber - 1) % roundsPerCycle;
    const roundOrder = rotateForRound(ids, roundIndex);

    for (let i = 0; i < roundOrder.length / 2; i++) {
      const teamA = roundOrder[i];
      const teamB = roundOrder[roundOrder.length - 1 - i];
      if (teamA === BYE || teamB === BYE) continue;
      schedule.push({ gameNumber, teamAId: teamA, teamBId: teamB });
    }
  }

  return schedule;
}

/** Position 0 stays fixed; everyone else rotates right by roundIndex positions. */
function rotateForRound(ids: string[], roundIndex: number): string[] {
  const fixed = ids[0];
  const rest = ids.slice(1);
  const n = rest.length;
  const k = roundIndex % n;
  const rotated = [...rest.slice(n - k), ...rest.slice(0, n - k)];
  return [fixed, ...rotated];
}
