// Planner core: the single deep module the UI talks to. Opened with a Catalog Repository and a User Store.
import type { CatalogRepository } from './catalog/catalogRepository';
import { DEFAULT_RECORDED, DEFAULT_SETTINGS, DEFAULT_TRAVEL, HANDS_ON_TYPES, KEYNOTE_PRESETS, travelKey, venueName } from './defaults';
import { buildAgendaExport, importBlocks, resolveAgendaImport } from './planning/agendaTransfer';
import { autoBuild } from './planning/autoBuild';
import { buildIcs } from './planning/ics';
import { scoreSessions, type ScoredSession } from './planning/ranking';
import { blockEvent, describeSlot, findProblems, fingerprintOf, fitOf, sameFingerprint, slotEvent, type PlanningContext, type TimedEvent } from './planning/schedule';
import { buildCopyPrompt, buildDraftPrompt } from './profile/copyPrompt';
import { draftFromProfile, profileFromDraft } from './profile/draft';
import { defaultProfile, parseJson, parseProfileJson, toValidationErrors, validateProfile } from './profile/schema';
import { AgendaExportSchema, PersonalBlockSchema, SettingsSchema, STATE_KIND, StateSchema } from './stateSchema';
import { restoreStore, snapshotStore, type UserStore } from './store/userStore';
import { lvTime } from './time';
import {
  type AgendaImportOptions,
  type AgendaImportReport,
  type AgendaItem,
  type Alternative,
  type AutoBuildResult,
  type CatalogMeta,
  type ChangeAlert,
  type ChecklistItem,
  type Conflict,
  type Filters,
  type IcsOptions,
  type PersonalBlock,
  type PlannerApi,
  type Profile,
  type ProfileDraft,
  type RankedSession,
  type ReservationStatus,
  type Result,
  type Session,
  type Settings,
  type Slot,
  type SlotFingerprint,
  type SlotFit,
  type TravelTable,
  type VenueId,
  type Vocabulary,
} from './types';

const FIT_ORDER: Record<SlotFit, number> = { free: 0, travel: 1, outside: 2, conflict: 3, tba: 4 };
const MAX_OTHER_SESSIONS = 5;

export class Planner implements PlannerApi {
  private readonly catalog: CatalogRepository;
  private readonly store: UserStore;
  private scoreCache: { key: string; scores: Map<string, ScoredSession> } | null = null;
  private readonly localTimes = new Map<string, { start: string; end: string }>();

  private constructor({ catalog, store }: { catalog: CatalogRepository; store: UserStore }) {
    this.catalog = catalog;
    this.store = store;
  }

  static open({ catalog, store }: { catalog: CatalogRepository; store: UserStore }): Planner {
    const planner = new Planner({ catalog, store });
    if (!store.isSeeded()) {
      for (const preset of KEYNOTE_PRESETS) store.putBlock({ ...preset, id: newId() });
      store.markSeeded();
    }
    return planner;
  }

  // ---------- Catalog ----------

  meta(): CatalogMeta {
    return this.catalog.meta();
  }

  vocabulary(): Vocabulary {
    return this.catalog.vocabulary();
  }

  session(key: string): Session | null {
    return this.catalog.session(key);
  }

  // ---------- Profile ----------

  getProfile(): Profile | null {
    return this.store.getProfile();
  }

  importProfile(json: string): Result<Profile> {
    return this.saveProfile(parseProfileJson(json));
  }

  updateProfile(profile: Profile): Result<Profile> {
    return this.saveProfile(validateProfile(profile));
  }

  exportProfile(): string {
    return JSON.stringify(this.store.getProfile() ?? defaultProfile(), null, 2);
  }

  copyPrompt(draft?: ProfileDraft): string {
    return draft ? buildDraftPrompt(this.catalog.vocabulary(), draft) : buildCopyPrompt(this.catalog.vocabulary());
  }

  profileDraft(): ProfileDraft {
    return draftFromProfile(this.store.getProfile(), this.catalog.vocabulary(), this.settings().recorded);
  }

  profileFromDraft(draft: ProfileDraft): Result<Profile> {
    return profileFromDraft(draft);
  }

  private saveProfile(result: Result<Profile>): Result<Profile> {
    if (result.ok) this.store.setProfile(result.value);
    return result;
  }

  // ---------- Ranking ----------

  rank(filters: Filters): RankedSession[] {
    const scores = this.scores();
    const stars = new Set(this.store.getStars());
    const items = this.store.getItems();
    const onAgenda = new Set(items.map((i) => i.sessionKey));
    const hits = filters.q?.trim() ? this.catalog.search(filters.q) : null;
    const events = filters.hideConflicting ? this.planEvents(items) : [];
    const ctx = this.ctx();
    const slotFiltered = !!(filters.days?.length || filters.venues?.length || filters.timeFrom || filters.timeTo);

    const ranked: RankedSession[] = [];
    for (const session of this.catalog.sessions()) {
      const scored = scores.get(session.key)!;
      if (!filters.showAvoided && scored.explanation.avoided.length) continue;
      if (hits && !hits.has(session.key)) continue;
      if (!matchesTags(session, filters)) continue;
      if (slotFiltered && !session.slots.some((slot) => this.slotMatches(slot, filters))) continue;
      if (filters.starredOnly && !stars.has(session.key)) continue;
      if (filters.onAgendaOnly && !onAgenda.has(session.key)) continue;
      if (filters.tbaOnly && !session.tba) continue;
      if (filters.hideConflicting && !onAgenda.has(session.key) && !session.tba && !session.slots.some((slot) => this.fitAgainst(slot, events, ctx) === 'free')) {
        continue;
      }
      ranked.push({ session, score: scored.score, explanation: scored.explanation, starred: stars.has(session.key), onAgenda: onAgenda.has(session.key) });
    }
    sortRanked(ranked, filters.sort ?? { by: 'score', dir: 'desc' });
    return filters.limit ? ranked.slice(0, filters.limit) : ranked;
  }

  explain(sessionKey: string): RankedSession | null {
    const session = this.catalog.session(sessionKey);
    const scored = this.scores().get(sessionKey);
    if (!session || !scored) return null;
    const items = this.store.getItems();
    return {
      session,
      score: scored.score,
      explanation: scored.explanation,
      starred: this.store.getStars().includes(sessionKey),
      onAgenda: items.some((i) => i.sessionKey === sessionKey),
    };
  }

  private scores(): Map<string, ScoredSession> {
    const profile = this.store.getProfile();
    const settings = this.settings();
    const key = JSON.stringify([profile, settings.weights, settings.recorded]);
    if (this.scoreCache?.key !== key) this.scoreCache = { key, scores: scoreSessions({ catalog: this.catalog, profile, settings }) };
    return this.scoreCache.scores;
  }

  private slotMatches(slot: Slot, filters: Filters): boolean {
    if (!slot.start || !slot.end) return false;
    if (filters.days?.length && !(slot.day && filters.days.includes(slot.day))) return false;
    if (filters.venues?.length && !(slot.venue && filters.venues.includes(slot.venue))) return false;
    const local = this.localTime(slot);
    if (filters.timeFrom && local.start < filters.timeFrom) return false;
    if (filters.timeTo && local.end > filters.timeTo) return false;
    return true;
  }

  private localTime(slot: Slot): { start: string; end: string } {
    let local = this.localTimes.get(slot.slotId);
    if (!local) {
      local = { start: lvTime(slot.start!), end: lvTime(slot.end!) };
      this.localTimes.set(slot.slotId, local);
    }
    return local;
  }

  // ---------- Agenda ----------

  agenda(): AgendaItem[] {
    return this.store.getItems().sort((a, b) => this.itemStart(a) - this.itemStart(b));
  }

  starred(): string[] {
    return this.store.getStars();
  }

  star(sessionKey: string): void {
    const session = this.requireSession(sessionKey);
    this.store.setStar(sessionKey, true);
    if (session.tba) this.watchTba(sessionKey, true);
  }

  unstar(sessionKey: string): void {
    this.store.setStar(sessionKey, false);
    this.watchTba(sessionKey, false);
  }

  addSlot(slotId: string): AgendaItem {
    const slot = this.catalog.slot(slotId);
    if (!slot) throw new Error(`Unknown slot: ${slotId}`);
    if (!slot.start) throw new Error(`Slot ${slot.code} has no time yet (TBA)`);
    const session = this.requireSession(slot.sessionKey);
    const existing = this.store.getItems().find((i) => i.sessionKey === slot.sessionKey);
    const origin = existing && existing.origin !== 'suggested' ? existing.origin : 'manual';
    const item: AgendaItem =
      existing?.slotId === slotId
        ? { ...existing, origin }
        : {
            id: existing?.id ?? newId(),
            sessionKey: session.key,
            slotId,
            origin,
            pinned: existing?.pinned ?? false,
            fingerprint: fingerprintOf(slot),
            reservation: 'none',
            title: session.title,
            code: session.code,
          };
    this.store.putItem(item);
    this.watchTba(session.key, false);
    return item;
  }

  removeItem(itemId: string): void {
    this.store.deleteItem(itemId);
  }

  setPinned(itemId: string, pinned: boolean): void {
    this.store.putItem({ ...this.requireItem(itemId), pinned });
  }

  slotFit(slotId: string): SlotFit {
    const slot = this.catalog.slot(slotId);
    if (!slot) throw new Error(`Unknown slot: ${slotId}`);
    const events = this.planEvents(this.store.getItems().filter((i) => i.sessionKey !== slot.sessionKey));
    return this.fitAgainst(slot, events, this.ctx());
  }

  private fitAgainst(slot: Slot, events: TimedEvent[], ctx: PlanningContext): SlotFit {
    const event = slotEvent(slot, { id: `candidate:${slot.slotId}`, title: slot.code });
    return event ? fitOf(findProblems(event, events, ctx, 'place')) : 'tba';
  }

  // ---------- Planning ----------

  autoBuild(): AutoBuildResult {
    const blocks = this.store.getBlocks().flatMap((b) => blockEvent(b) ?? []);
    const result = autoBuild({
      catalog: this.catalog,
      items: this.store.getItems(),
      stars: this.store.getStars(),
      blocks,
      scores: this.scores(),
      ctx: this.ctx(),
      newId,
    });
    this.store.replaceItems(result.agenda);
    return result;
  }

  conflicts(): Conflict[] {
    const items = this.agenda();
    const events = this.planEvents(items);
    const ctx = this.ctx();
    const alternatives = new Map<string, Alternative[]>();
    const conflicts: Conflict[] = [];
    for (const item of items) {
      const event = events.find((e) => e.id === item.id);
      if (!event) continue;
      for (const problem of findProblems(event, events, ctx, 'audit')) {
        if (!alternatives.has(item.slotId)) alternatives.set(item.slotId, this.alternatives({ slotId: item.slotId }));
        conflicts.push({ itemId: item.id, kind: problem.kind, withId: problem.withId, message: problem.message, alternatives: alternatives.get(item.slotId)! });
      }
    }
    return conflicts;
  }

  alternatives(ref: { slotId: string } | { sessionKey: string }): Alternative[] {
    const items = this.store.getItems();
    const refItem = 'slotId' in ref ? items.find((i) => i.slotId === ref.slotId) : items.find((i) => i.sessionKey === ref.sessionKey);
    const refSlotId = 'slotId' in ref ? ref.slotId : (refItem?.slotId ?? null);
    const refSlot = refSlotId ? this.catalog.slot(refSlotId) : null;
    const sessionKey = 'sessionKey' in ref ? ref.sessionKey : (refSlot?.sessionKey ?? refItem?.sessionKey);
    if (!sessionKey) return [];

    const window = refSlot?.start ? refSlot : refItem?.fingerprint.start ? refItem.fingerprint : null;
    const events = this.planEvents(items.filter((i) => i.sessionKey !== sessionKey));
    const ctx = this.ctx();
    const scores = this.scores();
    const toAlternative = (kind: Alternative['kind'], session: Session, slot: Slot): Alternative => ({
      kind,
      sessionKey: session.key,
      slotId: slot.slotId,
      title: session.title,
      code: slot.code,
      start: slot.start!,
      end: slot.end!,
      venue: slot.venue,
      score: scores.get(session.key)?.score ?? 0,
      fit: this.fitAgainst(slot, events, ctx),
    });

    const session = this.catalog.session(sessionKey);
    const otherSlots = (session?.slots ?? [])
      .filter((slot) => slot.start && slot.slotId !== refSlotId)
      .map((slot) => toAlternative('otherSlot', session!, slot))
      .sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || a.start.localeCompare(b.start));
    if (!window?.start || !window.end) return otherSlots;

    const [windowStart, windowEnd] = [Date.parse(window.start), Date.parse(window.end)];
    const onAgenda = new Set(items.map((i) => i.sessionKey));
    const otherSessions: Alternative[] = [];
    for (const candidate of this.catalog.sessions()) {
      if (candidate.key === sessionKey || onAgenda.has(candidate.key) || scores.get(candidate.key)?.explanation.avoided.length) continue;
      const inWindow = candidate.slots
        .filter((slot) => slot.start && slot.end && Date.parse(slot.start) < windowEnd && windowStart < Date.parse(slot.end))
        .map((slot) => toAlternative('otherSession', candidate, slot))
        .sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit]);
      if (inWindow.length) otherSessions.push(inWindow[0]);
    }
    otherSessions.sort((a, b) => FIT_ORDER[a.fit] - FIT_ORDER[b.fit] || b.score - a.score || a.code.localeCompare(b.code));
    return [...otherSlots, ...otherSessions.slice(0, MAX_OTHER_SESSIONS)];
  }

  // ---------- Personal blocks ----------

  personalBlocks(): PersonalBlock[] {
    return this.store.getBlocks();
  }

  createBlock(block: Omit<PersonalBlock, 'id'>): PersonalBlock {
    const created = parseBlock({ ...block, id: newId() });
    this.store.putBlock(created);
    return created;
  }

  updateBlock(block: PersonalBlock): void {
    if (!this.store.getBlocks().some((b) => b.id === block.id)) throw new Error(`Unknown block: ${block.id}`);
    this.store.putBlock(parseBlock(block));
  }

  deleteBlock(id: string): void {
    this.store.deleteBlock(id);
  }

  // ---------- Travel & settings ----------

  travelTable(): TravelTable {
    return { ...DEFAULT_TRAVEL, ...this.store.getTravel() };
  }

  setTravel(a: VenueId, b: VenueId, minutes: number): void {
    if (a === b) throw new Error('Travel time within the same venue is always 0');
    if (!Number.isFinite(minutes) || minutes < 0) throw new Error('Travel minutes must be a number >= 0');
    this.store.setTravel({ ...this.travelTable(), [travelKey(a, b)]: Math.round(minutes) });
  }

  settings(): Settings {
    const stored = this.store.getSettings();
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      weights: { ...DEFAULT_SETTINGS.weights, ...stored?.weights },
      recorded: { ...DEFAULT_RECORDED, ...stored?.recorded },
    };
  }

  updateSettings(settings: Settings): void {
    const parsed = SettingsSchema.safeParse(settings);
    if (!parsed.success) throw new Error(toValidationErrors(parsed.error, 'settings').map((e) => `${e.path}: ${e.message}`).join('; '));
    this.store.setSettings(parsed.data);
  }

  // ---------- Reservations ----------

  reservationChecklist(): ChecklistItem[] {
    const scores = this.scores();
    const stars = new Set(this.store.getStars());
    const checklist: ChecklistItem[] = [];
    for (const item of this.store.getItems()) {
      const slot = this.catalog.slot(item.slotId);
      const session = this.catalog.session(item.sessionKey);
      if (!slot?.start || !session) continue;
      const seatFactor = slot.seats ? clamp01(1 - Math.log(slot.seats / 50) / Math.log(1000 / 50)) : 0.5;
      const slotFactor = 1 / Math.max(1, session.slots.filter((s) => s.start).length);
      const handsOn = HANDS_ON_TYPES.has(session.type) || session.features.includes('Hands-on') ? 1 : 0;
      const scarcity = Math.round(100 * (0.45 * seatFactor + 0.3 * slotFactor + 0.25 * handsOn));
      const intent = item.pinned ? 1 : item.origin !== 'suggested' || stars.has(session.key) ? 0.8 : 0.5;
      const priority = Math.round(100 * (0.5 * intent + 0.5 * ((scores.get(session.key)?.score ?? 0) / 100)));
      checklist.push({
        itemId: item.id,
        sessionKey: session.key,
        code: slot.code,
        title: session.title,
        slot,
        scarcity,
        priority,
        status: item.reservation,
        alternatives: item.reservation === 'failed' ? this.alternatives({ slotId: slot.slotId }) : [],
      });
    }
    return checklist.sort((a, b) => b.priority * b.scarcity - a.priority * a.scarcity || a.slot.start!.localeCompare(b.slot.start!));
  }

  setReservationStatus(itemId: string, status: ReservationStatus): void {
    this.store.putItem({ ...this.requireItem(itemId), reservation: status });
  }

  // ---------- Change detection ----------

  detectChanges(): ChangeAlert[] {
    const watch = new Set(this.store.getTbaWatch());
    const tbaStars = this.store.getStars().filter((key) => this.catalog.session(key)?.tba && !watch.has(key));
    if (tbaStars.length) this.store.setTbaWatch([...watch, ...tbaStars]);
    const dismissed = new Set(this.store.getDismissedAlerts());
    return this.computeAlerts().filter((a) => !dismissed.has(a.id));
  }

  dismissAlert(id: string): void {
    this.store.addDismissedAlert(id);
  }

  acceptChange(alertId: string): void {
    const alert = this.computeAlerts().find((a) => a.id === alertId);
    if (!alert) throw new Error(`Unknown alert: ${alertId}`);
    if (alert.kind === 'tbaScheduled') return this.watchTba(alert.sessionKey, false);
    const item = this.requireItem(alert.itemId!);
    if (alert.kind === 'cancelled' || alert.kind === 'removed') return this.store.deleteItem(item.id);
    this.store.putItem({ ...item, fingerprint: fingerprintOf(this.catalog.slot(item.slotId)) });
  }

  private computeAlerts(): ChangeAlert[] {
    const items = this.agenda();
    const events = this.planEvents(items);
    const ctx = this.ctx();
    const alerts: ChangeAlert[] = [];
    for (const item of items) {
      const slot = this.catalog.slot(item.slotId);
      const session = this.catalog.session(item.sessionKey);
      const title = session?.title ?? item.title ?? item.sessionKey;
      const base = { itemId: item.id, sessionKey: item.sessionKey, title, before: item.fingerprint };
      if (!slot) {
        const kind = session ? 'cancelled' : 'removed';
        const label = item.code ?? item.sessionKey;
        const message = session ? `This slot of ${label} was cancelled; other slots may still fit` : `${label} "${title}" was removed from the catalog`;
        alerts.push({ ...base, id: `${kind}:${item.id}`, kind, message, after: fingerprintOf(null) });
        continue;
      }
      const after = fingerprintOf(slot);
      if (sameFingerprint(after, item.fingerprint)) continue;
      alerts.push({ ...base, id: `moved:${item.id}:${fingerprintKey(after)}`, kind: 'moved', message: `${slot.code} moved: ${describeMove(item.fingerprint, after)}`, after });
      const event = events.find((e) => e.id === item.id);
      const problems = event ? findProblems(event, events, ctx, 'place') : [];
      if (problems.length) {
        alerts.push({ ...base, id: `newConflict:${item.id}:${fingerprintKey(after)}`, kind: 'newConflict', message: problems.map((p) => p.message).join('; '), after });
      }
    }

    const stars = new Set(this.store.getStars());
    const onAgenda = new Set(items.map((i) => i.sessionKey));
    for (const key of this.store.getTbaWatch()) {
      const session = this.catalog.session(key);
      const slot = session?.slots.find((s) => s.start);
      if (!session || !slot || !stars.has(key) || onAgenda.has(key)) continue;
      const after = fingerprintOf(slot);
      alerts.push({
        id: `tbaScheduled:${key}:${fingerprintKey(after)}`,
        kind: 'tbaScheduled',
        itemId: null,
        sessionKey: key,
        title: session.title,
        message: `${session.code} now has a time: ${describeSlot(after)}`,
        before: null,
        after,
      });
    }
    return alerts;
  }

  // ---------- Export / import ----------

  exportIcs(options: IcsOptions): string {
    const sessions = this.agenda().flatMap((item) => {
      const slot = this.catalog.slot(item.slotId);
      const session = this.catalog.session(item.sessionKey);
      return slot?.start && session ? [{ uid: item.id, session, slot }] : [];
    });
    const blocks = options.includePersonal ? this.store.getBlocks().filter((b) => b.enabled) : [];
    return buildIcs({ sessions, blocks, now: new Date() });
  }

  exportState(): string {
    return JSON.stringify({ kind: STATE_KIND, version: 1, exportedAt: new Date().toISOString(), ...snapshotStore(this.store) }, null, 2);
  }

  importState(json: string): Result<null> {
    const raw = parseJson(json);
    if (!raw.ok) return raw;
    const parsed = StateSchema.safeParse(raw.value);
    if (!parsed.success) return { ok: false, errors: toValidationErrors(parsed.error) };
    const { profile, settings, travel, items, stars, blocks, dismissedAlerts, tbaWatch } = parsed.data;
    restoreStore(this.store, { profile: profile as Profile | null, settings, travel, items, stars, blocks, dismissedAlerts, tbaWatch });
    this.scoreCache = null;
    return { ok: true, value: null };
  }

  exportAgenda(): string {
    const payload = buildAgendaExport({ catalog: this.catalog, items: this.agenda(), stars: this.store.getStars(), blocks: this.store.getBlocks() });
    return JSON.stringify(payload, null, 2);
  }

  // Never touches the profile or settings.
  importAgenda(json: string, options: AgendaImportOptions): Result<AgendaImportReport> {
    const raw = parseJson(json);
    if (!raw.ok) return raw;
    const parsed = AgendaExportSchema.safeParse(raw.value);
    if (!parsed.success) return { ok: false, errors: toValidationErrors(parsed.error) };

    const replace = options.mode === 'replace';
    const { items, stars, report } = resolveAgendaImport({ catalog: this.catalog, payload: parsed.data, existing: replace ? [] : this.store.getItems(), newId });
    this.store.replaceItems(items);
    for (const item of items) this.watchTba(item.sessionKey, false);
    if (replace) for (const key of this.store.getStars()) this.unstar(key);
    for (const key of stars) this.star(key);

    let blocks = 0;
    if (options.includeBlocks) {
      const { put, remove } = importBlocks({ existing: this.store.getBlocks(), imported: parsed.data.blocks, mode: options.mode, newId });
      for (const id of remove) this.store.deleteBlock(id);
      for (const block of put) this.store.putBlock(block);
      blocks = put.length;
    }
    return { ok: true, value: { ...report, blocks } };
  }

  // ---------- Helpers ----------

  private ctx(): PlanningContext {
    return { travel: this.travelTable(), availability: this.store.getProfile()?.availability ?? null };
  }

  private planEvents(items: AgendaItem[]): TimedEvent[] {
    const itemEvents = items.flatMap((item) => {
      const slot = this.catalog.slot(item.slotId);
      const event = slot ? slotEvent(slot, { id: item.id, title: this.catalog.session(item.sessionKey)?.title ?? item.title ?? item.sessionKey }) : null;
      return event ? [event] : [];
    });
    return [...itemEvents, ...this.store.getBlocks().flatMap((b) => blockEvent(b) ?? [])];
  }

  private itemStart(item: AgendaItem): number {
    const start = this.catalog.slot(item.slotId)?.start ?? item.fingerprint.start;
    return start ? Date.parse(start) : Number.MAX_SAFE_INTEGER;
  }

  private requireSession(key: string): Session {
    const session = this.catalog.session(key);
    if (!session) throw new Error(`Unknown session: ${key}`);
    return session;
  }

  private requireItem(itemId: string): AgendaItem {
    const item = this.store.getItems().find((i) => i.id === itemId);
    if (!item) throw new Error(`Unknown agenda item: ${itemId}`);
    return item;
  }

  private watchTba(sessionKey: string, watched: boolean): void {
    const watch = this.store.getTbaWatch().filter((key) => key !== sessionKey);
    this.store.setTbaWatch(watched ? [...watch, sessionKey] : watch);
  }
}

function newId(): string {
  return crypto.randomUUID();
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parseBlock(block: PersonalBlock): PersonalBlock {
  const parsed = PersonalBlockSchema.safeParse(block);
  if (!parsed.success) throw new Error(toValidationErrors(parsed.error, 'block').map((e) => `${e.path}: ${e.message}`).join('; '));
  return parsed.data;
}

function matchesTags(session: Session, filters: Filters): boolean {
  const anyOf = (wanted: string[] | undefined, values: string[]): boolean => !wanted?.length || wanted.some((w) => values.includes(w));
  return (
    anyOf(filters.types, [session.type]) &&
    (!filters.levels?.length || (session.level !== null && filters.levels.includes(session.level))) &&
    anyOf(filters.topics, session.topics) &&
    anyOf(filters.services, session.services) &&
    anyOf(filters.roles, session.roles) &&
    anyOf(filters.industries, session.industries) &&
    anyOf(filters.features, session.features)
  );
}

function sortRanked(list: RankedSession[], sort: NonNullable<Filters['sort']>): void {
  const firstSlot = (s: Session): Slot | undefined => s.slots.find((slot) => slot.start);
  const value = (r: RankedSession): number | string | null => {
    switch (sort.by) {
      case 'score':
        return r.score;
      case 'time':
        return firstSlot(r.session)?.start ?? null;
      case 'level':
        return r.session.level;
      case 'venue': {
        const venue = firstSlot(r.session)?.venue;
        return venue ? venueName(venue) : null;
      }
      case 'seats': {
        const seats = r.session.slots.map((s) => s.seats).filter((n): n is number => n !== null);
        return seats.length ? Math.max(...seats) : null;
      }
    }
  };
  const direction = sort.dir === 'asc' ? 1 : -1;
  const keyed = list.map((r) => ({ r, v: value(r) }));
  keyed.sort((a, b) => {
    if (a.v !== b.v) {
      if (a.v === null) return 1; // missing values last in either direction
      if (b.v === null) return -1;
      return (a.v < b.v ? -1 : 1) * direction;
    }
    return b.r.score - a.r.score || a.r.session.code.localeCompare(b.r.session.code);
  });
  keyed.forEach((k, i) => (list[i] = k.r));
}

function fingerprintKey(fp: SlotFingerprint): string {
  return [fp.start, fp.end, fp.venue, fp.room].map((v) => v ?? '').join('|');
}

function describeMove(before: SlotFingerprint, after: SlotFingerprint): string {
  return `${describeSlot(before)} → ${describeSlot(after)}`;
}
