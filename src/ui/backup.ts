// Full-backup download (exportState) plus a per-browser memory of when it last happened.
import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { downloadText } from './download';
import { readPref, writePref } from './explore/prefs';
import { errorMessage, type Planner } from './plannerClient';

const LAST_BACKUP_KEY = 'planner-last-backup';
const DAY_MS = 24 * 60 * 60 * 1000;
export const BACKUP_STALE_MS = 3 * DAY_MS;

const listeners = new Set<() => void>();
let lastBackupThisTab: number | null = null; // used when localStorage is blocked, so the reminder still clears

function readLastBackup(): number | null {
  const stored = Number(readPref(LAST_BACKUP_KEY));
  return stored > 0 ? stored : lastBackupThisTab;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLastBackup(): number | null {
  return useSyncExternalStore(subscribe, readLastBackup);
}

export async function saveBackup(api: Planner): Promise<void> {
  try {
    downloadText(`reinvent-2026-backup-${new Date().toLocaleDateString('en-CA')}.json`, await api.exportState(), 'application/json');
  } catch (error) {
    toast.error(`Backup failed: ${errorMessage(error)}`);
    return;
  }
  lastBackupThisTab = Date.now();
  writePref(LAST_BACKUP_KEY, String(lastBackupThisTab));
  listeners.forEach((listener) => listener());
  toast.success('Backup saved');
}

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

export function fmtAgo(timestamp: number): string {
  const minutes = Math.round((Date.now() - timestamp) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return relative.format(-minutes, 'minute');
  if (minutes < 24 * 60) return relative.format(-Math.round(minutes / 60), 'hour');
  return relative.format(-Math.round(minutes / (24 * 60)), 'day');
}
