"use client";

import { useActionState } from "react";
import { syncDateRange } from "./actions";

export function SyncForm({ leagueId }: { leagueId: string }) {
  const boundSync = syncDateRange.bind(null, leagueId);
  const [result, formAction, isPending] = useActionState(boundSync, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-4 rounded-md bg-surface p-6 ring-1 ring-line"
    >
      <div>
        <h2 className="font-display text-lg font-medium text-paper">
          NBA data
        </h2>
        <p className="mt-1 text-xs text-muted">
          Pulls real games and box scores from balldontlie for the date
          range below (14 days max per run) — this is what fills the
          player search everywhere else in the app. Nothing else works
          until this has been run at least once. Pick dates from the
          most recently completed season for real, final data — today's
          date won't have anything if the season isn't currently live.
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
            name="startDate"
            type="date"
            required
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
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
            name="endDate"
            type="date"
            required
            className="mt-1 w-full rounded-sm border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-pos-forward"
          />
        </div>
      </div>

      {result && (
        <p
          className={`text-sm ${result.startsWith("Done") ? "text-pos-guard" : "text-red-400"}`}
          role="status"
        >
          {result}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Syncing… this can take a minute" : "Sync games"}
      </button>
    </form>
  );
}
