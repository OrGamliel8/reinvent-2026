// Web Worker hosting the Planner core. The UI talks to it through Comlink (see WorkerApi in src/core/types.ts).
import * as Comlink from 'comlink';
import { CatalogRepository } from '../core/catalog/catalogRepository';
import { Planner } from '../core/planner';
import { loadSqlite, type Sqlite3 } from '../core/sqlite';
import { MemoryUserStore } from '../core/store/memoryUserStore';
import { SqliteUserStore } from '../core/store/sqliteUserStore';
import type { UserStore } from '../core/store/userStore';
import type { PlannerApi, WorkerApi } from '../core/types';

const USER_DB = '/user.sqlite3';

// Every PlannerApi method, delegated to the Planner once init() has resolved.
const PLANNER_METHODS = {
  meta: true,
  vocabulary: true,
  session: true,
  getProfile: true,
  importProfile: true,
  exportProfile: true,
  updateProfile: true,
  copyPrompt: true,
  profileDraft: true,
  profileFromDraft: true,
  rank: true,
  explain: true,
  agenda: true,
  starred: true,
  star: true,
  unstar: true,
  addSlot: true,
  removeItem: true,
  setPinned: true,
  slotFit: true,
  autoBuild: true,
  conflicts: true,
  alternatives: true,
  personalBlocks: true,
  createBlock: true,
  updateBlock: true,
  deleteBlock: true,
  travelTable: true,
  setTravel: true,
  settings: true,
  updateSettings: true,
  reservationChecklist: true,
  setReservationStatus: true,
  detectChanges: true,
  dismissAlert: true,
  acceptChange: true,
  exportIcs: true,
  exportState: true,
  importState: true,
  exportAgenda: true,
  importAgenda: true,
} satisfies Record<keyof PlannerApi, true>;

let planner: Planner | null = null;
let initializing: Promise<void> | null = null;

async function openUserStore(sqlite3: Sqlite3): Promise<UserStore> {
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'opfs-sahpool', directory: '/reinvent-planner' });
    return new SqliteUserStore({ db: new pool.OpfsSAHPoolDb(USER_DB) });
  } catch (error) {
    console.warn('OPFS storage is unavailable; your plan will not survive a reload.', error);
    return new MemoryUserStore();
  }
}

async function init(): Promise<void> {
  const sqlite3 = await loadSqlite();
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.sqlite3`);
  if (!response.ok) throw new Error(`Could not load the catalog snapshot (HTTP ${response.status})`);
  const catalog = CatalogRepository.open({ sqlite3, bytes: new Uint8Array(await response.arrayBuffer()) });
  const opened = Planner.open({ catalog, store: await openUserStore(sqlite3) });
  opened.detectChanges();
  planner = opened;
}

const api: Record<string, unknown> = {
  // Idempotent; a failed init can be retried.
  init(): Promise<void> {
    initializing ??= init().catch((error: unknown) => {
      initializing = null;
      throw error;
    });
    return initializing;
  },
};

for (const name of Object.keys(PLANNER_METHODS) as (keyof PlannerApi)[]) {
  api[name] = (...args: unknown[]): unknown => {
    if (!planner) throw new Error('Planner is not ready: await init() first');
    return (planner[name] as (...a: unknown[]) => unknown).apply(planner, args);
  };
}

Comlink.expose(api as unknown as WorkerApi);
