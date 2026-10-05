// Shared loader for the official SQLite-wasm build. Works in Node (tests, scripts) and in the browser worker.
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';

export type Sqlite3 = Sqlite3Static;
export type Db = Database;

let loading: Promise<Sqlite3> | null = null;

export function loadSqlite(): Promise<Sqlite3> {
  loading ??= sqlite3InitModule();
  return loading;
}

// Opens an in-memory database holding a copy of the given SQLite file bytes.
export function openDbFromBytes(sqlite3: Sqlite3, bytes: Uint8Array, { readOnly }: { readOnly: boolean }): Db {
  const db = new sqlite3.oo1.DB(':memory:');
  const pointer = sqlite3.wasm.allocFromTypedArray(bytes);
  const { capi } = sqlite3;
  let flags = capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_RESIZEABLE;
  if (readOnly) flags = capi.SQLITE_DESERIALIZE_FREEONCLOSE | capi.SQLITE_DESERIALIZE_READONLY;
  const rc = capi.sqlite3_deserialize(db, 'main', pointer, bytes.byteLength, bytes.byteLength, flags);
  db.checkRc(rc);
  return db;
}

export function exportDbBytes(sqlite3: Sqlite3, db: Db): Uint8Array {
  return sqlite3.capi.sqlite3_js_db_export(db);
}
