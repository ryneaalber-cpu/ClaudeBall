"use client";

import { useState } from "react";
import { syncDateRange } from "./actions";
import { splitIntoChunks } from "@/lib/date-chunks";

const CHUNK_DAYS = 14;

export function SyncForm({ leagueId }: { leagueId: string }) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [log, setLog] = useState<{ text: string; ok: boolean }[]>([]);
  const [totalGames, setTotalGames] = useState<number | null>(null);

  async function runSync() {
    if (!startDate || !endDate) return;

    const chunks = splitIntoChunks(startDate, endDate, CHUNK_DAYS);
    if (chunks.length === 0) {
      setLog([{ text: "Start date must be on or before the end date.", ok: false }]);
      return;
    }

    setIsRunning(true);
    setLog([]);
    setTotalGames(null);

    let games = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      setProgress({ current: i + 1, total: chunks.length });

      const formData = new FormData();
      formData.set("startDate", chunk.start);
      formData.set("endDate", chunk.end);

      const result = await syncDateRange(leagueId, undefined, formData);
      const ok = Boolean(result?.startsWith("Done"));

      setLog((prev) => [...prev, { text: `${chunk.start} – ${chunk.end}: ${result}`, ok }]);

      if (!ok) {
        // Stop rather than push on past a failure — whatever succeeded
        // before this point is already saved (each chunk commits on its
        // own), so re-running from a later start date picks up cleanly.
        setIsRunning(false);
        setProgress(null);
        return;
      }

      const match = result?.match(/synced (\d+) game/);
      games += match ? Number(match[1]) : 0;
    }

    setTotalGames(games);
    setIsRunning(false);
    setProgress(null);
  }

  return (
    <div className="w-full max-w-sm space-y-4 rounded-md bg-surface p-6 ring-1 ring-line">
      <div>
        <h2 className="font-display text-lg font-medium text-paper">NBA data</h2>
        <p className="mt-1 text-xs text-muted">
          Enter any range — a whole season is fine. Longer than{" "}
          {CHUNK_DAYS} days automatically splits into {CHUNK_DAYS}-day
          pieces and syncs them one after another, so one click here
          covers it, no retyping dates in between. Each piece still
          respects balldontlie&apos;s rate limit and Vercel&apos;s per-request
          time limit — that&apos;s why it&apos;s still several requests behind
          the scenes, just not several clicks anymore.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="startDate"
            className="block text-xs uppercase tracking-wide text-muted"
          >
            Start date
          </label>
          <input
            id="startDate"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            disabled={isRunning}
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward disabled:opacity-50"
          />
        </div>
        <div>
          <label
            htmlFor="endDate"
            className="block text-xs uppercase tracking-wide text-muted"
          >
            End date
          </label>
          <input
            id="endDate"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            disabled={isRunning}
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward disabled:opacity-50"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={runSync}
        disabled={isRunning || !startDate || !endDate}
        className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning && progress
          ? `Syncing… (${progress.current}/${progress.total})`
          : "Sync games"}
      </button>

      {log.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto rounded-sm bg-ink p-3 font-mono text-[11px] leading-relaxed">
          {log.map((entry, i) => (
            <p key={i} className={entry.ok ? "text-muted" : "text-red-400"}>
              {entry.ok ? "✓ " : "✕ "}
              {entry.text}
            </p>
          ))}
        </div>
      )}

      {!isRunning && totalGames !== null && (
        <p className="text-sm text-pos-guard" role="status">
          All done — {totalGames} total game{totalGames === 1 ? "" : "s"}{" "}
          synced across the whole range.
        </p>
      )}
    </div>
  );
}
