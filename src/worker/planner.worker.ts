// Web Worker hosting the Planner core. The UI talks to it through Comlink (see WorkerApi in src/core/types.ts).
//
// The user store lives in OPFS (opfs-sahpool), which holds exclusive access handles, so only one tab can own it.
// "Last tab wins": a tab steals the OWNER lock to take the store; the previous owner closes its DB, releases its handles,
// lets go of the HANDLES lock and turns 'inactive'. The new owner waits for the HANDLES lock before touching OPFS.
import * as Comlink from 'comlink';
import type { SAHPoolUtil } from '@sqlite.org/sqlite-wasm';
import { CatalogRepository } from '../core/catalog/catalogRepository';
import { Planner } from '../core/planner';
import { loadSqlite, type Db, type Sqlite3 } from '../core/sqlite';
import { MemoryUserStore } from '../core/store/memoryUserStore';
import { SqliteUserStore } from '../core/store/sqliteUserStore';
import { restoreStore, snapshotStore, type UserStore } from '../core/store/userStore';
import type { PlannerApi, StorageStatus, WorkerApi, WorkerInitOptions } from '../core/types';

const USER_DB = '/user.sqlite3';
const VFS_NAME = 'opfs-sahpool';
const VFS_DIR = 'reinvent-planner';
const OWNER_LOCK = 'reinvent-planner-store';
const HANDLES_LOCK = 'reinvent-planner-store-handles';
const ACQUIRE_TRIES = 10;
const RETRY_MS = 300;
const INACTIVE_MESSAGE = 'The planner is open in another tab. Click "Use here" to make changes in this tab.';

// Every PlannerApi method, delegated to the current Planner once init() has resolved.
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
  daySummaries: true,
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
  profiles: true,
  saveProfileAs: true,
  parseProfile: true,
  importProfileAs: true,
  activateProfile: true,
  renameProfile: true,
  duplicateProfile: true,
  deleteProfile: true,
  exportSharedPlan: true,
  importSharedPlan: true,
  compare: true,
} satisfies Record<keyof PlannerApi, true>;

let sqlite3: Sqlite3;
let catalog: CatalogRepository;
let planner: Planner | null = null;
let initializing: Promise<void> | null = null;
let storage: StorageStatus = { mode: 'memory', reason: 'The planner has not started yet.' };
let storageListener: ((status: StorageStatus) => void) | null = null;

let pool: SAHPoolUtil | null = null;
let userDb: Db | null = null;
let userStore: UserStore | null = null;
let releaseOwner: (() => void) | null = null;
let releaseHandles: (() => void) | null = null;

// Ownership changes run one at a time, so a steal that lands mid-acquisition is handled once it finishes.
let ownershipQueue: Promise<unknown> = Promise.resolve();
function serialized<T>(task: () => Promise<T>): Promise<T> {
  const run = ownershipQueue.then(task, task);
  ownershipQueue = run.catch(() => undefined);
  return run;
}

function setStorage(status: StorageStatus): void {
  storage = status;
  storageListener?.(status);
}

// Requests a Web Lock and keeps it until the returned release() is called. onStolen runs if another tab steals it.
function holdLock(name: string, options: LockOptions, onStolen: () => void): Promise<() => void> {
  return new Promise((granted, failed) => {
    let isGranted = false;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    navigator.locks
      .request(name, options, () => {
        isGranted = true;
        granted(release);
        return held;
      })
      .catch((error: unknown) => {
        if (isGranted && error instanceof DOMException && error.name === 'AbortError') onStolen();
        else failed(error);
      });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

// True when every pool file can be opened, i.e. no other context still holds its handles. installOpfsSAHPoolVfs()
// deletes the pool directory when it fails to acquire a handle, so it must only run once the files are free.
async function poolFilesFree(): Promise<boolean> {
  let opaque: FileSystemDirectoryHandle;
  try {
    const root = await navigator.storage.getDirectory();
    opaque = await (await root.getDirectoryHandle(VFS_DIR)).getDirectoryHandle('.opaque');
  } catch {
    return true; // no pool yet
  }
  type SyncFile = FileSystemFileHandle & { createSyncAccessHandle(): Promise<{ close(): void }> };
  for await (const [, handle] of opaque as unknown as AsyncIterable<[string, FileSystemHandle]>) {
    if (handle.kind !== 'file') continue;
    try {
      (await (handle as SyncFile).createSyncAccessHandle()).close();
    } catch {
      return false;
    }
  }
  return true;
}

async function startPool(): Promise<SAHPoolUtil> {
  if (pool) return pool.unpauseVfs();
  const options = { name: VFS_NAME, directory: `/${VFS_DIR}`, forceReinitIfPreviouslyFailed: true };
  return sqlite3.installOpfsSAHPoolVfs(options);
}

// Retries for ~3s: right after a reload or a handoff, the previous holder may still be releasing its handles.
async function openUserDb(): Promise<Db> {
  let lastError: unknown = new Error('OPFS files are still in use by another tab.');
  for (let attempt = 0; attempt < ACQUIRE_TRIES; attempt++) {
    if (attempt > 0) await sleep(RETRY_MS);
    if (!(await poolFilesFree())) continue;
    try {
      pool = await startPool();
      return new pool.OpfsSAHPoolDb(USER_DB);
    } catch (error) {
      lastError = error;
      try {
        pool?.pauseVfs(); // drop any handles a failed unpause still acquired
      } catch {
        // already paused
      }
    }
  }
  throw lastError;
}

// Takes the store from whichever tab has it and opens a Planner on it.
async function activate(): Promise<void> {
  if (!navigator.locks || !navigator.storage?.getDirectory) throw new Error('This browser lacks Web Locks or OPFS.');
  releaseOwner = await holdLock(OWNER_LOCK, { steal: true }, () => void serialized(deactivate));
  try {
    releaseHandles = await holdLock(HANDLES_LOCK, {}, () => {});
    userDb = await openUserDb();
    userStore = new SqliteUserStore({ db: userDb });
    planner = Planner.open({ catalog, store: userStore });
    planner.detectChanges();
  } catch (error) {
    await releaseStore();
    releaseOwner?.();
    releaseOwner = null;
    throw error;
  }
  setStorage({ mode: 'persistent', reason: null });
}

// Another tab took over: keep serving reads from a frozen copy, then let go of the OPFS files.
async function deactivate(): Promise<void> {
  releaseOwner = null;
  if (userStore) planner = Planner.open({ catalog, store: readOnlyCopy(userStore) });
  await releaseStore();
  setStorage({ mode: 'inactive', reason: 'The planner was opened in another tab.' });
}

async function releaseStore(): Promise<void> {
  userDb?.close();
  userDb = null;
  userStore = null;
  try {
    pool?.pauseVfs();
  } catch (error) {
    console.warn('Could not release the OPFS handles', error);
  }
  releaseHandles?.();
  releaseHandles = null;
}

function readOnlyCopy(store: UserStore): UserStore {
  const copy = new MemoryUserStore();
  restoreStore(copy, snapshotStore(store));
  return new Proxy(copy, {
    get(target, key, receiver) {
      const value: unknown = Reflect.get(target, key, receiver);
      const isRead = typeof key === 'string' && /^(get|is)[A-Z]/.test(key);
      if (typeof value === 'function' && !isRead) {
        return () => {
          throw new Error(INACTIVE_MESSAGE);
        };
      }
      return value;
    },
  });
}

async function init(options: WorkerInitOptions): Promise<void> {
  sqlite3 = await loadSqlite();
  const response = await fetch(`${import.meta.env.BASE_URL}catalog.sqlite3`);
  if (!response.ok) throw new Error(`Could not load the catalog snapshot (HTTP ${response.status})`);
  catalog = CatalogRepository.open({ sqlite3, bytes: new Uint8Array(await response.arrayBuffer()) });
  if (options.forceMemory) return openMemory('In-memory storage was forced with ?memory=1.');
  try {
    await serialized(activate);
  } catch (error) {
    console.warn('OPFS storage is unavailable; your plan will not survive a reload.', error);
    openMemory(error instanceof Error ? error.message : String(error));
  }
}

function openMemory(reason: string): void {
  const opened = Planner.open({ catalog, store: new MemoryUserStore() });
  opened.detectChanges();
  planner = opened;
  setStorage({ mode: 'memory', reason });
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
  watchStorage(listener: (status: StorageStatus) => void): StorageStatus {
    storageListener = listener;
    return storage;
  },
  // "Use here" from an inactive tab: steal the store back and reopen the Planner on its latest state.
  useHere(): Promise<void> {
    return serialized(async () => {
      if (storage.mode !== 'inactive') return;
      try {
        await activate();
      } catch (error) {
        setStorage({ mode: 'inactive', reason: error instanceof Error ? error.message : String(error) });
        throw error;
      }
    });
  },
};

for (const name of Object.keys(PLANNER_METHODS) as (keyof PlannerApi)[]) {
  api[name] = (...args: unknown[]): unknown => {
    if (!planner) throw new Error('Planner is not ready: await init() first');
    return (planner[name] as (...a: unknown[]) => unknown).apply(planner, args);
  };
}

Comlink.expose(api as unknown as WorkerApi);
