/**
 * Generates a snake draft order: round 1 goes in team order, round 2
 * reverses, round 3 goes forward again, and so on. Pick numbers are
 * sequential across the whole draft (1 through teams.length * rounds),
 * not reset each round — that's what makes "the next pick" a simple
 * lowest-pickNumber-with-no-player query instead of needing a separate
 * round/slot pointer.
 *
 * Pure and dependency-free on purpose, same reasoning as
 * scoring-engine.ts and matchup-scoring.ts: the part worth trusting
 * shouldn't need a database connection to even test.
 */

export interface DraftPickSlot {
  pickNumber: number;
  round: number;
  teamId: string;
}

export function generateSnakeOrder(
  teamIds: string[],
  rounds: number
): DraftPickSlot[] {
  const slots: DraftPickSlot[] = [];
  let pickNumber = 1;

  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? teamIds : [...teamIds].reverse();
    for (const teamId of order) {
      slots.push({ pickNumber, round, teamId });
      pickNumber++;
    }
  }

  return slots;
}
