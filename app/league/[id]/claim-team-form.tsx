"use client";

import { useActionState } from "react";
import { claimTeam, type AddTeamResult } from "./actions";

export function ClaimTeamForm({ leagueId, teamId }: { leagueId: string; teamId: string }) {
  const boundClaim = claimTeam.bind(null, leagueId, teamId);
  const [result, formAction, isPending] = useActionState<AddTeamResult | undefined, FormData>(
    boundClaim,
    undefined
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input
        type="text"
        name="username"
        placeholder="username"
        disabled={isPending}
        className="w-28 rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-sm bg-pos-forward px-2 py-1 text-xs font-semibold text-ink hover:opacity-90 disabled:opacity-60"
      >
        {isPending ? "…" : "Claim"}
      </button>
      {result && result.status === "error" && (
        <span className="text-[10px] text-red-400">{result.message}</span>
      )}
    </form>
  );
}
