---
name: profile-builder
description: Planner profile for the re:Invent 2026 app. Use when the user describes what they want from re:Invent (interests, role, days, formats) or asks to create, regenerate or tweak a profile in profiles/.
---

Turn the user's plain-English description into a profile JSON that validates against the Profile Schema (`src/core/profile/schema.ts`) and uses the catalog's real vocabulary, then write it to `profiles/<name>.json` (git-ignored).

## Steps

1. **Read the vocabulary.** Run `npx tsx scripts/vocabulary.ts`. It prints JSON from `public/catalog.sqlite3`: topics, services, types (formats), levels, areas of interest, roles, industries, features. Every name you put in `topics`, `services`, `formats`, `avoid.topics` and `avoid.services` comes from this output, spelled exactly. Done when you have the lists in hand.
2. **Fill gaps.** If the description is silent on days attending, hours, lunch or seniority, use the schema defaults (all five days 08:00–18:00, lunch 12:00–13:00, 6 per day, level 200–400) and say so in your reply. Ask only when the description contradicts itself.
3. **Draft the profile.** Start from `examples/profile.example.json` for shape and tone.
   - `description`: the user's words, verbatim.
   - `interests`: 3–8, most important first, `weight` 0..1. Each gets 5–15 `keywords`: synonyms, product names and phrases a session title or abstract would actually use. Areas of interest from the vocabulary make good keyword seeds. Keywords are matched as phrases with stemming, so prefer short phrases ("prompt injection") over sentences.
   - `topics` / `services`: weights 0..1 for the ones that matter; leave the rest out.
   - `formats`: type → -1..1, only for clear preferences. Chalk talks, workshops, builders' sessions and code talks are not recorded; breakouts are.
   - `avoid`: only what the user explicitly rules out.
   - `availability.days`: keys `mon`…`fri` present only for days attending; times are Las Vegas local 24h `"HH:MM"`.
4. **Write** `profiles/<kebab-case-name>.json`.
5. **Validate.** Run `npx tsx scripts/validate-profile.ts profiles/<name>.json --top 15`. Exit 1 prints field-path errors (`interests[2].weight: …`); exit 3 prints warnings (names not in the vocabulary, keywords that hit no session). Fix and re-run until it exits 0, or until every remaining warning is one you chose to keep and can explain.
6. **Check the top matches** it prints against the description. If an important interest is missing from the top 15, raise its weight or add keywords borrowed from the wording of matching titles, then re-validate.
7. **Report**: the file path, a one-line summary per interest, the defaults you assumed, and how to load it: import the JSON in the app's Profile view.

When regenerating an existing profile, read it first and keep the user's manual tweaks (weights, avoid list) unless the new description overrides them.
