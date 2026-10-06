# re:Invent 2026 Planner

A personal planner for AWS re:Invent 2026 (Las Vegas, Nov 30 – Dec 4) that runs entirely in your browser. Describe what you care about, and the app ranks all ~2,100 catalog sessions against that profile and explains each match. It then auto-builds a clash-free agenda that accounts for your availability, lunch, personal blocks and travel time between venues, and it prefers formats that aren't recorded. Browse in a table, a per-venue timeline, a week calendar or a map. You also get a scarcity-ordered reservation checklist, `.ics` export, and alerts when a catalog refresh changes a session you planned around. All times are Las Vegas local.

See [SPEC.md](SPEC.md) for the full feature set.

## Quick start

```sh
npm install
npm run dev        # http://localhost:5173
```

The app works straight after cloning: it loads the committed catalog snapshot `public/catalog.sqlite3`, so it needs no network fetch.

## Refreshing the catalog

```sh
npm run refresh-data                                   # fetch the latest catalog
npm run refresh-data -- --force                        # fetch even if the etag is unchanged
npm run refresh-data -- --from-file catalog.json       # build from a downloaded file (optional --etag <etag>)
```

- The fetch sends `If-None-Match` with the snapshot's stored etag. If the server answers `304`, it prints `Not modified` and leaves the snapshot alone.
- On success it rewrites `public/catalog.sqlite3` and prints a summary: session, slot and TBA counts, the fetch time and etag, then the added, removed and changed slots (up to 30 codes each).
- The source is a one-person community site, so refresh rarely.

After a refresh, reload the app. The bell in the header lists agenda sessions that moved, were cancelled or were removed, and starred TBA sessions that now have a time.

## Creating a profile

A profile is a JSON file with weighted interests and keywords, topic and service weights, a level range, format preferences, an avoid list and your availability. See `examples/profile.example.json` and the schema in `src/core/profile/schema.ts`. You can create one in either of two ways:

- **Claude Code:** in this repo, describe what you want from re:Invent. The `profile-builder` skill (`.claude/skills/profile-builder/`) reads the catalog vocabulary, writes `profiles/<name>.json` (git-ignored) and validates it.
- **Any Claude chat:** click **Profile → Copy prompt** in the app. The copied prompt includes the schema and the catalog's real topics and services. Paste it into Claude along with your description and save the JSON it returns.

Validate a profile and preview its top matches:

```sh
npx tsx scripts/validate-profile.ts profiles/me.json --top 15
```

Exit code 0 means valid, 1 means schema errors (each one names its field path) and 3 means warnings (unknown vocabulary, or keywords that match no session). `npx tsx scripts/vocabulary.ts` prints the vocabulary. Import the file in the app's Profile view, where you can also tweak the profile and export it again.

## Where your data lives

Your profile, agenda, stars, reservation statuses, personal blocks and settings live in a SQLite database in the browser's Origin Private File System (OPFS). They survive reloads but stay in that one browser profile. To back them up or move them, use **My Agenda → State → Export state JSON** and **Import state JSON…**.

**Keynotes:** keynotes aren't in the catalog. The app ships presets for them with no times. Look up the times on the official agenda, enter them under **My Agenda → Blocks**, then switch each one on. Auto-build ignores a keynote until it has a confirmed time and is enabled.

## Tests and checks

```sh
npm test           # vitest: ranking, auto-build, conflicts, checklist, changes, ics, state, profile
npm run lint       # oxlint
npm run build      # tsc -b && vite build
```

## Architecture

```
UI (React, src/ui)
  └─ Comlink ──▶ Web Worker (src/worker/planner.worker.ts)
                   └─ Planner core (src/core/planner.ts: ranking, auto-build, conflicts, checklist, ics, changes)
                        ├─ Catalog Repository  (read-only, public/catalog.sqlite3)
                        └─ User Store          (profile, agenda, settings; OPFS)
                             └─ SQLite-wasm (@sqlite.org/sqlite-wasm)
```

- `src/core` is plain TypeScript with no DOM. The worker, the CLI scripts and the tests all use it. The scripts and tests swap in `MemoryUserStore`.
- `src/core/pipeline` turns the raw catalog JSON into the snapshot DB. It groups repeats (`-R`, `-R1`, …) into one session with several slots.
- `scripts/` holds the Node CLIs: `refresh-data.ts`, `validate-profile.ts` and `vocabulary.ts`.
- The UI uses shadcn/ui components (`src/components/ui`), Tailwind v4, TanStack Table and react-leaflet.

## Deploying (GitHub Pages)

Every push to `main` runs `.github/workflows/deploy.yml`: typecheck, tests, then `vite build` with `BASE_PATH=/<repo>/` and a Pages deploy. To publish a fresh catalog, run `npm run refresh-data`, commit `public/catalog.sqlite3`, and push. Each visitor's profile, agenda and scores stay in their own browser.
