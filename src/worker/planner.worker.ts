// Web Worker hosting the Planner core. The UI talks to it through Comlink (see WorkerApi in src/core/types.ts).
import * as Comlink from 'comlink';
import { CatalogRepository } from '../core/catalog/catalogRepository';
import { Planner } from '../core/planner';
import { loadSqlite, type Sqlite3 } from '../core/sqlite';
import { MemoryUserStore } from '../core/store/memoryUserStore';
import { SqliteUserStore } from '../core/store/sqliteUserStore';
import type { UserStore } from '../core/store/userStore';
import type { PlannerApi, StorageStatus, WorkerApi, WorkerInitOptions } from '../core/types';

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
  setManualScore: true,
  manualScores: true,
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
let storage: StorageStatus = { persistent: false, reason: 'The planner has not started yet.' };

async function openUserStore(sqlite3: Sqlite3, forceMemory: boolean): Promise<UserStore> {
  if (forceMemory) {
    storage = { persistent: false, reason: 'In-memory storage was forced with ?memory=1.' };
    return new MemoryUserStore();
  }
  try {
    const pool = await sqlite3.installOpfsSAHPoolVfs({ name: 'opfs-sahpool', directory: '/reinvent-planner' });
    const store = new SqliteUserStore({ db: new pool.OpfsSAHPoolDb(USER_DB) });
    storage = { persistent: true, reason: null };
    return store;
  } catch (error) {
    console.warn('OPFS storage is unavailable; your plan will not survive a reload.', error);
    storage = { persistent: false, reason: error instanceof Error ? error.message : String(error) };
    return new MemoryUserStore();
  }
}

async function init(options: WorkerInitOptions): Promise<void> {
  const sqlite3 = await loadSqlite();
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.sqlite3`);
  if (!response.ok) throw new Error(`Could not load the catalog snapshot (HTTP ${response.status})`);
  const catalog = CatalogRepository.open({ sqlite3, bytes: new Uint8Array(await response.arrayBuffer()) });
  const opened = Planner.open({ catalog, store: await openUserStore(sqlite3, options.forceMemory ?? false) });
  opened.detectChanges();
  planner = opened;
}

const api: Record<string, unknown> = {
  // Idempotent; a failed init can be retried.
  init(options: WorkerInitOptions = {}): Promise<void> {
    initializing ??= init(options).catch((error: unknown) => {
      initializing = null;
      throw error;
    });
    return initializing;
  },
  storageStatus(): StorageStatus {
    return storage;
  },
};

for (const name of Object.keys(PLANNER_METHODS) as (keyof PlannerApi)[]) {
  api[name] = (...args: unknown[]): unknown => {
    if (!planner) throw new Error('Planner is not ready: await init() first');
    return (planner[name] as (...a: unknown[]) => unknown).apply(planner, args);
  };
}

Comlink.expose(api as unknown as WorkerApi);
