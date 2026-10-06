// Schema of the exportState/importState payload (the whole User Store).
import { z } from 'zod';
import { ProfileSchema } from './profile/schema';

export const STATE_KIND = 'reinvent-2026-planner-state';

const dayId = z.enum(['mon', 'tue', 'wed', 'thu', 'fri']);
const venueId = z.enum(['venetian', 'wynn', 'caesars-forum', 'caesars-palace', 'mgm']);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24h time "HH:MM"');

export const SettingsSchema = z.object({
  weights: z.object({ text: z.number().min(0), tags: z.number().min(0), level: z.number().min(0), format: z.number().min(0) }),
  theme: z.enum(['system', 'light', 'dark']),
  recorded: z.record(z.string(), z.boolean()),
});

export const TravelSchema = z.record(z.string().regex(/^[a-z-]+\|[a-z-]+$/, 'Expected "venueA|venueB"'), z.number().min(0).max(240));

export const FingerprintSchema = z.object({
  start: z.string().nullable(),
  end: z.string().nullable(),
  venue: venueId.nullable(),
  room: z.string().nullable(),
  exists: z.boolean(),
});

export const AgendaItemSchema = z.object({
  id: z.string().min(1),
  sessionKey: z.string().min(1),
  slotId: z.string().min(1),
  origin: z.enum(['manual', 'starred', 'suggested']),
  pinned: z.boolean(),
  fingerprint: FingerprintSchema,
  reservation: z.enum(['none', 'reserved', 'waitlisted', 'failed', 'walk-up']),
  title: z.string().optional(),
  code: z.string().optional(),
});

export const PersonalBlockSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: z.enum(['keynote', 'personal']),
    day: dayId.nullable(),
    start: hhmm.nullable(),
    end: hhmm.nullable(),
    venue: venueId.nullable(),
    enabled: z.boolean(),
  })
  .refine((b) => !b.start || !b.end || b.start < b.end, { message: 'start must be before end', path: ['end'] });

export const ManualScoreSchema = z.number().int().min(0).max(100);

// Schema of the exportAgenda/importAgenda payload (agenda, stars and personal blocks only).
export const AGENDA_KIND = 'reinvent-planner-agenda';

const ExportedItemsSchema = z.array(
  z.object({
    sessionKey: z.string().min(1),
    code: z.string(),
    title: z.string(),
    slotId: z.string(),
    start: z.string().nullable(),
    end: z.string().nullable(),
    venue: venueId.nullable(),
    room: z.string().nullable(),
    pinned: z.boolean(),
    origin: AgendaItemSchema.shape.origin,
    reservation: AgendaItemSchema.shape.reservation,
  }),
);
const ExportedStarsSchema = z.array(z.object({ sessionKey: z.string().min(1), code: z.string(), title: z.string() }));
const ExportedScoresSchema = z.array(z.object({ sessionKey: z.string().min(1), code: z.string(), title: z.string(), score: ManualScoreSchema }));

export const AgendaExportSchema = z.object({
  kind: z.literal(AGENDA_KIND),
  version: z.literal(1),
  exportedAt: z.string(),
  items: ExportedItemsSchema,
  starred: ExportedStarsSchema,
  scores: ExportedScoresSchema.optional(),
  blocks: z.array(PersonalBlockSchema),
});

export type AgendaExport = z.infer<typeof AgendaExportSchema>;

// What a profile entry keeps of someone's plan: the agenda-export items, stars and manual scores.
export const SharedPlanSchema = z.object({
  exportedAt: z.string(),
  items: ExportedItemsSchema,
  starred: ExportedStarsSchema,
  scores: ExportedScoresSchema,
});

export type SharedPlan = z.infer<typeof SharedPlanSchema>;

export const ProfileEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.enum(['mine', 'friend']),
  profile: ProfileSchema.nullable(),
  plan: SharedPlanSchema.nullable(),
  updatedAt: z.string(),
  sourceId: z.string().nullable(),
});

// Schema of the exportSharedPlan/importSharedPlan payload: one person's profile and plan, sent to friends.
export const SHARED_PLAN_KIND = 'reinvent-planner-shared-plan';

export const SharedPlanExportSchema = z.object({
  kind: z.literal(SHARED_PLAN_KIND),
  version: z.literal(1),
  sourceId: z.string().min(1),
  displayName: z.string().trim().min(1),
  exportedAt: z.string(),
  profile: ProfileSchema.nullable(),
  items: ExportedItemsSchema,
  starred: ExportedStarsSchema,
  scores: ExportedScoresSchema.default([]),
});

export const StateSchema = z.object({
  kind: z.literal(STATE_KIND),
  version: z.literal(1),
  exportedAt: z.string(),
  profile: ProfileSchema.nullable(),
  settings: SettingsSchema.nullable(),
  travel: TravelSchema.nullable(),
  items: z.array(AgendaItemSchema),
  stars: z.array(z.string()),
  manualScores: z.record(z.string(), ManualScoreSchema).optional(), // optional: exports from before manual scores
  blocks: z.array(PersonalBlockSchema),
  dismissedAlerts: z.array(z.string()),
  tbaWatch: z.array(z.string()),
  // optional: exports from before the profiles library
  profiles: z.array(ProfileEntrySchema).optional(),
  activeProfileId: z.string().nullable().optional(),
  shareSourceId: z.string().nullable().optional(),
});
