"use client";

import { useActionState } from "react";
import { createLeague } from "./actions";
import { FormField } from "@/components/form-field";

export function LeagueForm() {
  const [error, formAction, isPending] = useActionState(
    createLeague,
    undefined
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-md bg-surface p-8 ring-1 ring-line"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          New league
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-paper">
          Set up your dynasty
        </h1>
      </div>

      <div className="space-y-3">
        <FormField
          id="name"
          label="League name"
          placeholder="e.g. The Association"
          required
        />
        <FormField
          id="currentSeason"
          label="Current season"
          placeholder="2026-27"
          required
        />
        <FormField
          id="capAmount"
          label="Cap amount"
          type="number"
          defaultValue={200}
          required
        />
      </div>

      {error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Creating…" : "Create league"}
      </button>

      <p className="text-xs text-muted">
        Scoring categories and position pools (48 / 96 / 96 minutes) are
        created with working defaults — tune them from league settings
        once that page exists.
      </p>
    </form>
  );
}
