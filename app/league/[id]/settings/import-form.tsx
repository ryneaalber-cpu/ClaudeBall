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

// Pre-filled from the real username list already collected — anyone not
// registered yet just imports unclaimed instead of blocking the batch;
// see claimTeam on the dashboard for attaching them once they are.
const KNOWN_USERNAMES: Record<string, string> = {
  ATL: "MamaBearNoMilk",
  BOS: "simon741",
  BKN: "DaKid",
  CHA: "aceing",
  CHI: "vlad3",
  CLE: "Celine75",
  DAL: "DALLASBob",
  DEN: "AlexDenver",
  DET: "clemfandango",
  GSW: "GunnerHM",
  HOU: "Stripesteezy",
  IND: "Haliburner777",
  LAL: "sammyg123",
  MEM: "ScottKD",
  MIA: "Prodigy_Mayd",
  MIL: "TriggsB",
  MIN: "phatbobby",
  NOP: "Manchu504",
  NYK: "mazmaz",
  OKC: "doyouknowjack",
  ORL: "RyneA",
  PHI: "robalber",
  PHO: "edoardo_gandino",
  POR: "sadmcbain",
  SAC: "Chi_city",
  SAS: "Dagabs",
  SEA: "Sceddy",
  TOR: "noflyzone35",
  UTA: "oddi",
  WAS: "cameronmunn18",
};

export function ImportForm({ leagueId }: { leagueId: string }) {
  const [usernames, setUsernames] = useState<Record<string, string>>(KNOWN_USERNAMES);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [results, setResults] = useState<ImportTeamResult[]>([]);

  async function runImport() {
    setIsRunning(true);
    setResults([]);

    // Every team gets imported, whether or not a username is filled in —
    // a blank or not-yet-registered username just leaves that team
    // unclaimed rather than blocking the rest of the batch.
    for (let i = 0; i < TEAM_NAMES.length; i++) {
      const team = TEAM_NAMES[i];
      setProgress({ current: i + 1, total: TEAM_NAMES.length });
      const result = await importTeam(leagueId, team, usernames[team] ?? "");
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
          Pre-filled with the usernames already collected — edit or clear
          any of them first if something&apos;s changed. One click imports
          all 30: real roster and contracts for every team either way,
          matched against players already synced in — and for anyone not
          in that data yet (a 2026 rookie who hasn&apos;t played an NBA
          game, mainly), looked up live and added on the spot instead of
          just being skipped. Anyone whose username isn&apos;t registered
          yet just imports unclaimed instead of blocking the rest —
          attach the real owner later from the league dashboard once
          they&apos;ve registered.
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
              placeholder="username (optional)"
              className="w-full rounded-sm border border-line bg-ink px-2 py-1 text-xs text-paper outline-none focus:border-pos-forward disabled:opacity-50"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={runImport}
        disabled={isRunning}
        className="rounded-sm bg-pos-forward px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isRunning && progress
          ? `Importing… (${progress.current}/${progress.total})`
          : "Import all 30 teams"}
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
