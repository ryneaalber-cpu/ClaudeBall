"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { projectCapImpact } from "@/lib/cap";
import { proposeTrade } from "../actions";

export interface TradeBuilderTeam {
  id: string;
  name: string;
  capAmount: number;
  currentCommitted: number;
}

export interface TradeBuilderPlayer {
  id: string;
  name: string;
  position: string;
  salary: number;
  teamId: string;
}

export function TradeBuilder({
  leagueId,
  teams,
  players,
  initialDestinations,
  capEnabled,
}: {
  leagueId: string;
  teams: TradeBuilderTeam[];
  players: TradeBuilderPlayer[];
  initialDestinations: Record<string, string>;
  capEnabled: boolean;
}) {
  const router = useRouter();
  const [destinations, setDestinations] = useState<Record<string, string>>(
    initialDestinations
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const projections = useMemo(
    () =>
      projectCapImpact(
        teams.map((t) => ({
          teamId: t.id,
          capAmount: t.capAmount,
          currentCommitted: t.currentCommitted,
        })),
        players.map((p) => ({
          playerId: p.id,
          teamId: p.teamId,
          salary: p.salary,
        })),
        destinations
      ),
    [teams, players, destinations]
  );

  function setDestination(playerId: string, teamId: string) {
    setDestinations((prev) => {
      const next = { ...prev };
      if (teamId) next[playerId] = teamId;
      else delete next[playerId];
      return next;
    });
  }

  const movingCount = Object.keys(destinations).length;

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      try {
        await proposeTrade(
          leagueId,
          teams.map((t) => t.id),
          destinations
        );
        router.push(`/league/${leagueId}/trades`);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  return (
    <div className="space-y-8">
      {capEnabled && (
        <section>
          <h2 className="font-display text-lg font-medium text-paper">
            Cap impact
          </h2>
          <p className="mt-1 text-xs text-muted">
            Updates as you choose players below — nothing is sent until you
            click &ldquo;Send trade proposal.&rdquo;
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            {projections.map((p) => {
              const team = teams.find((t) => t.id === p.teamId)!;
              const over = p.projectedSpace < 0;
              const changed = p.projectedCommitted !== p.currentCommitted;
              return (
                <div
                  key={p.teamId}
                  className={`rounded-md px-4 py-3 ring-1 ring-line ${over ? "bg-red-950/40" : "bg-surface"}`}
                >
                  <p className="truncate font-mono text-xs uppercase tracking-wide text-muted">
                    {team.name}
                  </p>
                  <p
                    className={`stat-figure mt-1 font-display text-xl font-semibold ${over ? "text-red-400" : "text-paper"}`}
                  >
                    {p.projectedCommitted} / {p.capAmount}
                  </p>
                  <p
                    className={`stat-figure text-xs ${over ? "text-red-400" : "text-pos-guard"}`}
                  >
                    {over
                      ? `${Math.abs(p.projectedSpace)} over cap`
                      : `${p.projectedSpace} space`}
                    {changed && (
                      <span className="text-muted"> (was {p.currentCommitted})</span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <div key={team.id}>
            <h2 className="font-display text-lg font-medium text-paper">
              {team.name} sends
            </h2>
            <div className="mt-3 overflow-hidden rounded-md ring-1 ring-line">
              {players.filter((p) => p.teamId === team.id).length === 0 && (
                <p className="bg-surface px-3 py-4 text-center text-sm text-muted">
                  No roster.
                </p>
              )}
              {players
                .filter((p) => p.teamId === team.id)
                .map((player) => (
                  <div
                    key={player.id}
                    className="flex items-center justify-between gap-2 border-b border-line bg-surface px-3 py-2 text-sm last:border-b-0"
                  >
                    <span className="truncate text-paper">
                      {player.name}
                      <span className="ml-1.5 font-mono text-xs text-muted">
                        {player.position}
                        {capEnabled && ` · ${player.salary}`}
                      </span>
                    </span>
                    <select
                      value={destinations[player.id] ?? ""}
                      onChange={(e) => setDestination(player.id, e.target.value)}
                      className="shrink-0 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward"
                    >
                      <option value="">Keep</option>
                      {teams
                        .filter((t) => t.id !== team.id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            → {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || movingCount === 0}
        className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Sending…" : "Send trade proposal"}
      </button>
      <p className="text-xs text-muted">
        Contracts move with their players automatically if every team
        accepts — no separate step needed on the contracts page.
      </p>
    </div>
  );
}
