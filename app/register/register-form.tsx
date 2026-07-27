"use client";

import { useActionState } from "react";
import { registerUser } from "./actions";
import { FormField } from "@/components/form-field";

export function RegisterForm() {
  const [error, formAction, isPending] = useActionState(registerUser, undefined);

  return (
    <form
      action={formAction}
      className="w-full max-w-sm space-y-5 rounded-md bg-surface p-8 ring-1 ring-line"
    >
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
          Dynasty Fantasy Hoops
        </p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-paper">
          Create your account
        </h1>
        <p className="mt-2 text-sm text-muted">
          Pick a username your commissioner can use to add you to a team —
          that&apos;s the only thing about your account they&apos;ll ever
          need. Your email stays private; nobody in the league can see it.
        </p>
      </div>

      <div className="space-y-3">
        <FormField
          id="username"
          label="Username"
          required
          minLength={3}
          maxLength={20}
          pattern="[a-zA-Z0-9_]+"
          title="3-20 characters: letters, numbers, and underscores only"
        />
        <FormField id="email" label="Email (private — never shown to anyone)" type="email" required />
        <FormField
          id="password"
          label="Password"
          type="password"
          required
          minLength={8}
        />
        <p className="text-xs text-muted">
          At least 8 characters, with a mix of letters and numbers.
        </p>
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

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <a href="/login" className="text-pos-forward hover:underline">
          Sign in
        </a>
      </p>
    </form>
  );
}
