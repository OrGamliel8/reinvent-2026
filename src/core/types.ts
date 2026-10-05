// Shared contracts between the Planner core and the UI.
// The UI talks ONLY to the `PlannerApi` below (through a Web Worker proxy in the browser).

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
  score: number;
  explanation: MatchExplanation;
  starred: boolean;
  onAgenda: boolean;
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

export type ConflictKind = 'overlap' | 'travel' | 'availability' | 'lunch' | 'dailyMax';

export interface Conflict {
  itemId: string;
  kind: ConflictKind;
  withId: string | null; // the other agenda item or personal block id
  message: string;
  alternatives: Alternative[];
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

export interface IcsOptions {
  includePersonal: boolean;
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
  copyPrompt(): string;

  rank(filters: Filters): RankedSession[];
  explain(sessionKey: string): RankedSession | null;

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
}

// What src/worker/planner.worker.ts exposes via Comlink. `init()` loads the catalog snapshot
// (/catalog.sqlite3) and the OPFS user store; it must resolve before any other call.
export type WorkerApi = PlannerApi & { init(): Promise<void> };
