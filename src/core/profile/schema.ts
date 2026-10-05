// Profile Schema: versioned, shared by import, the copy-prompt generator and the Claude Code skill.
import { z } from 'zod';
import type { Profile, Result, ValidationError } from '../types';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24h time "HH:MM"');

const dayWindow = z
  .object({ start: hhmm.describe('Earliest start, Las Vegas local "HH:MM"'), end: hhmm.describe('Latest end, Las Vegas local "HH:MM"') })
  .strict()
  .refine((w) => w.start < w.end, { message: 'start must be before end', path: ['end'] });

const level = z.number().int().min(100).max(500).multipleOf(100);
const weight = z.number().min(0).max(1);
const names = z.array(z.string().min(1));

export const DEFAULT_DAY_WINDOW = { start: '08:00', end: '18:00' };

export const ProfileSchema = z
  .object({
    version: z.literal(1).describe('Profile schema version. Always 1.'),
    name: z.string().min(1).describe('Short name for this profile'),
    description: z.string().default('').describe("The user's original plain-English description, verbatim"),
    interests: z
      .array(
        z
          .object({
            label: z.string().min(1).describe('Short name of the interest'),
            weight: weight.describe('Importance 0..1'),
            keywords: names.min(1).describe('Expanded keywords, synonyms and phrases used for full-text matching'),
          })
          .strict(),
      )
      .describe('What the user wants to learn about, most important first'),
    topics: z.record(z.string(), weight).default({}).describe('Catalog topic name -> weight 0..1. Names must come from the catalog vocabulary.'),
    services: z.record(z.string(), weight).default({}).describe('Catalog service name -> weight 0..1. Names must come from the catalog vocabulary.'),
    level: z
      .object({ min: level, max: level })
      .strict()
      .refine((l) => l.min <= l.max, { message: 'min must be <= max', path: ['max'] })
      .default({ min: 200, max: 400 })
      .describe('Preferred session level range (100 foundational .. 500 distinguished)'),
    formats: z.record(z.string(), z.number().min(-1).max(1)).default({}).describe('Session type -> preference -1 (avoid) .. 1 (prefer)'),
    avoid: z
      .object({ keywords: names.default([]), topics: names.default([]), services: names.default([]) })
      .strict()
      .default({ keywords: [], topics: [], services: [] })
      .describe('Sessions matching any of these are excluded from ranking'),
    availability: z
      .object({
        days: z
          .object({ mon: dayWindow.optional(), tue: dayWindow.optional(), wed: dayWindow.optional(), thu: dayWindow.optional(), fri: dayWindow.optional() })
          .strict()
          .describe('Days attending (a key present = attending) with the earliest start and latest end'),
        lunch: dayWindow.nullable().describe('Lunch window kept free every day, or null'),
        maxPerDay: z.number().int().min(1).max(20).describe('Maximum number of sessions per day'),
      })
      .strict()
      .default({
        days: { mon: DEFAULT_DAY_WINDOW, tue: DEFAULT_DAY_WINDOW, wed: DEFAULT_DAY_WINDOW, thu: DEFAULT_DAY_WINDOW, fri: DEFAULT_DAY_WINDOW },
        lunch: { start: '12:00', end: '13:00' },
        maxPerDay: 6,
      }),
  })
  .strict();

export function defaultProfile(name = 'My profile'): Profile {
  return ProfileSchema.parse({ version: 1, name, interests: [] }) as Profile;
}

export function profileJsonSchema(): Record<string, unknown> {
  return z.toJSONSchema(ProfileSchema, { io: 'input' }) as Record<string, unknown>;
}

export function validateProfile(input: unknown): Result<Profile> {
  const parsed = ProfileSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data as Profile };
  return { ok: false, errors: toValidationErrors(parsed.error) };
}

export function parseProfileJson(json: string): Result<Profile> {
  const parsed = parseJson(json);
  return parsed.ok ? validateProfile(parsed.value) : parsed;
}

export function parseJson(json: string): Result<unknown> {
  try {
    return { ok: true, value: JSON.parse(json) as unknown };
  } catch (error) {
    return { ok: false, errors: [{ path: '', message: `Invalid JSON: ${(error as Error).message}` }] };
  }
}

export function toValidationErrors(error: z.ZodError, prefix = ''): ValidationError[] {
  return error.issues.map((issue) => ({ path: formatPath(issue.path, prefix), message: issue.message }));
}

// ["interests", 2, "weight"] -> "interests[2].weight"; non-identifier keys are quoted: topics["Security & Identity"]
export function formatPath(path: PropertyKey[], prefix = ''): string {
  let out = prefix;
  for (const part of path) {
    if (typeof part === 'number') out += `[${part}]`;
    else if (/^[A-Za-z_$][\w$]*$/.test(String(part))) out += out ? `.${String(part)}` : String(part);
    else out += `[${JSON.stringify(String(part))}]`;
  }
  return out;
}
