// Builds a self-contained prompt that lets any Claude chat produce a valid profile JSON.
import { DAYS, type ProfileDraft, type Vocabulary } from '../types';
import { fixedFields, summaryLine } from './draft';
import { profileJsonSchema } from './schema';

export function buildCopyPrompt(vocabulary: Vocabulary): string {
  const list = (values: (string | number)[]): string => values.map((v) => `- ${v}`).join('\n');
  return `You are helping me plan AWS re:Invent 2026 (Las Vegas, ${DAYS[0].label} – ${DAYS[DAYS.length - 1].label}).
Turn my description (at the end) into a planner profile: one JSON object that validates against the JSON Schema below.

## Instructions
1. Copy my description verbatim into "description". Set "version" to 1 and pick a short "name".
2. Create 3–8 "interests", most important first. Each has a "label", a "weight" from 0 to 1, and 5–15 "keywords":
   expanded keywords, synonyms, product names and short phrases the session titles and abstracts are likely to use
   (e.g. for "securing AI agents": "agentic AI security", "guardrails", "prompt injection", "Amazon Bedrock Guardrails").
3. Fill "topics" and "services" with weights 0..1. Use ONLY names from the vocabulary lists below, spelled exactly.
4. Set "level" (min/max among ${vocabulary.levels.join(', ')}) from my seniority. Default 200–400.
5. Set "formats" (session type -> -1..1) only for types I clearly prefer or dislike. Use only the session types listed below.
   Hands-on formats (workshops, builders' sessions, code talks, chalk talks) are not recorded; breakouts are.
6. Put anything I explicitly do not want into "avoid" (keywords, topics, services).
7. Set "availability": the days I attend (keys ${DAYS.map((d) => `"${d.id}"`).join(', ')}) with earliest start and latest end
   in Las Vegas local 24h "HH:MM", a lunch window (or null) and "maxPerDay". Default to all days 08:00–18:00, lunch 12:00–13:00, 6 per day.
8. Reply with the JSON object only, no commentary.

## JSON Schema
\`\`\`json
${JSON.stringify(profileJsonSchema(), null, 2)}
\`\`\`

## Catalog vocabulary

### Topics
${list(vocabulary.topics)}

### Services
${list(vocabulary.services)}

### Session types (formats)
${list(vocabulary.types)}

### Levels
${list(vocabulary.levels)}

### Areas of interest (useful as keyword ideas)
${list(vocabulary.areasOfInterest)}

### Roles
${list(vocabulary.roles)}

### Industries
${list(vocabulary.industries)}

### Features
${list(vocabulary.features)}

## My description
<describe your role, what you want to learn, what to avoid, which days you attend and your preferred formats here>
`;
}

// Builder variant: the draft's choices are fixed JSON fields; Claude only writes interests (and may add vocabulary-only weights).
export function buildDraftPrompt(vocabulary: Vocabulary, draft: ProfileDraft): string {
  const line = (values: (string | number)[]): string => JSON.stringify(values);
  const freeText = draft.freeText.trim();
  return `You are helping me plan AWS re:Invent 2026 (Las Vegas, ${DAYS[0].label} – ${DAYS[DAYS.length - 1].label}).
I already made my choices in the planner's profile builder. Turn them into a planner profile: one JSON object that validates against the JSON Schema below.

## Fixed choices (copy every field verbatim)
\`\`\`json
${oneLinePerField(fixedFields(draft))}
\`\`\`
Topic/service weights: 1 = high, 0.6 = medium, 0.3 = low. Formats: 1 = prefer, 0 = neutral, -1 = avoid. Roles and industries are context about me.

## My own words
${freeText || '(none — rely on the fixed choices)'}

## Instructions
1. Start from the fixed choices and keep them exactly: "version", "name", "level", "formats", "availability", "avoid", "roles", "industries" and every topic/service weight. Do not remove or change any of them.
2. Write 3–8 "interests", most important first, from my own words and the highest-weighted topics and services. Each has a "label", a "weight" 0..1
   and 8–15 "keywords": expanded keywords, synonyms, product and feature names and short phrases that session titles and abstracts likely use.
   Prefer catalog wording (service names and areas of interest below). Never use anything I listed under "avoid".
3. You may add more "topics" and "services" weights that clearly fit my words, using ONLY names from the vocabulary below, spelled exactly. Never add avoided ones.
4. Set "description" to my own words verbatim, followed by a new line with exactly:
${summaryLine(draft)}
5. Return ONLY the JSON profile — no commentary, no code fences.

## JSON Schema
\`\`\`json
${JSON.stringify(profileJsonSchema())}
\`\`\`

## Catalog vocabulary (JSON arrays; spell names exactly)
Topics: ${line(vocabulary.topics)}
Services: ${line(vocabulary.services)}
Session types: ${line(vocabulary.types)}
Areas of interest (keyword ideas): ${line(vocabulary.areasOfInterest)}
`;
}

// Pretty enough to read, compact enough to paste: one top-level field per line.
function oneLinePerField(value: object): string {
  const lines = Object.entries(value).map(([key, field]) => `  ${JSON.stringify(key)}: ${JSON.stringify(field)}`);
  return `{\n${lines.join(',\n')}\n}`;
}
