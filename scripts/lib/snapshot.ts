import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { CatalogRepository } from '../../src/core/catalog/catalogRepository';
import { loadSqlite } from '../../src/core/sqlite';

export const SNAPSHOT_PATH = path.resolve(import.meta.dirname, '../../public/catalog.sqlite3');

export async function openSnapshot(file = SNAPSHOT_PATH): Promise<CatalogRepository | null> {
  if (!existsSync(file)) return null;
  return CatalogRepository.open({ sqlite3: await loadSqlite(), bytes: new Uint8Array(readFileSync(file)) });
}

export async function requireSnapshot(): Promise<CatalogRepository> {
  const catalog = await openSnapshot();
  if (!catalog) throw new Error(`No catalog snapshot at ${SNAPSHOT_PATH}. Run: npm run refresh-data`);
  return catalog;
}
