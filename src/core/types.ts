// Shared contracts between the Planner core and the UI.
// The UI talks ONLY to the `PlannerApi` below (through a Web Worker proxy in the browser).
import type { SharedPlan } from './stateSchema';

export type { SharedPlan };

export type DayId = 'mon' | 'tue' | 'wed' | 'thu' | 'fri';
export const DAYS: { id: DayId; date: string; label: string }[] = [
  { id: 'mon', date: '2026-11-30', label: 'Mon Nov 30' },
  { id: 'tue', date: '2026-12-01', label: 'Tue Dec 1' },
  { id: 'wed', date: '2026-12-02', label: 'Wed Dec 2' },
  { id: 'thu', date: '2026-12-03', label: 'Thu Dec 3' },
  { id: 'fri', date: '2026-12-04', label: 'Fri Dec 4' },
];

export type VenueId = 'venetian' | 'wynn' | 'caesars-forum' | 'caesars-palace' | 'mgm';
export const VENUES: { id: VenueId; name: string; lat: number; lng: number }[] = [
  { id: 'wynn', name: 'Wynn/Encore', lat: 36.1271, lng: -115.1658 },
  { id: 'venetian', name: 'Venetian', lat: 36.1212, lng: -115.1697 },
  { id: 'caesars-forum', name: 'Caesars Forum', lat: 36.1182, lng: -115.1667 },
  { id: 'caesars-palace', name: 'Caesars Palace', lat: 36.1162, lng: -115.1745 },
  { id: 'mgm', name: 'MGM Grand', lat: 36.1024, lng: -115.1699 },
];

export type TagKind = 'topic' | 'service' | 'areaOfInterest' | 'role' | 'industry' | 'feature';

export interface Speaker {
  name: string;
  company: string | null;
}

export interface Slot {
  slotId: string; // original catalog entry id
  code: string; // short code, e.g. ANT319-R1
  sessionKey: string;
  start: string | null; // ISO UTC
  end: string | null; // ISO UTC
  day: DayId | null; // Las Vegas local day
  venue: VenueId | null;
  room: string | null;
  seats: number | null;
  hash: string;
  lastModified: string;
}

export interface Session {
  key: string; // grouping key (base code of the group, e.g. ANT319)
  code: string; // display code (base code)
  title: string;
  abstract: string;
  level: number | null; // 100..400
  type: string; // e.g. "Chalk talk"
  topics: string[];
  services: string[];
  areasOfInterest: string[];
  roles: string[];
  industries: string[];
  features: string[];
  speakers: Speaker[];
  slots: Slot[]; // sorted by start; slots with null start are TBA
  tba: boolean; // true when no slot has a time
}

export interface CatalogMeta {
  sourceUrl: string;
  fetchedAt: string; // ISO
  etag: string | null;
  sessionCount: number;
  slotCount: number;
}

export interface Vocabulary {
  topics: string[];
  services: string[];
  areasOfInterest: string[];
  roles: string[];
  industries: string[];
  features: string[];
  types: string[];
  levels: number[];
  venues: VenueId[];
}

// ---------- Profile (validated by the Profile Schema, see src/core/profile/schema.ts) ----------

export interface Interest {
  label: string;
  weight: number; // 0..1
  keywords: string[]; // expanded keywords / synonyms
}

export interface DayWindow {
  start: string; // "HH:MM" Las Vegas local
  end: string; // "HH:MM"
}

export interface Profile {
  version: 1;
  name: string;
  description: string; // the original plain-English description
  interests: Interest[];
  topics: Record<string, number>; // topic name -> weight 0..1
  services: Record<string, number>; // service name -> weight 0..1
  level: { min: number; max: number }; // e.g. 200..400
  formats: Record<string, number>; // session type -> preference -1..1
  avoid: { keywords: string[]; topics: string[]; services: string[] };
  availability: {
    days: Partial<Record<DayId, DayWindow>>; // a key present = attending that day
    lunch: DayWindow | null;
    maxPerDay: number;
  };
  roles?: string[]; // catalog roles, context only (not used for ranking)
  industries?: string[]; // catalog industries, context only
}

// ---------- Profile builder ----------

export type DraftWeight = 'high' | 'medium' | 'low';
export const DRAFT_WEIGHTS: Record<DraftWeight, number> = { high: 1, medium: 0.6, low: 0.3 };

export type FormatChoice = 'prefer' | 'neutral' | 'avoid';
export const FORMAT_CHOICES: Record<FormatChoice, number> = { prefer: 1, neutral: 0, avoid: -1 };

// The guided builder's choices. Turned into a Profile deterministically (profileFromDraft) or baked into the copy prompt.
export interface ProfileDraft {
  name: string;
  roles: string[]; // catalog roles
  level: { min: number; max: number };
  topics: Record<string, DraftWeight>; // catalog topic -> weight
  services: Record<string, DraftWeight>; // catalog service -> weight
  formats: Record<string, FormatChoice>; // session type -> preference
  industries: string[]; // catalog industries, context only
  availability: Profile['availability'];
  avoid: Profile['avoid'];
  freeText: string; // the user's own words
}

export interface ValidationError {
  path: string; // e.g. "interests[2].weight"
  message: string;
}

export type Result<T> = { ok: true; value: T } | { ok: false; errors: ValidationError[] };

// ---------- User state ----------

export type ItemOrigin = 'manual' | 'starred' | 'suggested';
export type ReservationStatus = 'none' | 'reserved' | 'waitlisted' | 'failed' | 'walk-up';

export interface SlotFingerprint {
  start: string | null;
  end: string | null;
  venue: VenueId | null;
  room: string | null;
  exists: boolean;
}

export interface AgendaItem {
  id: string;
  sessionKey: string;
  slotId: string;
  origin: ItemOrigin; // manual = added by hand, starred = placed by auto-build from a star, suggested = auto-build filler
  pinned: boolean;
  fingerprint: SlotFingerprint;
  reservation: ReservationStatus;
  title?: string; // snapshot of the session title/code when added, so alerts can still name a session that left the catalog
  code?: string;
}

export interface PersonalBlock {
  id: string;
  title: string;
  kind: 'keynote' | 'personal';
  day: DayId | null; // null = not scheduled yet (keynote presets ship without times)
  start: string | null; // "HH:MM" Las Vegas local
  end: string | null;
  venue: VenueId | null;
  enabled: boolean; // disabled blocks are ignored by planning
}

export type TravelTable = Record<string, number>; // key "venueA|venueB" with venueA < venueB alphabetically

export interface RankingWeights {
  text: number;
  tags: number;
  level: number;
  format: number;
}

export interface Settings {
  weights: RankingWeights;
  theme: 'system' | 'light' | 'dark';
  recorded: Record<string, boolean>; // session type -> recorded?
  maxVenueSwitchesPerDay: number; // 0..5; 0 = stay in one venue all day
}

// ---------- Ranking ----------

export type SortBy = 'score' | 'time' | 'level' | 'venue' | 'seats';

export interface Filters {
  q?: string;
  days?: DayId[];
  timeFrom?: string; // "HH:MM"
  timeTo?: string;
  venues?: VenueId[];
  types?: string[];
  levels?: number[];
  topics?: string[];
  services?: string[];
  roles?: string[];
  industries?: string[];
  features?: string[];
  starredOnly?: boolean;
  onAgendaOnly?: boolean;
  tbaOnly?: boolean;
  hideConflicting?: boolean;
  showAvoided?: boolean;
  scored?: 'manual' | 'unscored'; // sessions with / without a manual score
  sort?: { by: SortBy; dir: 'asc' | 'desc' };
  limit?: number;
}

export interface MatchExplanation {
  interests: { label: string; keywords: string[]; contribution: number }[];
  tags: { kind: 'topic' | 'service'; name: string; weight: number }[];
  level: { fit: 'in' | 'below' | 'above' | 'unknown'; contribution: number };
  format: { type: string; recorded: boolean; contribution: number };
  avoided: string[]; // reasons it hit the avoid list (empty = not avoided)
}

export interface RankedSession {
  session: Session;
  score: number; // effective score: manualScore ?? computedScore
  computedScore: number;
  manualScore: number | null;
  explanation: MatchExplanation;
  matchingSlotIds: string[]; // slots passing the slot-level filters (days, time window, venues); all slots when none is set
  starred: boolean;
  onAgenda: boolean;
}

// The slot a ranked session is listed and sorted by: its first timed matching slot, else its first matching one (TBA).
export function firstMatchingSlot(r: RankedSession): Slot | undefined {
  const matching = r.session.slots.filter((slot) => r.matchingSlotIds.includes(slot.slotId));
  return matching.find((slot) => slot.start) ?? matching[0];
}

// ---------- Planning ----------

export type SlotFit = 'free' | 'conflict' | 'travel' | 'outside' | 'tba';

export interface Alternative {
  kind: 'otherSlot' | 'otherSession';
  sessionKey: string;
  slotId: string;
  title: string;
  code: string;
  start: string;
  end: string;
  venue: VenueId | null;
  score: number;
  fit: SlotFit;
}

export type ConflictKind = 'overlap' | 'travel' | 'availability' | 'lunch' | 'dailyMax' | 'venueSwitches';

export interface Conflict {
  itemId: string;
  kind: ConflictKind;
  withId: string | null; // the other agenda item or personal block id
  message: string;
  alternatives: Alternative[];
}

// One day of the agenda, for the calendar header.
export interface DaySummary {
  day: DayId;
  sessions: number;
  switches: number; // consecutive agenda items / personal blocks at different venues
  maxSwitches: number;
  route: VenueId[]; // venues in visiting order, consecutive repeats collapsed
}

export interface AutoBuildResult {
  agenda: AgendaItem[];
  unplaced: { sessionKey: string; title: string; reason: string }[];
}

export interface ChecklistItem {
  itemId: string;
  sessionKey: string;
  code: string; // slot short code, for searching in the official portal
  title: string;
  type: string; // session type, e.g. "Workshop"
  starred: boolean;
  portalUrl: string; // official catalog page filtered to this code, where it is reserved
  slot: Slot;
  scarcity: number;
  priority: number;
  status: ReservationStatus;
  alternatives: Alternative[]; // filled when status === 'failed'
}

export type AlertKind = 'moved' | 'cancelled' | 'removed' | 'newConflict' | 'tbaScheduled';

export interface ChangeAlert {
  id: string; // deterministic, so dismissals survive re-detection
  kind: AlertKind;
  itemId: string | null; // agenda item it concerns (null for tbaScheduled)
  sessionKey: string;
  title: string;
  message: string;
  before: SlotFingerprint | null;
  after: SlotFingerprint | null;
}

export interface AgendaImportOptions {
  mode: 'replace' | 'merge'; // replace = clear agenda, stars and manual scores first; merge = imported item/score wins for a session already present
  includeBlocks: boolean;
}

export interface AgendaImportReport {
  added: number;
  replaced: number; // merge: sessions already on the agenda whose item changed (identical items are not counted)
  scores: number; // manual scores imported
  movedToOtherSlot: { code: string; title: string; from: string; to: string }[];
  skipped: { code: string; title: string; reason: string }[];
  starred: number;
  blocks: number;
}

export interface IcsOptions {
  includePersonal: boolean;
}

// ---------- Profiles library & sharing ----------

export type ProfileEntryKind = 'mine' | 'friend';

// A saved profile. 'mine' entries are snapshots of my own profile (plan = null); 'friend' entries come from a friend's
// shared plan (or a plain agenda file, which has no profile).
export interface ProfileEntry {
  id: string;
  name: string;
  kind: ProfileEntryKind;
  profile: Profile | null;
  plan: SharedPlan | null;
  updatedAt: string; // ISO
  sourceId: string | null; // the sharer's browser id, so a newer file from the same friend updates this entry
}

export interface ProfileEntrySummary {
  id: string;
  name: string;
  kind: ProfileEntryKind;
  updatedAt: string;
  active: boolean; // the entry last activated (or saved)
  hasProfile: boolean;
  hasPlan: boolean;
  agendaCount: number;
  starCount: number;
}

// ---------- Compare ----------

export const ME = 'me'; // person id of my live state in compare()

export interface CompareProfileSummary {
  topInterests: string[];
  topics: string[];
  level: { min: number; max: number } | null;
  days: DayId[];
}

export interface ComparePerson {
  id: string; // ME or a profile entry id
  name: string;
  profileSummary: CompareProfileSummary;
  agendaCount: number; // items resolved against the current catalog
  missing: { code: string; title: string }[]; // items that no longer resolve (session gone or TBA now)
}

export interface CompareSession {
  sessionKey: string;
  code: string; // session code
  title: string;
}

// A session in the slot it resolved to in the current catalog.
export interface CompareSlotted extends CompareSession {
  slotId: string;
  slotCode: string;
  day: DayId;
  start: string; // ISO
  end: string;
  venue: VenueId | null;
}

// One person's resolved agenda item.
export interface ComparePlacement extends CompareSlotted {
  personId: string;
}

// together = another person is in the same slot; split = someone else in the row is at a different session; solo = alone in the row
export type CompareCellStatus = 'together' | 'split' | 'solo';

export interface CompareCell extends CompareSession {
  slotId: string;
  slotCode: string;
  venue: VenueId | null;
  status: CompareCellStatus;
}

export interface CompareRow {
  start: string; // ISO, earliest start of the row's sessions
  end: string; // ISO, latest end
  cells: Record<string, CompareCell | null>; // person id -> session, null = free
}

export interface CompareResult {
  people: ComparePerson[];
  days: { day: DayId; rows: CompareRow[] }[];
  together: (CompareSlotted & { personIds: string[] })[]; // same session and slot for 2+ people
  sameSessionDifferentSlot: (CompareSession & { placements: ComparePlacement[] })[];
  split: { start: string; end: string; entries: { personId: string; sessionKey: string; slotId: string; title: string; venue: VenueId | null }[] }[];
  onlyOne: Record<string, CompareSlotted[]>; // person id -> sessions nobody else has
  starredByOthers: (CompareSession & { personIds: string[]; slotId: string | null })[]; // slotId: the first person's slot, or null if only starred
}

// The single deep module the UI talks to. All methods are synchronous inside the worker;
// through the Comlink proxy the UI sees them as Promises.
export interface PlannerApi {
  meta(): CatalogMeta;
  vocabulary(): Vocabulary;
  session(key: string): Session | null;

  getProfile(): Profile | null;
  importProfile(json: string): Result<Profile>;
  exportProfile(): string;
  updateProfile(profile: Profile): Result<Profile>;
  copyPrompt(draft?: ProfileDraft): string; // with a draft: bakes the builder's choices in as fixed fields
  profileDraft(): ProfileDraft; // builder pre-fill from the active profile (or defaults)
  profileFromDraft(draft: ProfileDraft): Result<Profile>; // deterministic, no LLM; does not save

  rank(filters: Filters): RankedSession[];
  explain(sessionKey: string): RankedSession | null;
  setManualScore(sessionKey: string, score: number | null): void; // 0..100, rounded; null clears
  manualScores(): Record<string, number>;

  agenda(): AgendaItem[];
  starred(): string[];
  star(sessionKey: string): void;
  unstar(sessionKey: string): void;
  addSlot(slotId: string): AgendaItem;
  removeItem(itemId: string): void;
  setPinned(itemId: string, pinned: boolean): void;
  slotFit(slotId: string): SlotFit;

  autoBuild(): AutoBuildResult;
  conflicts(): Conflict[];
  daySummaries(): DaySummary[];
  alternatives(ref: { slotId: string } | { sessionKey: string }): Alternative[];

  personalBlocks(): PersonalBlock[];
  createBlock(block: Omit<PersonalBlock, 'id'>): PersonalBlock;
  updateBlock(block: PersonalBlock): void;
  deleteBlock(id: string): void;

  travelTable(): TravelTable;
  setTravel(a: VenueId, b: VenueId, minutes: number): void;

  settings(): Settings;
  updateSettings(settings: Settings): void;

  reservationChecklist(): ChecklistItem[];
  setReservationStatus(itemId: string, status: ReservationStatus): void;

  detectChanges(): ChangeAlert[]; // active (non-dismissed) alerts
  dismissAlert(id: string): void;
  acceptChange(alertId: string): void; // re-fingerprints the item

  exportIcs(options: IcsOptions): string;
  exportState(): string;
  importState(json: string): Result<null>;
  exportAgenda(): string; // agenda, stars, manual scores and personal blocks only (no profile or settings)
  importAgenda(json: string, options: AgendaImportOptions): Result<AgendaImportReport>;

  // Profiles library. Activating an entry swaps the active profile only; the agenda stays intact.
  profiles(): ProfileEntrySummary[];
  saveProfileAs(name: string): ProfileEntrySummary;
  parseProfile(json: string): Result<Profile>; // validates only, does not save
  // Makes an incoming profile (import or builder) the active one without losing the current one. 'new' saves it as a
  // new entry named `name` (de-duplicated); 'replace' overwrites the active entry and keeps the old profile as "<name> (previous)".
  importProfileAs(profile: Profile, options: { mode: 'new' | 'replace'; name?: string }): Result<ProfileEntrySummary>;
  activateProfile(id: string): void;
  renameProfile(id: string, name: string): void;
  duplicateProfile(id: string): ProfileEntrySummary;
  deleteProfile(id: string): void;

  // Sharing: my profile + plan for friends; importing a friend's file never touches my profile or agenda.
  exportSharedPlan(displayName: string): string;
  importSharedPlan(json: string, nameOverride?: string): Result<ProfileEntrySummary>; // also accepts a plain agenda export (name required)
  compare(personIds: string[]): CompareResult; // ME = my live state; other ids are entries with a plan
}

// Where the user store lives: 'persistent' = OPFS (survives reloads); 'memory' = OPFS unavailable or ?memory=1;
// 'inactive' = another tab owns the OPFS store, so this tab is read-only until the user clicks "Use here".
export interface StorageStatus {
  mode: 'persistent' | 'memory' | 'inactive';
  reason: string | null;
}

export interface WorkerInitOptions {
  forceMemory?: boolean; // skip OPFS and use the in-memory store (the UI sets it for ?memory=1)
}

// What src/worker/planner.worker.ts exposes via Comlink. `init()` loads the catalog snapshot
// (/catalog.sqlite3) and the OPFS user store; it must resolve before any other call.
// watchStorage() registers the one listener for status changes and returns the current status; useHere() takes the store
// back from another tab.
export type WorkerApi = PlannerApi & {
  init(options?: WorkerInitOptions): Promise<void>;
  storageStatus(): StorageStatus;
  watchStorage(listener: (status: StorageStatus) => void): StorageStatus;
  useHere(): Promise<void>;
};
