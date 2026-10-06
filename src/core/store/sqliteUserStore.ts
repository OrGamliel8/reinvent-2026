import type { Db } from '../sqlite';
import type { AgendaItem, PersonalBlock, Profile, ProfileEntry, Settings, TravelTable } from '../types';
import type { UserStore } from './userStore';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS agenda_item (id TEXT PRIMARY KEY, session_key TEXT NOT NULL, slot_id TEXT NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS star (session_key TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS manual_score (session_key TEXT PRIMARY KEY, score INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS personal_block (id TEXT PRIMARY KEY, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dismissed_alert (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS profile_entry (id TEXT PRIMARY KEY, data TEXT NOT NULL);
`;

const USER_SCHEMA_VERSION = 3;

// SQLite-backed User Store. In the browser the DB lives in OPFS (opfs-sahpool VFS); any oo1 DB works.
export class SqliteUserStore implements UserStore {
  private readonly db: Db;

  constructor({ db }: { db: Db }) {
    this.db = db;
    this.db.exec(SCHEMA);
    this.db.exec(`PRAGMA user_version = ${USER_SCHEMA_VERSION}`);
  }

  getProfile(): Profile | null {
    return this.getJson<Profile>('profile');
  }
  setProfile(profile: Profile | null): void {
    this.setJson('profile', profile);
  }

  getSettings(): Settings | null {
    return this.getJson<Settings>('settings');
  }
  setSettings(settings: Settings): void {
    this.setJson('settings', settings);
  }

  getTravel(): TravelTable | null {
    return this.getJson<TravelTable>('travel');
  }
  setTravel(table: TravelTable): void {
    this.setJson('travel', table);
  }

  getItems(): AgendaItem[] {
    return this.db.selectValues('SELECT data FROM agenda_item ORDER BY rowid').map((v) => JSON.parse(String(v)) as AgendaItem);
  }
  putItem(item: AgendaItem): void {
    this.db.exec(
      `INSERT INTO agenda_item (id, session_key, slot_id, data) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET session_key = excluded.session_key, slot_id = excluded.slot_id, data = excluded.data`,
      { bind: [item.id, item.sessionKey, item.slotId, JSON.stringify(item)] },
    );
  }
  deleteItem(id: string): void {
    this.db.exec('DELETE FROM agenda_item WHERE id = ?', { bind: [id] });
  }
  replaceItems(items: AgendaItem[]): void {
    this.db.transaction(() => {
      this.db.exec('DELETE FROM agenda_item');
      for (const item of items) this.putItem(item);
    });
  }

  getStars(): string[] {
    return this.db.selectValues('SELECT session_key FROM star ORDER BY rowid').map(String);
  }
  setStar(sessionKey: string, starred: boolean): void {
    const sql = starred ? 'INSERT OR IGNORE INTO star VALUES (?)' : 'DELETE FROM star WHERE session_key = ?';
    this.db.exec(sql, { bind: [sessionKey] });
  }

  getManualScores(): Record<string, number> {
    const rows = this.db.selectArrays('SELECT session_key, score FROM manual_score ORDER BY rowid');
    return Object.fromEntries(rows.map(([key, score]) => [String(key), Number(score)]));
  }
  setManualScore(sessionKey: string, score: number | null): void {
    if (score === null) this.db.exec('DELETE FROM manual_score WHERE session_key = ?', { bind: [sessionKey] });
    else this.db.exec('INSERT INTO manual_score VALUES (?, ?) ON CONFLICT(session_key) DO UPDATE SET score = excluded.score', { bind: [sessionKey, score] });
  }

  getBlocks(): PersonalBlock[] {
    return this.db.selectValues('SELECT data FROM personal_block ORDER BY rowid').map((v) => JSON.parse(String(v)) as PersonalBlock);
  }
  putBlock(block: PersonalBlock): void {
    this.db.exec('INSERT INTO personal_block VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', {
      bind: [block.id, JSON.stringify(block)],
    });
  }
  deleteBlock(id: string): void {
    this.db.exec('DELETE FROM personal_block WHERE id = ?', { bind: [id] });
  }

  getDismissedAlerts(): string[] {
    return this.db.selectValues('SELECT id FROM dismissed_alert ORDER BY rowid').map(String);
  }
  addDismissedAlert(id: string): void {
    this.db.exec('INSERT OR IGNORE INTO dismissed_alert VALUES (?)', { bind: [id] });
  }

  getTbaWatch(): string[] {
    return this.getJson<string[]>('tbaWatch') ?? [];
  }
  setTbaWatch(sessionKeys: string[]): void {
    this.setJson('tbaWatch', sessionKeys);
  }

  getProfileEntries(): ProfileEntry[] {
    return this.db.selectValues('SELECT data FROM profile_entry ORDER BY rowid').map((v) => JSON.parse(String(v)) as ProfileEntry);
  }
  putProfileEntry(entry: ProfileEntry): void {
    this.db.exec('INSERT INTO profile_entry VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data', { bind: [entry.id, JSON.stringify(entry)] });
  }
  deleteProfileEntry(id: string): void {
    this.db.exec('DELETE FROM profile_entry WHERE id = ?', { bind: [id] });
  }

  getActiveProfileId(): string | null {
    return this.getJson<string>('activeProfileId');
  }
  setActiveProfileId(id: string | null): void {
    this.setJson('activeProfileId', id);
  }

  getShareSourceId(): string | null {
    return this.getJson<string>('shareSourceId');
  }
  setShareSourceId(id: string): void {
    this.setJson('shareSourceId', id);
  }

  isSeeded(): boolean {
    return this.getJson<boolean>('seeded') === true;
  }
  markSeeded(): void {
    this.setJson('seeded', true);
  }

  clear(): void {
    this.db.exec('DELETE FROM kv; DELETE FROM agenda_item; DELETE FROM star; DELETE FROM manual_score; DELETE FROM personal_block; DELETE FROM dismissed_alert; DELETE FROM profile_entry;');
  }

  private getJson<T>(key: string): T | null {
    const value = this.db.selectValue('SELECT value FROM kv WHERE key = ?', [key]);
    return value === undefined ? null : (JSON.parse(String(value)) as T);
  }

  private setJson(key: string, value: unknown): void {
    this.db.exec('INSERT INTO kv VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', { bind: [key, JSON.stringify(value)] });
  }
}
