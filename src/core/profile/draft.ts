// Profile builder: maps the guided builder's choices (ProfileDraft) to a Profile and back. Deterministic, no LLM.
import {
  DAYS,
  DRAFT_WEIGHTS,
  FORMAT_CHOICES,
  type DraftWeight,
  type FormatChoice,
  type Interest,
  type Profile,
  type ProfileDraft,
  type Result,
  type Vocabulary,
} from '../types';
import { defaultProfile, validateProfile } from './schema';

const SUMMARY_PREFIX = 'Summary: ';

export function profileFromDraft(draft: ProfileDraft): Result<Profile> {
  const interests = [...weighted(draft.topics, topicKeywords), ...weighted(draft.services, serviceKeywords)].sort((a, b) => b.weight - a.weight);
  return validateProfile({ ...fixedFields(draft), interests, description: draft.freeText.trim() || summaryLine(draft) });
}

// Every Profile field the builder decides; the copy prompt asks Claude to keep these verbatim.
export function fixedFields(draft: ProfileDraft): Omit<Profile, 'interests' | 'description'> {
  return {
    version: 1,
    name: draft.name.trim(),
    level: draft.level,
    topics: toWeights(draft.topics),
    services: toWeights(draft.services),
    formats: Object.fromEntries(Object.entries(draft.formats).map(([type, choice]) => [type, FORMAT_CHOICES[choice]])),
    avoid: draft.avoid,
    availability: draft.availability,
    roles: draft.roles,
    industries: draft.industries,
  };
}

// `recorded` decides the default format choice for types the profile has no preference for: unrecorded -> prefer, recorded -> neutral.
export function draftFromProfile(profile: Profile | null, vocabulary: Vocabulary, recorded: Record<string, boolean>): ProfileDraft {
  const source = profile ?? defaultProfile();
  const formats: Record<string, FormatChoice> = {};
  for (const type of vocabulary.types) {
    const value = source.formats[type];
    formats[type] = value === undefined ? (recorded[type] ? 'neutral' : 'prefer') : toFormatChoice(value);
  }
  return {
    name: source.name,
    roles: source.roles ?? [],
    level: source.level,
    topics: toBuckets(source.topics),
    services: toBuckets(source.services),
    formats,
    industries: source.industries ?? [],
    availability: source.availability,
    avoid: source.avoid,
    freeText: stripSummary(source.description),
  };
}

// One line describing the picks, e.g. "Summary: Data Engineer · topics: Analytics (high) · levels 300–400 · prefers Workshop · Mon, Tue · avoids blockchain".
export function summaryLine(draft: ProfileDraft): string {
  const named = (map: Record<string, DraftWeight>): string =>
    Object.entries(map)
      .sort(([, a], [, b]) => DRAFT_WEIGHTS[b] - DRAFT_WEIGHTS[a])
      .map(([name, w]) => `${name} (${w})`)
      .join(', ');
  const byChoice = (choice: FormatChoice): string[] => Object.keys(draft.formats).filter((t) => draft.formats[t] === choice);
  const days = DAYS.filter((d) => draft.availability.days[d.id]).map((d) => d.label.slice(0, 3));
  const avoided = [...draft.avoid.topics, ...draft.avoid.services, ...draft.avoid.keywords];
  const parts = [
    draft.roles.length ? draft.roles.join(', ') : '',
    draft.industries.length ? `industries: ${draft.industries.join(', ')}` : '',
    Object.keys(draft.topics).length ? `topics: ${named(draft.topics)}` : '',
    Object.keys(draft.services).length ? `services: ${named(draft.services)}` : '',
    `levels ${draft.level.min}–${draft.level.max}`,
    byChoice('prefer').length ? `prefers ${byChoice('prefer').join(', ')}` : '',
    byChoice('avoid').length ? `avoids formats ${byChoice('avoid').join(', ')}` : '',
    days.length ? `attending ${days.join(', ')}, max ${draft.availability.maxPerDay}/day` : 'no days selected',
    avoided.length ? `avoid: ${avoided.join(', ')}` : '',
  ];
  return SUMMARY_PREFIX + parts.filter(Boolean).join(' · ');
}

function weighted(map: Record<string, DraftWeight>, keywords: (name: string) => string[]): Interest[] {
  return Object.entries(map).map(([name, w]) => ({ label: name, weight: DRAFT_WEIGHTS[w], keywords: keywords(name) }));
}

function toWeights(map: Record<string, DraftWeight>): Record<string, number> {
  return Object.fromEntries(Object.entries(map).map(([name, w]) => [name, DRAFT_WEIGHTS[w]]));
}

function toBuckets(map: Record<string, number>): Record<string, DraftWeight> {
  const entries = Object.entries(map).filter(([, w]) => w > 0);
  return Object.fromEntries(entries.map(([name, w]) => [name, w >= 0.8 ? 'high' : w >= 0.45 ? 'medium' : 'low']));
}

function toFormatChoice(value: number): FormatChoice {
  if (value >= 0.3) return 'prefer';
  if (value <= -0.3) return 'avoid';
  return 'neutral';
}

// "Security & Identity" -> the full name plus each part, so text matching hits either wording.
function topicKeywords(name: string): string[] {
  return unique([name, ...name.split('&').map((s) => s.trim())]);
}

// "Amazon Elastic Compute Cloud (Amazon EC2)" -> full name, name without the parenthetical, the abbreviation, and the name without "Amazon"/"AWS".
function serviceKeywords(name: string): string[] {
  const inner = /\(([^)]+)\)/.exec(name)?.[1] ?? '';
  const base = name.replace(/\s*\([^)]*\)/g, '').trim();
  const bare = base.replace(/^(Amazon|AWS)\s+/, '');
  return unique([name, base, inner.startsWith('with ') ? '' : inner, bare.length > 3 ? bare : '']);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

// Drops the generated "Summary: …" line so the builder shows only the user's own words.
function stripSummary(description: string): string {
  return description
    .split('\n')
    .filter((line) => !line.startsWith(SUMMARY_PREFIX))
    .join('\n')
    .trim();
}
