// Catalog Pipeline core: raw catalog JSON -> bytes of a catalog SQLite DB. Runs identically in Node and the browser.
import { DEFAULT_RECORDED, VENUE_BY_NAME } from '../defaults';
import { exportDbBytes, type Db, type Sqlite3 } from '../sqlite';
import { lvDay } from '../time';
import type { TagKind } from '../types';
import type { CatalogSource, RawCatalog, RawEntry, RawNamed } from './rawCatalog';

export const CATALOG_SCHEMA_VERSION = '1';

const SCHEMA = `
CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE session (
  key TEXT PRIMARY KEY, code TEXT NOT NULL, title TEXT NOT NULL, abstract TEXT NOT NULL,
  level INTEGER, type TEXT NOT NULL, recorded INTEGER NOT NULL
);
CREATE TABLE slot (
  slot_id TEXT PRIMARY KEY, code TEXT NOT NULL, session_key TEXT NOT NULL REFERENCES session(key),
  start_utc TEXT, end_utc TEXT, day TEXT, venue TEXT, room TEXT, seats INTEGER,
  hash TEXT NOT NULL, last_modified TEXT NOT NULL
);
CREATE INDEX slot_session ON slot(session_key);
CREATE TABLE speaker (id INTEGER PRIMARY KEY, name TEXT NOT NULL, company TEXT, UNIQUE(name, company));
CREATE TABLE session_speaker (session_key TEXT NOT NULL, speaker_id INTEGER NOT NULL, ord INTEGER NOT NULL, PRIMARY KEY (session_key, speaker_id));
CREATE TABLE tag (id INTEGER PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, UNIQUE(kind, name));
CREATE TABLE session_tag (session_key TEXT NOT NULL, tag_id INTEGER NOT NULL, PRIMARY KEY (session_key, tag_id));
CREATE VIRTUAL TABLE session_fts USING fts5(
  key UNINDEXED, codes, title, abstract, speakers, tags,
  tokenize = 'porter unicode61 remove_diacritics 2'
);
`;

const TAG_FIELDS: [TagKind, keyof RawEntry][] = [
  ['topic', 'topics'],
  ['service', 'services'],
  ['areaOfInterest', 'areaOfInterest'],
  ['role', 'role'],
  ['industry', 'industry'],
  ['feature', 'features'],
];

export function baseCode(code: string): string {
  return code.replace(/-R\d*$/, '');
}

// Repeat grouping: connected components over `repeats` links (asymmetric links included);
// entries without `repeats` fall back to their base short code.
export function groupRepeats(entries: RawEntry[]): Map<string, RawEntry[]> {
  const parent = new Map<string, string>(entries.map((e) => [e.id, e.id]));
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== root) root = parent.get(root)!;
    parent.set(id, root);
    return root;
  };
  const union = (a: string, b: string): void => {
    parent.set(find(a), find(b));
  };

  const byBase = new Map<string, RawEntry[]>();
  for (const entry of entries) {
    const base = baseCode(entry.shortId);
    byBase.set(base, [...(byBase.get(base) ?? []), entry]);
    for (const repeat of entry.repeats ?? []) if (parent.has(repeat.id)) union(entry.id, repeat.id);
  }
  for (const entry of entries) {
    if (entry.repeats?.length) continue;
    for (const other of byBase.get(baseCode(entry.shortId)) ?? []) union(entry.id, other.id);
  }

  const components = new Map<string, RawEntry[]>();
  for (const entry of entries) {
    const root = find(entry.id);
    components.set(root, [...(components.get(root) ?? []), entry]);
  }

  const groups = new Map<string, RawEntry[]>();
  for (const members of components.values()) {
    const primary = primaryEntry(members);
    let key = baseCode(primary.shortId);
    for (let n = 2; groups.has(key); n++) key = `${baseCode(primary.shortId)}~${n}`;
    groups.set(key, [primary, ...members.filter((m) => m !== primary)]);
  }
  return groups;
}

function primaryEntry(members: RawEntry[]): RawEntry {
  const sorted = [...members].sort((a, b) => a.shortId.localeCompare(b.shortId));
  return sorted.find((m) => m.shortId === baseCode(m.shortId)) ?? sorted[0];
}

function names(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  return (values as RawNamed[]).map((v) => v?.displayName?.trim()).filter((v): v is string => !!v);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function buildCatalogDb(sqlite3: Sqlite3, raw: RawCatalog, source: CatalogSource): Uint8Array {
  if (!raw || !Array.isArray(raw.catalog)) throw new Error('Raw catalog must have a `catalog` array');
  const groups = groupRepeats(raw.catalog);
  const db = new sqlite3.oo1.DB(':memory:');
  try {
    db.exec(SCHEMA);
    let slotCount = 0;
    db.transaction(() => {
      const ids = { speakers: new Map<string, number>(), tags: new Map<string, number>() };
      for (const [key, members] of groups) slotCount += insertSession(db, key, members, ids);
      const meta: Record<string, string | null> = {
        sourceUrl: source.sourceUrl,
        fetchedAt: source.fetchedAt,
        etag: source.etag,
        sessionCount: String(groups.size),
        slotCount: String(slotCount),
        schemaVersion: CATALOG_SCHEMA_VERSION,
      };
      for (const [k, v] of Object.entries(meta)) db.exec('INSERT INTO meta VALUES (?, ?)', { bind: [k, v] });
    });
    db.exec("INSERT INTO session_fts(session_fts) VALUES ('optimize'); VACUUM;");
    return exportDbBytes(sqlite3, db);
  } finally {
    db.close();
  }
}

function insertSession(db: Db, key: string, members: RawEntry[], ids: { speakers: Map<string, number>; tags: Map<string, number> }): number {
  const primary = members[0];
  const type = primary.type?.displayName?.trim() || 'Unknown';
  db.exec('INSERT INTO session VALUES (?, ?, ?, ?, ?, ?, ?)', {
    bind: [key, baseCode(primary.shortId), primary.title.trim(), (primary.abstract ?? '').trim(), primary.level?.value ?? null, type, DEFAULT_RECORDED[type] ? 1 : 0],
  });

  for (const entry of members) {
    const start = entry.startDateTime ?? null;
    const end = start ? (entry.endDateTime ?? start) : null;
    const venue = start && entry.venue ? (VENUE_BY_NAME[entry.venue.displayName] ?? null) : null;
    db.exec('INSERT INTO slot VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', {
      bind: [
        entry.id,
        entry.shortId,
        key,
        start,
        end,
        start ? lvDay(start) : null,
        venue,
        entry.venueRoomName?.trim() || null,
        entry.seatCapacity ?? null,
        entry.hash,
        entry.lastModified ?? '',
      ],
    });
  }

  const speakers = new Map<string, [string, string | null]>();
  for (const raw of members.flatMap((m) => m.speakers ?? [])) {
    const name = (raw.displayName ?? raw.name ?? '').trim();
    const company = raw.company?.trim() || null;
    if (name && !speakers.has(`${name}|${company ?? ''}`)) speakers.set(`${name}|${company ?? ''}`, [name, company]);
  }
  [...speakers].forEach(([speakerKey, [name, company]], ord) => {
    let id = ids.speakers.get(speakerKey);
    if (id === undefined) {
      db.exec('INSERT INTO speaker (name, company) VALUES (?, ?)', { bind: [name, company] });
      id = Number(db.selectValue('SELECT last_insert_rowid()'));
      ids.speakers.set(speakerKey, id);
    }
    db.exec('INSERT OR IGNORE INTO session_speaker VALUES (?, ?, ?)', { bind: [key, id, ord] });
  });

  const tagNames: string[] = [];
  for (const [kind, field] of TAG_FIELDS) {
    for (const name of unique(members.flatMap((m) => names(m[field])))) {
      const tagKey = `${kind}|${name}`;
      let id = ids.tags.get(tagKey);
      if (id === undefined) {
        db.exec('INSERT INTO tag (kind, name) VALUES (?, ?)', { bind: [kind, name] });
        id = Number(db.selectValue('SELECT last_insert_rowid()'));
        ids.tags.set(tagKey, id);
      }
      db.exec('INSERT OR IGNORE INTO session_tag VALUES (?, ?)', { bind: [key, id] });
      tagNames.push(name);
    }
  }

  db.exec('INSERT INTO session_fts VALUES (?, ?, ?, ?, ?, ?)', {
    bind: [
      key,
      members.map((m) => m.shortId).join(' '),
      primary.title,
      primary.abstract ?? '',
      [...speakers.values()].map(([name, company]) => (company ? `${name} ${company}` : name)).join('; '),
      tagNames.join('; '),
    ],
  });
  return members.length;
}
