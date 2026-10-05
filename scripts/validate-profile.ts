// Validates a profile file against the Profile Schema and the catalog vocabulary, then previews its top matches.
//   npx tsx scripts/validate-profile.ts profiles/me.json [--top 15]
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { Planner } from '../src/core/planner';
import { parseProfileJson } from '../src/core/profile/schema';
import { MemoryUserStore } from '../src/core/store/memoryUserStore';
import { requireSnapshot } from './lib/snapshot';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { top: { type: 'string', default: '10' } } });
const file = positionals[0];
if (!file) {
  console.error('Usage: npx tsx scripts/validate-profile.ts <profile.json> [--top N]');
  process.exit(2);
}

const result = parseProfileJson(readFileSync(file, 'utf8'));
if (!result.ok) {
  console.error(`INVALID ${file}`);
  for (const error of result.errors) console.error(`  ${error.path || '(root)'}: ${error.message}`);
  process.exit(1);
}

const profile = result.value;
const catalog = await requireSnapshot();
const vocabulary = catalog.vocabulary();
const unknown = (label: string, names: string[], known: string[]): string[] =>
  names.filter((n) => !known.includes(n)).map((n) => `${label} "${n}" is not in the catalog vocabulary`);
const warnings = [
  ...unknown('topic', Object.keys(profile.topics), vocabulary.topics),
  ...unknown('service', Object.keys(profile.services), vocabulary.services),
  ...unknown('format', Object.keys(profile.formats), vocabulary.types),
  ...unknown('avoid topic', profile.avoid.topics, vocabulary.topics),
  ...unknown('avoid service', profile.avoid.services, vocabulary.services),
];

const planner = Planner.open({ catalog, store: new MemoryUserStore() });
planner.updateProfile(profile);
const keywordsWithoutHits = profile.interests.flatMap((i) => i.keywords.filter((k) => planner.rank({ q: k, limit: 1 }).length === 0).map((k) => `${i.label}: "${k}"`));
for (const k of keywordsWithoutHits) warnings.push(`keyword ${k} matches no session`);

console.log(`VALID ${file} (${profile.interests.length} interests, ${Object.keys(profile.topics).length} topics, ${Object.keys(profile.services).length} services)`);
for (const warning of warnings) console.log(`  warning: ${warning}`);
console.log(`\nTop ${values.top} sessions for this profile:`);
for (const r of planner.rank({ limit: Number(values.top) })) {
  const why = r.explanation.interests.map((i) => i.label).join(', ') || r.explanation.tags.map((t) => t.name).join(', ');
  console.log(`  ${r.score.toFixed(1).padStart(5)}  ${r.session.code.padEnd(10)} ${r.session.type.padEnd(17)} ${r.session.title}  [${why}]`);
}
process.exit(warnings.length ? 3 : 0);
