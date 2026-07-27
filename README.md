# Dynasty Fantasy Hoops

A from-scratch dynasty fantasy basketball platform: your league, your rules,
your contracts and cap, running on infrastructure you control. Built to
replace sports.ws/fantasy-basketball, including its minutes-pool scoring
format.

This is a **foundation**, not a finished product — see "What's here" and
"Roadmap" below before you start clicking around expecting a full app.

## What's here

- **`prisma/schema.prisma`** — the full data model: leagues, teams,
  players, contracts (the dynasty/cap layer), rosters, games, and matchups.
  Scoring weights and position minute-pools are rows in the database, not
  hardcoded numbers, so your league can tune them from a settings page
  later instead of editing code.
- **`lib/scoring-engine.ts`** — the actual scoring algorithm: fills
  position minute-pools in roster-priority order, prorates each player's
  stats by the fraction of their minutes that got used, and handles
  dual-eligible players spilling from one position pool into another.
  This is the genuinely hard, novel part of "recreating" sports.ws, and
  it's done.
- **`lib/scoring-engine.validate.ts`** — checks the engine against
  sports.ws's own published example (their fantasy primer page). Run
  `npm run validate:scoring` — it passes today, before any dependencies
  are even installed, because it has zero external dependencies.
- **`app/lineup/page.tsx`** — one fully built page, showing a lineup with
  live-computed position meters and per-player scoring. Everything on it
  is real output from the scoring engine running on example data (not a
  static mockup) — swap the example roster for a real database query and
  it keeps working.
- **`lib/stats-provider.ts`** — a balldontlie.io API client (games,
  players, box-score stats). Verified against their published docs; the
  one unverified detail (array-filter query format) is called out in a
  comment at the top of the file.
- **`lib/sync.ts`** — pulls a day's games + box scores from balldontlie
  and upserts them into the database in the shape the scoring engine
  expects.
- **Auth** — `auth.config.ts` (Edge-safe, no database code) and `auth.ts`
  (the full setup, database-backed credentials) together back the login
  page and `middleware.ts`, which protects every route except `/login`
  and the one-time `/setup`. `app/page.tsx` sends the bare root address
  to `/league` if you're signed in, `/login` if not — there wasn't a
  page there at all before, which is a legitimate 404 rather than a
  broken one, but a confusing front door regardless. Credentials-based
  (email/password), no public sign-up — this is a private league, so
  the first account comes from `/setup` (or `npm run db:seed` if you
  have a terminal) and every account after that gets created by the
  commissioner from the "Add team" form, not self-registration.
- **League + team setup** — `/league/new` creates a league (seeding
  default scoring weights and position pools from the same constants the
  scoring engine and demo page use, so there's one source of truth, not
  three copies to keep in sync). `/league/[id]` is the dashboard: team
  list plus a commissioner-only "add team" form that creates the owner's
  account on the spot (with a one-time temp password to relay to them)
  if they don't have one yet.
- **Roster building** — `/league/[id]/team/[teamId]` — search synced
  players by name, add them to a team, reorder priority with ↑/↓, or
  remove them. This priority order is exactly what
  `calculateTeamGameScore` reads to decide fill order, so it's not a
  cosmetic list — it's the actual lineup input. Anyone in the league can
  view any roster; only that team's owner or the commissioner can edit it.
- **Live scoring** — `/league/[id]/team/[teamId]/matchup` — enter a game
  number, get a real score. `lib/matchup-scoring.ts` (pure, zero
  dependencies, has its own validation test) handles the part sports.ws
  doesn't fully spell out: one fantasy "game number" actually bundles
  together each NBA team's own Nth game, which lands on different
  calendar days for different teams. It sums a fresh position-pool fill
  per underlying real game rather than sharing one pool across days —
  documented as an inference in the file, not a confirmed match to the
  real platform. `lib/matchup-scoring-db.ts` fetches real data and feeds
  it in.
- **Contracts &amp; cap** — `/league/[id]/team/[teamId]/contracts` — the
  actual dynasty layer, and the part sports.ws doesn't have at all. Set
  salary/years per rostered player, see committed vs. cap space update
  live, remove a contract. Same owner-or-commissioner permission model as
  the roster page. One simplifying assumption worth knowing: a player
  has at most one *active* contract per team — editing overwrites in
  place rather than keeping history. Fine for now; the fix if that ever
  matters is in a comment in `contracts/actions.ts`.
- **Draft** — `/league/[id]/draft` — the commissioner starts a draft
  (randomized team order, however many rounds), then whoever's on the
  clock (or the commissioner, standing in) searches and drafts a player.
  A pick immediately creates a roster entry too, so drafted players are
  live on the roster — no separate "add to team" step afterward. The
  snake-order logic (`lib/draft.ts`) is pure and validated, same pattern
  as the scoring engine and matchup aggregation. **Now also supports
  sports.ws's actual signature style**: `/league/[id]/draft/queue` lets
  any team rank a list of wanted players whenever's convenient, not just
  while on the clock, and once it's that team's turn, *any* league
  member can click "Auto-pick from queue" to draft their top available
  choice — the point being nobody has to be live-present for their
  stated preferences to count. Manual, live picking (the original
  version) still works exactly the same and takes priority if someone's
  actually there to use it.
- **Trades** — `/league/[id]/trades` — supports any number of teams, not
  just two. Every team involved is its own record (`TradeParticipant`)
  with its own accept/decline response; the trade executes the moment
  everyone's accepted, and a single decline rejects the whole thing
  immediately rather than waiting on anyone else. **Decline & counter**
  rejects the original offer and drops you straight into a new proposal
  with the same teams and same players pre-selected in the same
  directions, so countering is "tweak and resend," not "start from
  scratch." The **propose** page (`trades/new`) has a live cap-impact
  panel — `lib/cap.ts`, pure and validated (2-team and 3-team scenarios,
  plus a conservation check that total salary across all teams can't
  change, only move) — that recalculates every team's projected
  committed salary and cap space as you pick destinations, entirely in
  the browser, before anything is sent. That's the one genuinely
  client-side piece in this app so far (`trade-builder.tsx`, `"use
  client"`) — everything else has been server-rendered forms, but a live
  preview that updates as you click checkboxes isn't something a
  server round-trip can do well. Accepting still moves the roster spot
  *and* the active contract together in one transaction, same as before.
  Players only, not future draft picks — see the comment on the `Trade`
  model for why that's separate work, not an oversight.
- **League settings** — `/league/[id]/settings` — commissioner-only,
  currently scoped to the salary cap: turn it on or off, or change the
  amount. Turning it off doesn't delete anyone's contracts — salaries
  stay on record, they just stop being shown as a hard limit on the
  contracts and trade pages.
- **`/setup`** — creates the very first account without needing a
  terminal or `npm run db:seed`. Only reachable while the database has
  zero users; once one exists, it just points to `/login`. This is what
  makes the whole deployment flow below work without a CLI.
- **Data sync trigger** — `/league/[id]/settings` — the actual missing
  piece that made testing anything else impossible: `lib/sync.ts` has
  existed since early on, but nothing ever called it. Player search,
  drafting, and live scoring all read from tables this fills — without
  running it, they're empty, and every search anywhere in the app
  returns nothing (which looks like a bug and isn't one). Pick a date
  range (14 days max per run, to stay within balldontlie's rate limits)
  and it pulls real games and box scores in. Use dates from the most
  recently completed season for real final data.
- **Schedule &amp; standings** — `/league/[id]/schedule` and
  `/league/[id]/standings`. The commissioner generates a season in one
  shot — `lib/schedule.ts` (pure, validated against a hand-worked
  4-team example) pairs every team round-robin style, repeating the
  cycle for however many game numbers the season needs, with byes
  handled for odd team counts. "Score it" on any matchup runs the same
  `calculateTeamMatchupScore` the per-team matchup page uses, for both
  teams, and saves the result. Standings (`lib/standings.ts`, also pure
  and validated) are computed live from whichever matchups have been
  scored — nothing scores itself automatically, so standings only
  reflect matchups someone's actually clicked "Score it" on.

## What's NOT here yet

Trading future draft picks (only rostered players are tradeable right
now), player profile pages, and most league settings beyond the cap
(scoring weights and position pools are stored per-league and fully
editable in the database already, just no settings-page form for them
yet). See **Roadmap** below.

## A schema correction (round 2)

`Trade` originally had fixed `proposingTeamId`/`receivingTeamId` fields
— fine for exactly two teams, structurally wrong for three or more.
Rebuilt around a `TradeParticipant` join model instead: one row per team
involved, each with its own response, no hardcoded slots. This is the
second time a "works for the 2-team case I built first" shape needed
revisiting once a real requirement (multi-team trades) showed up — see
the note below on the `Game` model for the first time. Worth naming as a
pattern: an early schema shaped around the first concrete example, not
the general case, tends to need this kind of rework eventually — better
to do it now than leave it as a landmine.

## A schema correction (round 1)

The original `Game` model stored one row per real game tagged to a single
team's perspective — which meant a team's away games never counted
toward that team's own sequence, breaking the exact "team's Nth game"
lookup live scoring depends on. Fixed by storing both teams per game and
computing each team's game count at query time (order every game they
appear in, home or away, by date) instead of relying on a stored counter.
Mentioned here because it's a real example of something that looked fine
as a placeholder and needed revisiting once it actually got used — the
kind of thing worth knowing happened, not just the end state.

## A dependency audit note

`npm install` flags 3 high-severity advisories (postcss CSS-parsing
issues, sharp/libvips image-processing CVEs) — checked both against
this app's actual usage, not just the CVE severity label. postcss here
only ever processes this project's own CSS at build time, never
attacker-supplied input; sharp is Next.js's internal `next/image`
dependency, and this app doesn't use `next/image` anywhere yet. Neither
has a real exploitation path as this app is currently built. The
suggested `npm audit fix --force` would downgrade to `next@9.3.3` — six
major versions back, before the App Router or Server Actions existed —
which would break the whole app. Worth a clean, targeted postcss bump
on its own eventually; not urgent, and not `--force`.

## A real bug — found by actually running this

`middleware.ts` re-exported `auth.ts`'s `auth` directly, which pulled
Prisma's database client into Next.js's Edge Runtime — the restricted
environment middleware runs in, which can't execute Prisma's engine.
This silently broke `npm run dev`: the dev server printed "Starting..."
and then just exited, no error message, because it couldn't finish
preparing middleware. Every earlier review of this file said the code
looked right, and by reading it, it did — this specific failure mode
only shows up when the app actually runs, not from reading the source.
Fixed by splitting the config into `auth.config.ts` (no database
code, safe for middleware) and `auth.ts` (the full setup, for
everywhere else — Server Components, Server Actions, API routes, all of
which run in the full Node.js runtime). This is exactly the kind of bug
the "actually get it running" step exists to catch, and it took
catching it — no amount of additional code review would have found this
one.

## Not a bug — a resource limit (and a fix that backfired)

`npm run dev` also died silently at "Starting...", even after the fix
above, with exit code 0 (not a crash) and no memory pressure by the
usual measure (`free -h` showed plenty available). The real cause only
showed up under `npm run build`: `Next.js build worker exited with
code: null and signal: SIGBUS`. That combination — fine general memory,
zero swap configured, a bus error specifically during the build's
heaviest compile step — points at the Codespace's machine tier itself,
not the code.

The first fix attempt was `.devcontainer/devcontainer.json` requiring a
4-core/16GB minimum for any new codespace on this repo. That made
things worse, not better: this account turned out to be capped at the
smallest tier regardless (confirmed separately — "Change machine type"
offered nothing else), so requiring 4-core/16GB meant *zero* available
machine types met the minimum, and codespace creation failed outright
with "no machine types are available." Reverted — the file now sets no
minimum at all. This is moot anyway now that Vercel's own build is what
actually matters (see below); a Codespace here only needs to run `git`
commands, which needs no real compute at all.

## Design direction

The visual identity leans into what this format actually is: a stat sheet.
Dark, ledger-like surfaces; a condensed display face (Oswald) for headers;
tabular monospace figures (IBM Plex Mono) for every stat, so columns of
numbers actually line up; and the three position colors (center/forward/
guard) used consistently as a functional legend everywhere a position
shows up, not as decoration. The position-pool meters on the lineup page
are the signature element — they make the core mechanic (minutes as a
resource you fill) visible at a glance instead of just implying it with a
number.

Swap colors, fonts, and copy freely in `tailwind.config.ts` and
`app/layout.tsx` — this is a starting point for your league's identity,
not a fixed template.

## Data sources

- **NBA stats**: wired up via [balldontlie.io](https://www.balldontlie.io)
  (`lib/stats-provider.ts` + `lib/sync.ts`) — a simple REST API with a free
  tier, and a natural fit for a TypeScript/Next.js stack (no second
  language needed). `nba_api` (Python, wraps stats.nba.com) is a
  well-regarded alternative with deeper data if you ever want a small
  Python sync service instead.
- **Contracts**: intentionally NOT scraped from Spotrac. Spotrac's terms
  of service prohibit automated data collection. Contract data changes
  rarely, so `Contract` rows are meant to be entered by the commissioner
  through the app — a "type in the update" admin flow, not a scraper.

## Getting this running — no terminal needed

Written for devices where installing software isn't an option — a
Chromebook, or a locked-down work laptop without admin rights — so every
step below happens in a browser tab, nothing installed locally. (If you
ever do have a machine where you can install things freely, the short
version is at the very end.)

### 1. Create a database (~2 min)

[neon.tech](https://neon.tech) → sign up free → create a project → copy
the connection string it shows you (starts with `postgresql://`).
Save it somewhere; you'll paste it in twice below.

### 2. Get an NBA stats key (~1 min)

[app.balldontlie.io](https://app.balldontlie.io) → sign up free → copy
your API key from account settings.

### 3. Your auth secret

This just signs login cookies — not a password, doesn't need to be
memorable, just needs to be random and secret, which this already is.
Use this exact value, generated for this project:

```
iAIzJBNPUyyydqBJcX/GgAn4z6h0yyiSWoBih+woILA=
```

### 4. Get the code running — GitHub Codespaces

This is the actual "does it work" moment, and it happens on
[github.com](https://github.com), not on your Chromebook's filesystem.

1. Create a free GitHub account if you don't have one.
2. [github.com/new](https://github.com/new) → create a new repository
   — this time **check "Add a README file"** during creation. (GitHub
   can't create a Codespace on a completely empty repo with zero
   commits — it needs at least one file to have something to build
   from. Name the repo whatever you like.)
3. On the new repo's page: **Code** button → **Codespaces** tab →
   **Create codespace on main**. This opens a full VS Code environment
   in a browser tab — genuinely works well on a Chromebook. If that
   button isn't showing up cleanly, skip the hunt: go to
   [github.com/codespaces](https://github.com/codespaces) directly,
   click **New codespace**, and pick your repo and `main` from the
   dropdowns there instead — same result either way.
4. Once it loads, drag `dynasty-fantasy-hoops.zip` (from this chat)
   into the file explorer panel on the left.
5. Open the terminal — a text box for typing instructions instead of
   clicking, usually a dark panel along the bottom of the screen (no
   terminal visible? **Terminal** menu at the top → **New Terminal**).
   Click into it, then paste or type each line below one at a time,
   pressing **Enter** after each and waiting for it to finish before
   moving to the next:
   ```bash
   unzip -o dynasty-fantasy-hoops.zip
   rm dynasty-fantasy-hoops.zip
   npm install
   ```
   What these actually do: the first unpacks the zip you dragged in
   into the real project files — you'll see folders like `app` and
   `lib` appear in the file list on the left once it's done. The second
   deletes that now-empty zip, since it's not needed anymore. The third
   downloads everything the project depends on to run — the slow one (a
   minute or two), with a wall of scrolling text the whole time, which
   is normal, not an error. Done means the scrolling stops and you get
   a plain line back, ready for the next command. It'll likely end with
   a note about some number of vulnerabilities and a suggested
   `npm audit fix --force` — that's standard for basically any real JS
   project and not a sign of a problem; skip running that command for
   now, since the `--force` part can swap in newer, untested versions
   of things this project depends on.
6. Create a new file named exactly `.env`. In the file explorer panel
   on the left (the one now showing `app`, `lib`, `prisma`, and the
   rest), look along the top of that panel for a short row of small
   icons — one looks like a blank page with a `+`, and hovering over it
   should say "New File." Click it, a small text box opens right in the
   file list, type `.env` (the leading dot matters) and press **Enter**.

   Don't see those icons, or clicking doesn't do anything? Right-click
   any empty space in that file list instead (on a trackpad, that's
   often a two-finger tap, or a press-and-hold) and pick **New File**
   from the menu that appears — same result either way.

   Either method should open the new, empty file in the main editing
   area automatically. Click into that empty space and paste in your
   own values from steps 1–3:
   ```
   DATABASE_URL="paste your neon connection string here"
   AUTH_SECRET="iAIzJBNPUyyydqBJcX/GgAn4z6h0yyiSWoBih+woILA="
   BALLDONTLIE_API_KEY="paste your balldontlie key here"
   ```
   Then save it: **Ctrl+S** (**Cmd+S** on a Mac). The file's tab shows a
   small dot instead of a close-✕ while there are unsaved changes —
   once you save, that dot turns back into the ✕, which is how you can
   tell it actually saved.
7. Same terminal, same one-line-at-a-time approach as before:
   ```bash
   npm run db:push
   npm run dev
   ```
   The first sends the project's data structure (leagues, teams,
   players, and so on) to the empty database from step 1 — think of it
   as setting up all the filing cabinets before anything gets filed.
   Takes a few seconds. The second actually starts the website running.
   Unlike the earlier commands, this one doesn't finish and hand back a
   plain line — it keeps running (that's correct, it's the live
   server). It'll print a startup banner mentioning `localhost:3000`
   almost immediately, then "✓ Starting..." — neither of those means
   it's actually ready yet. Wait for a separate, later line like "✓
   Ready in [some number] ms" — on a fresh container this first compile
   can genuinely take 20–30 seconds, sometimes more. Don't type
   anything else or press Ctrl+C while you wait; that line showing up
   is the real signal.

   **If it never reaches "Ready," and instead the prompt just returns
   on its own with nothing else printed:** some GitHub accounts default
   to a small Codespace machine tier that can be genuinely too little
   for a first Next.js build/compile — this shows up as a `SIGBUS` error
   if you try `npm run build` directly. If a bigger machine isn't
   offered under **github.com/codespaces** → **"..."** → **Change
   machine type**, don't chase this further here — skip straight to
   step 10. This step was only ever a "preview before deploying" nice-
   to-have, not a requirement: the build that actually matters runs on
   Vercel's own, separate infrastructure in the next section, and isn't
   limited by whatever this Codespace's machine size is.
8. If step 7 did reach "Ready": a notification should pop up in the
   bottom right offering to open the forwarded port — click it (or
   click the **Ports** tab, and click the globe/link icon next to port
   3000). Either opens a new browser tab with the actual site in it —
   you should land on the login page. **This is the first time any of
   this has actually executed — everything before now was reviewed,
   not run.** Go to that tab's `/setup` path (add `/setup` to the end
   of the address bar URL) and create your account — this writes to
   the real Neon database from step 1, so it carries over once deployed
   for real, no need to do it twice. If step 7 never got this far,
   that's fine too — do this same `/setup` step on the live Vercel URL
   instead, once you reach the end of the next section.
9. Save the code to GitHub permanently — even if step 7 never fully
   worked in this Codespace. That's fine: this step doesn't build or
   run anything, just uploads files, and the build that actually
   matters happens on Vercel's own, separate infrastructure in the next
   section. Back in the terminal — press **Ctrl+C** first if `npm run
   dev` is still running and occupying that line — then run these one
   at a time:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push
   ```
   In order: the first marks every file as ready to save, the second
   actually saves that snapshot with a short label, and the third
   uploads it to GitHub for real — that's the version Vercel will
   build from in the next section.

If anything errors in step 7 or 8, copy the exact error text back to me
— that's precisely the kind of real bug this whole process exists to
surface, and I can fix it directly.

### 5. Deploy it for real

1. [vercel.com](https://vercel.com) → sign up free (use **Continue with
   GitHub** so the two accounts are linked).
2. **Add New** → **Project** → import the repo you just pushed to.
3. Before deploying, add the same three environment variables
   (`DATABASE_URL`, `AUTH_SECRET`, `BALLDONTLIE_API_KEY`) under
   **Environment Variables** — same values as your `.env` in Codespaces.
4. Deploy. The build runs `prisma db push` automatically now (see
   `package.json`), so there's no separate manual step — Vercel's build
   log will show it happening.
5. Vercel gives you a live URL. If you already created your account at
   `/setup` back in the Codespace, log in there now — same database,
   same account, nothing new to create. If that step never worked in
   the Codespace, do it now instead: visit that same live URL's
   `/setup` path and create your account there — same result either
   way, just a different place to have done it.

From here, every `git push` to this repo redeploys automatically.

## Updating the site from here on

Codespaces was only ever needed for one specific thing above: running
`db:push` that one time to connect the database. That already happened.
Every update after the initial setup can skip Codespaces, terminals, and
`unzip` entirely — this is the actual recommended way to update the
site going forward, not a one-time workaround:

1. Download the updated project zip.
2. Open the **Files app** → find the zip in Downloads → right-click →
   **Extract all**. Creates a plain folder, no terminal needed.
3. On your GitHub repo's page: **Add file** → **Upload files**.
4. Open the extracted folder, select everything *inside* it (not the
   folder itself), and drag that selection onto GitHub's upload area —
   it preserves the folder structure and shows exactly what's about to
   be uploaded before anything is committed.
5. Scroll down, add a short commit message, click **Commit changes**.
6. Vercel redeploys automatically, same as it always has.

One limit worth knowing: GitHub's web uploader tops out around 100
files per upload. This project is comfortably under that for now; if it
ever grows past it, uploading in a couple of batches (e.g. `app/` and
`lib/` separately from everything else) works fine — ask if that comes
up and it's worth walking through concretely at that point.

### If you ever get a terminal

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL, AUTH_SECRET, BALLDONTLIE_API_KEY
npm run db:push
npm run db:seed              # creates a commissioner login from COMMISSIONER_EMAIL/PASSWORD env vars
npm run validate:scoring     # optional — and validate:matchup / validate:draft / validate:cap / validate:schedule / validate:standings
npm run dev
```

## Roadmap

1. ✅ **Foundation** — data model, scoring engine, validated against
   sports.ws's own example, initial design direction.
2. ✅ **Data sync + auth** — balldontlie client, a sync function that
   loads real games/box scores into the database, credentials login,
   every route protected except `/login`.
3. ✅ **League + team setup** — create a league, add teams and owners
   (with account creation) through the UI.
4. ✅ **Roster building** — assign players to a team and set priority
   order through the UI, reading from real synced players.
5. ✅ **Live scoring** — enter a game number, get a real score computed
   from actual synced games and box scores, not example data.
6. ✅ **Dynasty layer** — contract entry, cap tracking, all live and
   reading/writing real data.
7. ✅ **Draft** — live snake draft, commissioner starts it, whoever's on
   the clock picks, drafted players land straight on the roster.
8. ✅ **Trades** — any number of teams, per-participant accept/decline,
   decline-and-counter, a live cap-impact preview while building an
   offer, contracts moving with their players automatically once
   everyone accepts.
9. ✅ **League settings (cap)** — commissioner can turn the salary cap on
   or off, or change the amount.
10. ✅ **Schedule &amp; standings** — round-robin season generation, w-l-t
    records, points for/against.
11. ✅ **Slow/queue drafts** — sports.ws's actual signature draft style:
    rank a queue whenever's convenient, anyone can auto-pick from it
    once it's that team's turn. Live picking still works too.
12. **Player profile pages &amp; news feed** — the actual next step, and
    now the last real feature gap. Sports.ws has real content here;
    nothing exists for it yet.
13. **Further polish** — settings for scoring/position pools (the data
    already supports it, just needs a form), tradeable future draft
    picks, your league's branding.

~~WNBA support~~ and ~~Legends mode~~ (historical-season replay) were on
this list earlier — dropped on request, not forgotten. If that changes
later, they're still buildable, just not planned for right now.

At this point the core feature set matches (and in the contracts/cap and
multi-team-trade cases, exceeds) what sports.ws offers. What's left is
genuinely "multi-session engineering work across many files" — the kind
of project that benefits from a real dev loop (install packages, run the
server, see it break, fix it) rather than one chat response at a time.
Whatever environment ends up running that loop, this repo is the
starting point either way.
