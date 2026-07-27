/**
 * Splits a date range into consecutive chunks of at most maxDays each.
 * Pure and dependency-free, same reasoning as everywhere else in this
 * project — this is the logic behind "sync the whole season in one
 * click" (see settings/sync-form.tsx), and date-boundary math is
 * exactly the kind of thing worth getting right with a real test
 * rather than trusting by eye.
 */

export interface DateChunk {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

export function splitIntoChunks(
  startDate: string,
  endDate: string,
  maxDays: number
): DateChunk[] {
  const dayMs = 24 * 60 * 60 * 1000;
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [];
  }

  const chunks: DateChunk[] = [];
  let chunkStart = start;

  while (chunkStart <= end) {
    const candidate = new Date(chunkStart.getTime() + (maxDays - 1) * dayMs);
    const chunkEnd = candidate < end ? candidate : end;
    chunks.push({
      start: chunkStart.toISOString().slice(0, 10),
      end: chunkEnd.toISOString().slice(0, 10),
    });
    chunkStart = new Date(chunkEnd.getTime() + dayMs);
  }

  return chunks;
}
