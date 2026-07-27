"use client";

import { useActionState } from "react";
import { createFirstUser } from "./actions";
import { FormField } from "@/components/form-field";

export function SetupForm() {
  const [error, formAction, isPending] = useActionState(
    createFirstUser,
    undefined
  );

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-md bg-surface p-8 ring-1 ring-line"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          First-run setup
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-paper">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          This is a one-time step. This account becomes the league
          commissioner — you&apos;ll add everyone else&apos;s accounts
          later from inside the app.
        </p>
      </div>

      <div className="space-y-3">
        <FormField id="name" label="Your name" required />
        <FormField id="email" label="Email" type="email" required />
        <FormField
          id="password"
          label="Password"
          type="password"
          required
          minLength={8}
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
        {isPending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
