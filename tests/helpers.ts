import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CatalogRepository } from '../src/core/catalog/catalogRepository';
import { buildCatalogDb } from '../src/core/pipeline/buildCatalogDb';
import type { RawCatalog } from '../src/core/pipeline/rawCatalog';
import { Planner } from '../src/core/planner';
import { loadSqlite } from '../src/core/sqlite';
import { MemoryUserStore } from '../src/core/store/memoryUserStore';
import type { UserStore } from '../src/core/store/userStore';
import type { Profile } from '../src/core/types';

export type Fixture = 'catalog-v1.json' | 'catalog-v2.json';

const fixturePath = (name: string): string => path.join(import.meta.dirname, 'fixtures', name);

export function fixtureProfile(): Profile {
  return JSON.parse(readFileSync(fixturePath('profile.json'), 'utf8')) as Profile;
}

export async function buildCatalog(fixture: Fixture = 'catalog-v1.json'): Promise<CatalogRepository> {
  const sqlite3 = await loadSqlite();
  const raw = JSON.parse(readFileSync(fixturePath(fixture), 'utf8')) as RawCatalog;
  const bytes = buildCatalogDb(sqlite3, raw, { sourceUrl: 'https://example.test/catalog', fetchedAt: '2026-10-05T12:00:00.000Z', etag: 'etag-1' });
  return CatalogRepository.open({ sqlite3, bytes });
}

export async function openPlanner({
  fixture = 'catalog-v1.json',
  store = new MemoryUserStore(),
  profile = fixtureProfile(),
}: { fixture?: Fixture; store?: UserStore; profile?: Profile | null } = {}): Promise<{ planner: Planner; store: UserStore }> {
  const planner = Planner.open({ catalog: await buildCatalog(fixture), store });
  if (profile) {
    const result = planner.updateProfile(profile);
    if (!result.ok) throw new Error(JSON.stringify(result.errors));
  }
  return { planner, store };
}

// Slot id for a short code such as "ANT319-R1".
export function slotId(planner: Planner, code: string): string {
  const session = planner.session(code.replace(/-R\d*$/, ''));
  const slot = session?.slots.find((s) => s.code === code);
  if (!slot) throw new Error(`No slot ${code}`);
  return slot.slotId;
}

export function add(planner: Planner, code: string): string {
  return planner.addSlot(slotId(planner, code)).id;
}

// Short code of the slot an agenda item sits in.
export function codeOf(planner: Planner, sessionKey: string): string | undefined {
  const item = planner.agenda().find((i) => i.sessionKey === sessionKey);
  return planner.session(sessionKey)?.slots.find((s) => s.slotId === item?.slotId)?.code;
}
