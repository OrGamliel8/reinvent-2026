// Catalog Repository: read-only queries over a catalog DB built by the Catalog Pipeline.
// The whole catalog is loaded in memory and replaced wholesale on refresh (open a new repository).
import { openDbFromBytes, type Db, type Sqlite3 } from '../sqlite';
import { VENUES, type CatalogMeta, type DayId, type Session, type Slot, type TagKind, type VenueId, type Vocabulary } from '../types';

type Row = Record<string, string | number | null>;

const TAG_FIELD: Record<TagKind, 'topics' | 'services' | 'areasOfInterest' | 'roles' | 'industries' | 'features'> = {
  topic: 'topics',
  service: 'services',
  areaOfInterest: 'areasOfInterest',
  role: 'roles',
  industry: 'industries',
  feature: 'features',
};

// bm25 column weights: key, codes, title, abstract, speakers, tags
const BM25 = 'bm25(session_fts, 0, 5, 10, 2, 3, 4)';

export class CatalogRepository {
  private readonly db: Db;
  private readonly allSessions: Session[];
  private readonly byKey: Map<string, Session>;
  private readonly bySlotId: Map<string, Slot>;

  private constructor({ db }: { db: Db }) {
    this.db = db;
    this.allSessions = this.loadSessions();
    this.byKey = new Map(this.allSessions.map((s) => [s.key, s]));
    this.bySlotId = new Map(this.allSessions.flatMap((s) => s.slots.map((slot) => [slot.slotId, slot] as const)));
  }

  static open({ sqlite3, bytes }: { sqlite3: Sqlite3; bytes: Uint8Array }): CatalogRepository {
    return new CatalogRepository({ db: openDbFromBytes(sqlite3, bytes, { readOnly: true }) });
  }

  close(): void {
    this.db.close();
  }

  meta(): CatalogMeta {
    const rows = this.db.selectObjects('SELECT key, value FROM meta') as Row[];
    const meta = Object.fromEntries(rows.map((r) => [r.key, r.value])) as Record<string, string | null>;
    return {
      sourceUrl: meta.sourceUrl ?? '',
      fetchedAt: meta.fetchedAt ?? '',
      etag: meta.etag || null,
      sessionCount: Number(meta.sessionCount ?? 0),
      slotCount: Number(meta.slotCount ?? 0),
    };
  }

  sessions(): Session[] {
    return this.allSessions;
  }

  session(key: string): Session | null {
    return this.byKey.get(key) ?? null;
  }

  slot(slotId: string): Slot | null {
    return this.bySlotId.get(slotId) ?? null;
  }

  vocabulary(): Vocabulary {
    const tags = this.db.selectObjects('SELECT kind, name FROM tag ORDER BY name COLLATE NOCASE') as Row[];
    const ofKind = (kind: TagKind): string[] => tags.filter((t) => t.kind === kind).map((t) => String(t.name));
    const venues = new Set(this.db.selectValues('SELECT DISTINCT venue FROM slot WHERE venue IS NOT NULL') as string[]);
    return {
      topics: ofKind('topic'),
      services: ofKind('service'),
      areasOfInterest: ofKind('areaOfInterest'),
      roles: ofKind('role'),
      industries: ofKind('industry'),
      features: ofKind('feature'),
      types: this.db.selectValues('SELECT DISTINCT type FROM session ORDER BY type') as string[],
      levels: (this.db.selectValues('SELECT DISTINCT level FROM session WHERE level IS NOT NULL ORDER BY level') as number[]).map(Number),
      venues: VENUES.map((v) => v.id).filter((id) => venues.has(id)),
    };
  }

  // Relevance (positive, higher = better) of each session for one keyword or phrase, over title/abstract/speakers/tags.
  matchKeyword(keyword: string): Map<string, number> {
    const phrase = tokens(keyword).join(' ');
    if (!phrase) return new Map();
    return this.match(`{title abstract speakers tags} : "${phrase}"`);
  }

  // Free-text search (every word as a prefix, all must match) over codes, title, abstract, speakers and tags.
  search(text: string): Map<string, number> {
    const words = tokens(text);
    if (!words.length) return new Map();
    return this.match(words.map((w) => `"${w}"*`).join(' '));
  }

  private match(expression: string): Map<string, number> {
    try {
      const rows = this.db.selectArrays(`SELECT key, -${BM25} FROM session_fts WHERE session_fts MATCH ?`, [expression]);
      return new Map(rows.map(([key, score]) => [String(key), Number(score)]));
    } catch {
      return new Map();
    }
  }

  private loadSessions(): Session[] {
    const slots = new Map<string, Slot[]>();
    for (const r of this.db.selectObjects('SELECT * FROM slot ORDER BY start_utc IS NULL, start_utc, code') as Row[]) {
      const slot: Slot = {
        slotId: String(r.slot_id),
        code: String(r.code),
        sessionKey: String(r.session_key),
        start: (r.start_utc as string | null) ?? null,
        end: (r.end_utc as string | null) ?? null,
        day: (r.day as DayId | null) ?? null,
        venue: (r.venue as VenueId | null) ?? null,
        room: (r.room as string | null) ?? null,
        seats: r.seats === null ? null : Number(r.seats),
        hash: String(r.hash),
        lastModified: String(r.last_modified),
      };
      slots.set(slot.sessionKey, [...(slots.get(slot.sessionKey) ?? []), slot]);
    }

    const sessions = new Map<string, Session>();
    for (const r of this.db.selectObjects('SELECT * FROM session ORDER BY code') as Row[]) {
      const sessionSlots = slots.get(String(r.key)) ?? [];
      sessions.set(String(r.key), {
        key: String(r.key),
        code: String(r.code),
        title: String(r.title),
        abstract: String(r.abstract),
        level: r.level === null ? null : Number(r.level),
        type: String(r.type),
        topics: [],
        services: [],
        areasOfInterest: [],
        roles: [],
        industries: [],
        features: [],
        speakers: [],
        slots: sessionSlots,
        tba: !sessionSlots.some((s) => s.start),
      });
    }

    const speakerRows = this.db.selectObjects(
      'SELECT ss.session_key, sp.name, sp.company FROM session_speaker ss JOIN speaker sp ON sp.id = ss.speaker_id ORDER BY ss.session_key, ss.ord',
    ) as Row[];
    for (const r of speakerRows) sessions.get(String(r.session_key))?.speakers.push({ name: String(r.name), company: (r.company as string | null) ?? null });

    const tagRows = this.db.selectObjects('SELECT st.session_key, t.kind, t.name FROM session_tag st JOIN tag t ON t.id = st.tag_id ORDER BY st.rowid') as Row[];
    for (const r of tagRows) sessions.get(String(r.session_key))?.[TAG_FIELD[r.kind as TagKind]].push(String(r.name));

    return [...sessions.values()];
  }
}

function tokens(text: string): string[] {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}
