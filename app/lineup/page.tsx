import {
  calculateTeamGameScore,
  DEFAULT_POSITION_POOLS,
  DEFAULT_SCORING_WEIGHTS,
  type RosterEntry,
  type PlayerGameStats,
  type Position,
} from "@/lib/scoring-engine";

// Example data for this scaffold — swap for a real DB query (roster +
// synced box scores) once auth and the stats sync are wired up. The
// minutes/positions below follow sports.ws's own worked example; the box
// score numbers are illustrative, not a real historical game.
const EXAMPLE_ROSTER: RosterEntry[] = [
  { playerId: "drummond", eligiblePositions: ["C"], priorityOrder: 1 },
  { playerId: "noah", eligiblePositions: ["C"], priorityOrder: 2 },
  { playerId: "randle", eligiblePositions: ["F"], priorityOrder: 3 },
  { playerId: "markkanen", eligiblePositions: ["F"], priorityOrder: 4 },
  { playerId: "chriss", eligiblePositions: ["F"], priorityOrder: 5 },
  { playerId: "bazemore", eligiblePositions: ["F", "G"], priorityOrder: 6 },
  { playerId: "trier", eligiblePositions: ["G"], priorityOrder: 7 },
];

const PLAYER_NAMES: Record<string, string> = {
  drummond: "Andre Drummond",
  noah: "Joakim Noah",
  randle: "Julius Randle",
  markkanen: "Lauri Markkanen",
  chriss: "Marquese Chriss",
  bazemore: "Kent Bazemore",
  trier: "Allonzo Trier",
};

const EXAMPLE_STATS = new Map<string, PlayerGameStats>([
  ["drummond", { playerId: "drummond", minutesPlayed: 34, stats: { PTS: 18, REB: 16, AST: 1, BLK: 1 } }],
  ["noah", { playerId: "noah", minutesPlayed: 17, stats: { PTS: 6, REB: 9, AST: 4, STL: 1 } }],
  ["randle", { playerId: "randle", minutesPlayed: 35, stats: { PTS: 24, REB: 10, AST: 4 } }],
  ["markkanen", { playerId: "markkanen", minutesPlayed: 25, stats: { PTS: 19, REB: 7, AST: 1 } }],
  ["chriss", { playerId: "chriss", minutesPlayed: 15, stats: { PTS: 8, REB: 5, AST: 0 } }],
  ["bazemore", { playerId: "bazemore", minutesPlayed: 25, stats: { PTS: 12, REB: 3, AST: 2, STL: 2 } }],
  ["trier", { playerId: "trier", minutesPlayed: 22, stats: { PTS: 14, REB: 2, AST: 3 } }],
]);

const POSITION_COLOR: Record<Position, string> = {
  C: "bg-pos-center",
  F: "bg-pos-forward",
  G: "bg-pos-guard",
};
const POSITION_LABEL: Record<Position, string> = {
  C: "Center",
  F: "Forward",
  G: "Guard",
};

export default function LineupPage() {
  const result = calculateTeamGameScore(
    EXAMPLE_ROSTER,
    EXAMPLE_STATS,
    DEFAULT_POSITION_POOLS,
    DEFAULT_SCORING_WEIGHTS
  );

  const segmentsByPosition: Record<
    Position,
    { playerId: string; minutes: number }[]
  > = { C: [], F: [], G: [] };
  for (const c of result.contributions) {
    for (const [pos, minutes] of Object.entries(c.positionsFilled) as [
      Position,
      number,
    ][]) {
      segmentsByPosition[pos].push({ playerId: c.playerId, minutes });
    }
  }

  return (
    <main className="min-h-screen bg-ink px-6 py-10 sm:px-12">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Game 12 · Example lineup
        </p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
          Ironside vs. Blazers
        </h1>
        <p className="mt-1 text-sm text-muted">
          Illustrative data — swap in a live roster and synced box scores
          once the database is connected.
        </p>

        {/* Position pool meters — the core mechanic, made visible */}
        <section className="mt-10 space-y-5">
          {DEFAULT_POSITION_POOLS.map((pool) => {
            const segments = segmentsByPosition[pool.position];
            const used = segments.reduce((sum, s) => sum + s.minutes, 0);
            return (
              <div key={pool.position}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-display text-sm font-medium uppercase tracking-wide text-paper">
                    {POSITION_LABEL[pool.position]}
                  </span>
                  <span className="stat-figure font-mono text-sm text-muted">
                    {used} / {pool.minutePool} min
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-sm bg-surface ring-1 ring-line">
                  {segments.map((s, i) => (
                    <div
                      key={s.playerId + i}
                      className={`${POSITION_COLOR[pool.position]} h-full border-r-2 border-ink last:border-r-0`}
                      style={{
                        width: `${(s.minutes / pool.minutePool) * 100}%`,
                        opacity: 1 - i * 0.14,
                      }}
                      title={`${PLAYER_NAMES[s.playerId]} — ${s.minutes} min`}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* Roster, in the priority order the owner set */}
        <section className="mt-12">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg font-medium text-paper">
              Lineup
            </h2>
            <span className="font-mono text-xs uppercase tracking-wide text-muted">
              Priority order
            </span>
          </div>

          <div className="overflow-hidden rounded-md ring-1 ring-line">
            {result.contributions.map((c, i) => {
              const positions = EXAMPLE_ROSTER.find(
                (r) => r.playerId === c.playerId
              )!.eligiblePositions;
              return (
                <div
                  key={c.playerId}
                  className="flex items-center gap-4 border-b border-line bg-surface px-4 py-3 last:border-b-0"
                >
                  <span className="font-mono text-xs text-muted">{i + 1}</span>
                  <div className="flex gap-1">
                    {positions.map((p) => (
                      <span
                        key={p}
                        className={`${POSITION_COLOR[p]} rounded-sm px-1.5 py-0.5 text-[10px] font-semibold text-ink`}
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                  <span className="flex-1 truncate text-sm font-medium text-paper">
                    {PLAYER_NAMES[c.playerId]}
                  </span>
                  <span className="stat-figure w-24 text-right font-mono text-xs text-muted">
                    {c.minutesConsumed}/{c.minutesPlayed} min
                  </span>
                  <span className="stat-figure w-16 text-right font-mono text-sm text-paper">
                    {c.proratedFantasyPoints.toFixed(1)} pts
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8 flex items-baseline justify-between rounded-md bg-surfaceRaised px-5 py-4 ring-1 ring-line">
          <span className="font-display text-sm uppercase tracking-wide text-muted">
            Team total
          </span>
          <span className="stat-figure font-display text-3xl font-semibold text-paper">
            {result.totalScore.toFixed(1)}
          </span>
        </section>
      </div>
    </main>
  );
}
