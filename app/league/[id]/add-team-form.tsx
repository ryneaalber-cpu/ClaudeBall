"use client";

import { useActionState } from "react";
import { addTeam, type AddTeamResult } from "./actions";
import { FormField } from "@/components/form-field";

export function AddTeamForm({ leagueId }: { leagueId: string }) {
  // Server actions only get (prevState, formData) from useActionState —
  // bind() is the documented way to also pass the league id, which comes
  // from the URL rather than the form itself.
  const boundAddTeam = addTeam.bind(null, leagueId);
  const [result, formAction, isPending] = useActionState<
    AddTeamResult | undefined,
    FormData
  >(boundAddTeam, undefined);

  return (
    <form
      action={formAction}
      className="space-y-3 rounded-md bg-surface p-6 ring-1 ring-line"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <FormField id="teamName" label="Team name" required />
        <FormField id="ownerName" label="Owner name" required />
        <FormField id="ownerEmail" label="Owner email" type="email" required />
      </div>

      {result && (
        <p
          className={`text-sm ${result.status === "error" ? "text-red-400" : "text-pos-guard"}`}
          role="status"
        >
          {result.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "Adding…" : "Add team"}
      </button>
    </form>
  );
}
