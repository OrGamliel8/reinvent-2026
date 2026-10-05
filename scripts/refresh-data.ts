// Refreshes the committed catalog snapshot (public/catalog.sqlite3).
//   npm run refresh-data                          fetch (skipped when the etag is unchanged)
//   npm run refresh-data -- --from-file <json>    build from a downloaded catalog file (optional --etag <etag>)
//   npm run refresh-data -- --force               fetch even if the etag is unchanged
// The source is a one-person community site: run this rarely.
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { CatalogRepository } from '../src/core/catalog/catalogRepository';
import { SOURCE_URL } from '../src/core/defaults';
import { buildCatalogDb } from '../src/core/pipeline/buildCatalogDb';
import type { CatalogSource, RawCatalog } from '../src/core/pipeline/rawCatalog';
import { loadSqlite } from '../src/core/sqlite';
import { SNAPSHOT_PATH, openSnapshot } from './lib/snapshot';

const { values } = parseArgs({ options: { 'from-file': { type: 'string' }, etag: { type: 'string' }, force: { type: 'boolean', default: false } } });

async function load(previous: CatalogRepository | null): Promise<{ raw: RawCatalog; source: CatalogSource } | null> {
  const file = values['from-file'];
  if (file) {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as RawCatalog;
    return { raw, source: { sourceUrl: SOURCE_URL, fetchedAt: statSync(file).mtime.toISOString(), etag: values.etag ?? null } };
  }
  const etag = values.force ? null : previous?.meta().etag;
  const response = await fetch(SOURCE_URL, { headers: { Accept: 'application/json', ...(etag ? { 'If-None-Match': `"${etag}"` } : {}) } });
  if (response.status === 304) return null;
  if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  const raw = (await response.json()) as RawCatalog;
  return { raw, source: { sourceUrl: SOURCE_URL, fetchedAt: new Date().toISOString(), etag: response.headers.get('etag')?.replace(/^W\//, '').replace(/"/g, '') ?? null } };
}

function summarize(previous: CatalogRepository | null, next: CatalogRepository): string {
  const slots = (repo: CatalogRepository | null): Map<string, { code: string; hash: string }> =>
    new Map((repo?.sessions() ?? []).flatMap((s) => s.slots.map((slot) => [slot.slotId, { code: slot.code, hash: slot.hash }] as const)));
  const before = slots(previous);
  const after = slots(next);
  const added = [...after].filter(([id]) => !before.has(id)).map(([, s]) => s.code);
  const removed = [...before].filter(([id]) => !after.has(id)).map(([, s]) => s.code);
  const changed = [...after].filter(([id, s]) => before.has(id) && before.get(id)!.hash !== s.hash).map(([, s]) => s.code);
  const list = (codes: string[]): string => (codes.length ? `  ${codes.sort().slice(0, 30).join(', ')}${codes.length > 30 ? ', …' : ''}\n` : '');
  const meta = next.meta();
  const tba = next.sessions().filter((s) => s.tba).length;
  return (
    `Catalog: ${meta.sessionCount} sessions, ${meta.slotCount} slots (${tba} sessions TBA), fetched ${meta.fetchedAt}, etag ${meta.etag ?? '-'}\n` +
    `Added slots: ${added.length}\n${list(added)}` +
    `Removed slots: ${removed.length}\n${list(removed)}` +
    `Changed slots: ${changed.length}\n${list(changed)}`
  );
}

const previous = await openSnapshot();
const loaded = await load(previous);
if (!loaded) {
  console.log(`Not modified (etag ${previous?.meta().etag}). Snapshot left as is.`);
} else {
  const sqlite3 = await loadSqlite();
  const bytes = buildCatalogDb(sqlite3, loaded.raw, loaded.source);
  const next = CatalogRepository.open({ sqlite3, bytes });
  writeFileSync(SNAPSHOT_PATH, bytes);
  console.log(`Wrote ${SNAPSHOT_PATH} (${(bytes.length / 1024 / 1024).toFixed(1)} MB)`);
  console.log(summarize(previous, next));
}
