"use client";

import { useState } from "react";
import { importTeam, type ImportTeamResult } from "./import-actions";
import { importableTeamNames } from "@/lib/nfba-import";
import importData from "@/lib/nfba-import-data.json";

const TEAM_NAMES = importableTeamNames(importData);

// Display-only — the actual stored team name stays the abbreviation key
// above, matching the source data exactly. This just makes the form
// itself readable, since nobody thinks in "ORL" day to day.
const TEAM_DISPLAY_NAMES: Record<string, string> = {
  ATL: "Atlanta Hawks",
  BOS: "Boston Celtics",
  BKN: "Brooklyn Nets",
  CHA: "Charlotte Hornets",
  CHI: "Chicago Bulls",
  CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets",
  DET: "Detroit Pistons",
  GSW: "Golden State Warriors",
  HOU: "Houston Rockets",
  IND: "Indiana Pacers",
  LAL: "Los Angeles Lakers",
  MEM: "Memphis Grizzlies",
  MIA: "Miami Heat",
  MIL: "Milwaukee Bucks",
  MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans",
  NYK: "New York Knicks",
  OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic",
  PHI: "Philadelphia 76ers",
  PHO: "Phoenix Suns",
  POR: "Portland Trail Blazers",
  SAC: "Sacramento Kings",
  SAS: "San Antonio Spurs",
  SEA: "Seattle SuperSonics",
  TOR: "Toronto Raptors",
  UTA: "Utah Jazz",
  WAS: "Washington Wizards",
};

export function ImportForm({ leagueId }: { leagueId: string }) {
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportTeamResult[]>([]);

  const teamsToImport = TEAM_NAMES.filter((t) => usernames[t]?.trim());

  async function runImport() {
    if (teamsToImport.length === 0) return;
    setIsRunning(true);
    setResults([]);

    for (let i = 0; i < teamsToImport.length; i++) {
      const team = teamsToImport[i];
      setProgress({ current: i + 1, total: teamsToImport.length });
      const result = await importTeam(leagueId, team, usernames[team]);
      setResults((prev) => [...prev, result]);
    }

    setIsRunning(false);
    setProgress(null);
  }

  return (
    <div className="w-full space-y-4 rounded-md bg-surface p-6 ring-1 ring-line">
      <div>
        <h2 className="font-display text-lg font-medium text-paper">
          Import real teams
        </h2>
        <p className="mt-1 text-xs text-muted">
          Fill in a username for whichever teams you have real accounts
          for — leave the rest blank and come back to them later, nothing
          has to happen all at once. Each team creates the roster and
          contracts from the spreadsheet, matched against players
          already synced in; anyone who doesn&apos;t match gets listed at
          the end instead of silently skipped.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {TEAM_NAMES.map((team) => (
          <div key={team} className="flex items-center gap-2">
            <label
              htmlFor={`u-${team}`}
              className="w-36 shrink-0 truncate text-xs text-muted"
              title={team}
            >
              {TEAM_DISPLAY_NAMES[team] ?? team}
            </label>
            <input
              id={`u-${team}`}
              type="text"
              value={usernames[team] ?? ""}
              onChange={(e) => setUsernames((prev) => ({ ...prev, [team]: e.target.value }))}
              disabled={isRunning}
              placeholder="username"
              className="w-full rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={runImport}
        disabled={isRunning || teamsToImport.length === 0}
        className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning && progress
          ? `Importing… (${progress.current}/${progress.total})`
          : `Import ${teamsToImport.length || ""} team${teamsToImport.length === 1 ? "" : "s"}`.trim()}
      </button>

      {results.length > 0 && (
        <div className="max-h-64 space-y-2 overflow-y-auto rounded-sm bg-ink p-3 text-xs">
          {results.map((r) => (
            <div key={r.team} className={r.ok ? "text-muted" : "text-red-400"}>
              <p>
                {r.ok ? "✓" : "✕"} {r.message}
              </p>
              {r.unmatched.length > 0 && (
                <p className="pl-4 text-[11px] text-muted">
                  Not found: {r.unmatched.join(", ")}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
