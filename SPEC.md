# Spec: re:Invent 2026 Smart Planner — Phase 1 (local)

> Status: `ready-for-agent` · Tracker: none yet — move to a GitHub issue once the repo exists.

## Problem Statement

re:Invent 2026 (Las Vegas, Mon Nov 30 – Fri Dec 4) has 2,112 catalog sessions spread over five venues that are up to 30 minutes apart. Most rooms are small (median 96 seats), reservations are competitive, and the schedule keeps changing until the event starts. The official catalog and the community planner let me browse and filter, but they don't understand what I actually care about. They can't turn my interests into a realistic agenda that has no clashes and accounts for walking between venues. They can't tell me what to reserve first, and they can't warn me when a session I planned around moves. Today I'd do all of that by hand: scrolling thousands of cards, cross-checking times, and guessing at travel.

## Solution

A personal planner web app that runs entirely in my browser on my machine. I describe my interests in plain English to Claude Code, which turns them into a structured, editable **profile**. The app ranks every session against that profile and explains why each one matches. It then **auto-builds** a clash-free agenda: it respects my availability, lunch, personal blocks (keynotes, meetings), travel time between venues, and my preference for formats that aren't recorded. It also uses repeat slots to fit more in. I edit the result with live conflict checks. I browse in a table, a per-venue timeline, a calendar of my agenda, and a map of the Strip. Before reservations open I get a scarcity-ordered **reservation checklist**, and I track whether each reservation succeeded. I export my agenda to my calendar. When I refresh the catalog, the app tells me what changed in my plan.

## User Stories

### Catalog data
1. As a planner user, I want to refresh the session catalog with a single command, so that my data reflects the latest published schedule.
2. As a planner user, I want the refresh to tell me how many sessions were added, removed, and changed, so that I know whether anything significant happened.
3. As a planner user, I want the app to work immediately after cloning, using the committed catalog snapshot, so that I don't need a network fetch to start.
4. As a planner user, I want repeated sessions (e.g. a session and its `-R`/`-R1` repeats) grouped as one session with several time slots, so that I see each piece of content once and can choose the slot that fits.
5. As a planner user, I want sessions that don't have a time yet shown with a "TBA" badge, so that I can still find and star them.
6. As a planner user, I want to see when the catalog was last refreshed, so that I know how stale my data is.
7. As a planner user, I want all times shown in Las Vegas local time regardless of my laptop's time zone, so that times match the venue signage and the official portal.

### Profile
8. As a planner user, I want to describe my interests in plain English to Claude Code and get a profile file back, so that I don't have to tick dozens of filters by hand.
9. As a planner user, I want the generated profile to use the catalog's real topic and service vocabulary, so that tag matching actually hits.
10. As a planner user, I want each interest in my profile to carry a weight and a list of expanded keywords/synonyms, so that ranking catches sessions that use different wording.
11. As a planner user, I want a "copy prompt" button that builds a ready-to-paste prompt containing the catalog vocabulary and the profile schema, so that I can generate a profile in any Claude chat without Claude Code.
12. As a planner user, I want to import a profile JSON file into the app, so that it becomes my active profile.
13. As a planner user, I want a clear error when an imported profile is invalid, naming the field that's wrong, so that I can fix it quickly.
14. As a planner user, I want to tweak my profile in the UI (interest weights, topic/service weights, level range, format preferences, avoid list), so that small adjustments don't need a chat round-trip.
15. As a planner user, I want to export my current profile back to JSON, so that I can keep it, version it, or regenerate it with Claude Code.
16. As a planner user, I want my original plain-English description kept inside the profile, so that I and Claude Code can see what the profile was derived from.
17. As a planner user, I want to set my availability (days attending, earliest start and latest end per day, lunch window, max sessions per day), so that the agenda fits my real schedule.
18. As a planner user, I want an avoid list (keywords, topics, services), so that sessions I explicitly don't want are excluded from ranking.
19. As a planner user, I want swapping or regenerating my profile to leave my agenda intact, so that I don't lose my plan.
20. As a planner user, I want my profile and agenda to persist across browser reloads, so that I don't lose work.

### Ranking & browsing
21. As a planner user, I want every session scored against my profile, so that the most relevant sessions surface first.
22. As a planner user, I want a short "why this matches" for each ranked session (matched interests, keywords, tags, level fit, format), so that I trust and understand the ranking.
23. As a planner user, I want to tune the ranking weights (text relevance, tag match, level fit, format preference) in settings, so that I can correct the ranking if it feels off.
24. As a planner user, I want to filter by day, time range, venue, type, level, topic, service, role, industry, and features, so that I can narrow the list.
25. As a planner user, I want free-text search over titles, abstracts, speakers, and tags, so that I can find a specific session or speaker.
26. As a planner user, I want to filter to "starred only", "on my agenda", "TBA only", and "hide sessions that conflict with my agenda", so that I can focus.
27. As a planner user, I want to sort the table by score, time, level, venue, and seat capacity, so that I can scan the list in the order I need.
28. As a planner user, I want to star a session, so that I mark interest without committing to a slot.
29. As a planner user, I want to open a session detail drawer with the full abstract, speakers, tags, all slots, and the match explanation, so that I can decide without leaving the view.
30. As a planner user, I want each slot in the detail drawer to show whether it fits my agenda (free / conflict / travel too tight), so that I can choose the best slot at a glance.

### Agenda & auto-build
31. As a planner user, I want to add a specific slot of a session to my agenda, so that I build my plan by hand when I want to.
32. As a planner user, I want to pin an agenda item, so that auto-build never moves or removes it.
33. As a planner user, I want auto-build to fill my agenda using pinned sessions first, then starred ones, then top-ranked ones, so that my explicit choices always win.
34. As a planner user, I want auto-built additions marked "suggested", so that I can tell them apart from my own picks.
35. As a planner user, I want re-running auto-build to keep pinned items, allow starred items to move between their own slots, and replace suggested items, so that I can iterate without losing decisions.
36. As a planner user, I want auto-build to use repeat slots to resolve clashes, so that more of my top sessions fit.
37. As a planner user, I want auto-build to respect travel time between venues, so that I never get a plan with a venue hop I can't make.
38. As a planner user, I want auto-build to respect my availability, lunch window, and max sessions per day, so that the plan is humane.
39. As a planner user, I want auto-build to prefer formats that aren't recorded (chalk talks, workshops, builders' sessions, code talks) over recorded ones, so that I spend my time on what I can't watch later.
40. As a planner user, I want auto-build to skip TBA sessions, so that it only schedules what has a time.
41. As a planner user, I want auto-build to tell me which starred sessions it couldn't fit and why, so that I can make the trade-off myself.
42. As a planner user, I want live conflict warnings when I edit my agenda (overlap, travel too tight, outside availability, over daily max), so that I catch problems immediately.
43. As a planner user, I want each conflict to offer alternatives (another slot of the same session, or the next-best session in that time window), so that I can resolve it in one click.
44. As a planner user, I want to add personal blocks (meetings, expo hall, parties) with a time and an optional venue, so that the planner schedules around them.
45. As a planner user, I want preset keynote blocks that I can toggle on and edit, so that keynotes (missing from the catalog) are accounted for.
46. As a planner user, I want to edit the venue-to-venue travel-time table, so that it matches what I experience on day 1.
47. As a planner user, I want to remove an item from my agenda, so that I can change my mind.

### Views
48. As a planner user, I want a table view of all sessions with ranking, filters, and sorting, so that I can browse efficiently.
49. As a planner user, I want a timeline view for each day with one lane per venue, so that I can see what's happening where at the same time.
50. As a planner user, I want my agenda items highlighted in the timeline, so that I can spot gaps and alternatives around them.
51. As a planner user, I want a "My Agenda" calendar view for the week, so that I see my plan as a schedule.
52. As a planner user, I want personal blocks and travel gaps visible in My Agenda, so that the plan looks like my real day.
53. As a planner user, I want a map of the Strip with the five venues pinned, so that I understand the geography.
54. As a planner user, I want the map to show how many relevant sessions are on at each venue at a chosen time, so that I can pick where to go when I have a free slot.
55. As a planner user, I want the map to draw my route for a chosen day in agenda order, so that I can see how much walking I've signed up for.
56. As a planner user, I want to switch between dark and light mode, defaulting to my system setting, so that the app is comfortable in any lighting.
57. As a planner user, I want my theme choice remembered, so that I don't have to reset it.

### Reservations & outputs
58. As a planner user, I want a reservation checklist of my agenda ordered by priority and scarcity (small rooms, single-slot, hands-on first), so that I reserve the hardest-to-get sessions before they fill.
59. As a planner user, I want the checklist to show each session's code, slot, venue, and seat capacity, so that I can search for it fast in the official portal.
60. As a planner user, I want to mark each checklist item as reserved, waitlisted, failed, or walk-up, so that I track reservation-day progress.
61. As a planner user, I want a failed reservation to suggest alternatives (another slot of the same session, or the next-best session in that window), so that I can recover immediately.
62. As a planner user, I want to export my agenda as an `.ics` file, so that it shows in my calendar.
63. As a planner user, I want the exported events to include the session code, title, venue, room, and abstract, so that my calendar is self-contained.
64. As a planner user, I want to choose whether personal blocks are included in the `.ics` export, so that I don't duplicate events already in my calendar.
65. As a planner user, I want to export and import my whole planner state (profile and agenda) as JSON, so that I can back it up or move it to another browser.

### Change alerts
66. As a planner user, I want to be alerted after a catalog refresh when a slot on my agenda moved (time, venue, or room), so that I don't show up at the wrong place.
67. As a planner user, I want to be alerted when a slot or session on my agenda was cancelled, so that I can replace it.
68. As a planner user, I want to be alerted when a change creates a new conflict in my agenda, so that I can re-plan.
69. As a planner user, I want to be alerted when a starred TBA session gets a time, so that I can schedule it.
70. As a planner user, I want each alert to offer "accept change", "find alternative", or "re-run auto-build", so that I resolve it in one step.
71. As a planner user, I want to dismiss an alert after I've handled it, so that the list stays clean.

## Implementation Decisions

### Architecture
- Fully static web app: Vite + React + TypeScript, TanStack Table, Tailwind + shadcn/ui. There's no runtime server in Phase 1, so Phase 2 hosting is a static deploy.
- All data querying runs in the browser on SQLite-wasm (official build) with FTS5. DuckDB-wasm was considered and rejected: its analytics strength doesn't matter at about 2k rows, and its bundle is larger.
- No LLM calls inside the app. Profile generation happens in Claude Code (a project skill) or any Claude chat (via the copy-prompt button).
- No embeddings in v1. Semantic reach comes from Claude-expanded keywords on each interest, plus tag matching. The data model leaves room to add embeddings later without schema changes to sessions and slots.
- One user, everything on the device, no accounts.

### Modules
1. **Catalog Pipeline**
   - Core: a pure function that takes the raw catalog JSON and produces the bytes of a catalog SQLite DB. It runs identically in Node and the browser.
   - Thin command-line wrapper (`refresh-data`): fetches the source endpoint, records its `etag` and the fetch time, runs the core, writes the committed catalog DB snapshot, and prints an added/removed/changed summary against the previous snapshot.
   - The source is `https://reinvent-planner.cloud/api/aws/reinvent/2026/catalog`. It sends no CORS headers, so it must never be fetched from the browser.
2. **Catalog Repository**
   - Read-only queries over the catalog DB: sessions, slots, speakers, tags, full-text search, the tag vocabulary, and metadata.
   - The catalog DB is loaded into memory and replaced wholesale on refresh.
3. **User Store**
   - Persists the active profile, agenda items, personal blocks, travel-time table, settings (ranking weights, theme, format-recording map), reservation statuses, slot fingerprints, and dismissed alerts.
   - Two implementations behind one interface: in-memory (for tests) and a persistent SQLite DB in the browser's private file storage (OPFS) using the `opfs-sahpool` mode. That mode needs no cross-origin isolation headers, which keeps Phase 2 hosting simple.
4. **Profile Schema**
   - A versioned profile schema with validation, shared by import, the copy-prompt generator, and the Claude Code skill.
   - Validation errors name the offending field path.
5. **Planner core**: the single deep module the UI talks to. It's opened with a Catalog Repository and a User Store, and exposes:
   - `importProfile` / `exportProfile` / `updateProfile`
   - `rank(filters)`: scored sessions, each with a match explanation
   - `autoBuild()`: a new agenda plus the list of starred sessions it couldn't place, with reasons
   - `conflicts()`: per-item conflicts with alternatives
   - `alternatives(slot or session)`
   - `detectChanges()`: alerts produced by comparing the stored slot fingerprints against the loaded catalog
   - `reservationChecklist()`
   - `setReservationStatus`
   - `exportIcs(options)`
   - `exportState` / `importState`
   - agenda mutations: add slot, remove, pin/unpin, star/unstar, personal block create/update/delete, travel-table edits
6. **Profile Builder skill** (Claude Code project skill)
   - Reads the catalog vocabulary from the catalog DB.
   - Turns my description into a profile that validates against the Profile Schema.
   - Writes it to a git-ignored profiles folder.
7. **Copy-prompt generator**: builds a self-contained prompt with the schema, the vocabulary, and instructions.
8. **UI**: table, timeline, My Agenda, map, session detail drawer, profile editor, settings, reservation checklist, alerts panel, theme toggle. It's a thin layer over the Planner core, with no business logic in components.

### Catalog DB schema (conceptual)
- **session**: one row per piece of content, holding the grouping key, title, abstract, level (numeric), type, the recorded flag derived from type, and the tags through join tables.
- **slot**: one row per scheduled occurrence. It holds the original catalog id and short code, start/end in UTC, day, venue, room (nullable), seat capacity, the source `hash`, and `lastModified`.
- A TBA session has no slots, or a slot with null times.
- **speaker** and **session_speaker**.
- **tag** (kind: topic | service | areaOfInterest | role | industry | feature) and **session_tag**.
- **FTS5 index** over title, abstract, speaker names and companies, and tag names.
- **meta**: source URL, fetched-at time, source etag, session/slot counts.

### Data rules
- **Repeat grouping.** Catalog entries linked through `repeats` form one session; grouping uses connected components, so links are followed even when not every entry lists every repeat. When an entry has no `repeats`, the base short code (with any `-R` / `-R<n>` suffix stripped) is the fallback grouping key.
- **Times.** Stored in UTC. Displayed in America/Los_Angeles.
- **Slot fingerprint.** Start, end, venue, room, and whether the slot still exists. It's stored with each agenda item when the item is added, and compared again after each refresh.
- **Recorded formats.** A configurable type → recorded map. Default: Breakout sessions are recorded. Chalk talks, workshops, builders' sessions, code talks, labs, bootcamps, and gamified learning are not. Lightning talks default to recorded and are editable.

### Ranking
- The score is a weighted sum of:
  - full-text relevance (bm25) of each interest's keywords, multiplied by that interest's weight
  - topic and service tag matches, multiplied by their profile weights
  - level fit (full credit inside the profile's level range, a penalty outside it)
  - format preference
- The avoid list excludes matching sessions by default. A filter toggle shows them.
- The weights have defaults and can be edited in settings.
- Every score comes with a structured explanation: matched interests and keywords, matched tags, level fit, and format.

### Auto-build
Greedy, deterministic, and explainable:
1. **Candidate pool, in order:** pinned items (fixed slot) → starred sessions (any of their slots) → top-ranked sessions (marked suggested).
2. **Place each candidate** in its best feasible slot. A slot is feasible when it:
   - doesn't overlap a placed item or personal block
   - leaves enough travel time from the previous item's venue and to the next item's venue, using the travel table
   - is inside my availability and outside lunch
   - stays under my daily maximum

   Among feasible slots, prefer the one with the least added travel.
3. **Swap pass:** for each unplaced starred session, try moving already-placed non-pinned items to their alternative slots to free room.
4. **Report** the starred sessions that remain unplaced, with the blocking reason.

On re-run, pinned items stay, starred items may move between their own slots, and suggested items are replaced. An optimal solver (an ILP via HiGHS-wasm) was considered and rejected: the greedy result is easier to predict and explain.

### Travel table
- A symmetric table of minutes between each pair of the five venues: Venetian, Wynn/Encore, Caesars Forum, Caesars Palace, MGM Grand.
- The defaults are estimates (e.g. Venetian↔Wynn about 10 minutes, anything↔MGM about 30), editable in settings.
- Same venue means zero travel time.

### Reservation checklist
- Agenda items ordered by priority × scarcity.
- Scarcity rises with smaller seat capacity, fewer available slots, and hands-on formats.
- Item statuses: none | reserved | waitlisted | failed | walk-up.
- `failed` surfaces alternatives.

### Change detection
- Runs after the catalog DB loads.
- **Alert kinds:**
  - slot moved (time, venue, or room)
  - slot cancelled
  - session removed
  - new conflict caused by a change
  - starred TBA session now scheduled
- **Actions:** accept the change (re-fingerprints the item), find an alternative, or re-run auto-build.
- Alerts can be dismissed.

### ICS export
- One event per agenda item, stored in UTC.
- Summary is code + title; location is venue + room; description is the abstract plus a session link.
- Personal blocks are included only if I opt in.

### Map
- Leaflet with OpenStreetMap tiles and hardcoded venue coordinates.
- Shows, for a chosen time, how many relevant sessions are on at each venue.
- Draws my route for a chosen day in agenda order.
- Needs a connection in Phase 1.

### Theme
- Light/dark toggle. Defaults to the system preference, and the choice is persisted in User Store settings.

### Repo
- A git repository with a single Vite project at the root.
- The pipeline script lives alongside the app source.
- The catalog DB snapshot is committed.
- The profiles folder is git-ignored.
- The Claude Code profile skill lives in the project's Claude skills folder.

## Testing Decisions

- **One test seam: the Planner core.** Tests build a catalog DB from **raw catalog JSON fixtures** using the real Catalog Pipeline function. They open the Planner on that DB, using the real Catalog Repository and the in-memory User Store, run under Vitest in Node with SQLite-wasm in memory. Tests then assert only on what the Planner returns.
- **Why this seam.** Ranking depends on FTS5, so a fake DB would replace the very thing being tested. Repeat grouping and normalization are proven by what the Planner returns, not by inspecting tables. There's no second seam at the pipeline: the Planner seam already exercises it.
- **Fixtures.** A small hand-made subset in the real API shape, covering:
  - repeat pairs, including one where the `repeats` links aren't symmetric
  - a TBA session
  - sessions across all five venues, including the MGM-to-Wynn travel case
  - a range of seat capacities and formats
  - an avoid-list hit

  For change detection, there's a "v2" variant of the fixture with moved, cancelled, removed, and newly scheduled slots.
- **What a good test is.** It drives the Planner through its public API with a realistic profile and agenda, and asserts on observable outcomes. Examples:
  - "Starred ANT319 lands in its Wednesday slot because Monday clashes with a pinned item."
  - "An MGM→Wynn hop with a 15-minute gap is flagged as travel too tight."
  - "The single-slot 50-seat workshop is first on the checklist."
  - "A moved slot produces exactly one 'moved' alert."

  Tests don't reach into private helpers, SQL, or table layouts.
- **Covered behaviors:**
  - repeat grouping and the TBA handling
  - ranking order and explanations
  - avoid-list exclusion
  - level and format effects
  - auto-build (pins, starred priority, repeats, travel, availability, lunch, daily max, the swap pass, unplaced reasons)
  - conflict detection and alternatives
  - the checklist's scarcity order and status-driven alternatives
  - change-detection alert kinds and their actions
  - profile validation errors
  - `.ics` content
  - state export/import round-trip
- **Not tested:** UI components, the OPFS User Store implementation, the map, or the command-line fetch wrapper.
- **Prior art:** none. The repo is greenfield.

## Out of Scope

- Phase 2: hosting, the nightly automated catalog refresh, the installable offline phone app (PWA) and map-tile caching, and the laptop→phone share link / QR handoff.
- LLM calls from inside the app (bring-your-own-key or a proxy).
- Embeddings and semantic vector search.
- Accounts, multi-user or team features, and shared agendas.
- Booking seats in the official AWS portal. The app only produces the checklist and tracks status.
- Fetching from the official AWS catalog API.
- Indoor or room-level maps, and live routing from a maps API.
- An optimal (ILP) scheduler.
- UI or end-to-end browser tests.

## Further Notes

- **The data source is an unofficial community site run by one person.** Fetch rarely (manual refresh in Phase 1, at most nightly in Phase 2), and use the `etag` to skip unchanged downloads.
- **Facts from the 2026-10-05 snapshot:**
  - 2,112 catalog entries; 2,052 have times and 60 are TBA.
  - The event runs Mon Nov 30 – Fri Dec 4.
  - Five venues: MGM Grand 626 sessions, Wynn/Encore 530, Caesars Palace 332, Caesars Forum 329, Venetian 235.
  - Only 564 sessions have room names.
  - Seat capacity ranges from 50 to 1,000, with a median of 96.
  - No keynotes are in the catalog.
  - There are 18 topics and 171 services.
- **Keynote presets.** The block names ship with the app, but their times must come from the official agenda and be confirmed by me. Don't invent them.
- **Coding standards.** The global coding standards are Python-oriented. Apply their spirit here: simplicity, explicit types, a layered design (UI → Planner core → repositories/stores → SQLite), and DRY where logic is at least 75% similar.
