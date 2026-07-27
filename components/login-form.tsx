"use client";

import { useActionState } from "react";
import { authenticate } from "@/app/login/actions";
import { FormField } from "@/components/form-field";

export function LoginForm() {
  const [errorMessage, formAction, isPending] = useActionState(
    authenticate,
    undefined
  );

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
          Sign in
        </h1>
      </div>

      <div className="space-y-3">
        <FormField id="email" label="Email" type="email" required />
        <FormField id="password" label="Password" type="password" required />
      </div>

      {errorMessage && (
        <p className="text-sm text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-sm bg-pos-forward py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

