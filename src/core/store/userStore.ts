// User Store: everything the user owns. Two implementations: in-memory (tests) and SQLite (OPFS in the browser).
import type { AgendaItem, PersonalBlock, Profile, Settings, TravelTable } from '../types';

export interface UserStore {
  getProfile(): Profile | null;
  setProfile(profile: Profile | null): void;

  getSettings(): Settings | null;
  setSettings(settings: Settings): void;

  getTravel(): TravelTable | null;
  setTravel(table: TravelTable): void;

  // Agenda items carry their reservation status and slot fingerprint.
  getItems(): AgendaItem[];
  putItem(item: AgendaItem): void;
  deleteItem(id: string): void;
  replaceItems(items: AgendaItem[]): void;

  getStars(): string[];
  setStar(sessionKey: string, starred: boolean): void;

  // Manual scores (0..100) the user set per session; they override the computed score.
  getManualScores(): Record<string, number>;
  setManualScore(sessionKey: string, score: number | null): void;

  getBlocks(): PersonalBlock[];
  putBlock(block: PersonalBlock): void;
  deleteBlock(id: string): void;

  getDismissedAlerts(): string[];
  addDismissedAlert(id: string): void;

  // Change-detection memory: starred sessions that were TBA when last seen.
  getTbaWatch(): string[];
  setTbaWatch(sessionKeys: string[]): void;

  // Set once the keynote presets have been created, so deleting them sticks.
  isSeeded(): boolean;
  markSeeded(): void;

  // Removes everything (used by importState before writing the imported state).
  clear(): void;
}

// Shape of a full snapshot of a store; also the payload of exportState/importState.
export interface UserStoreSnapshot {
  profile: Profile | null;
  settings: Settings | null;
  travel: TravelTable | null;
  items: AgendaItem[];
  stars: string[];
  manualScores: Record<string, number>;
  blocks: PersonalBlock[];
  dismissedAlerts: string[];
  tbaWatch: string[];
}

export function snapshotStore(store: UserStore): UserStoreSnapshot {
  return {
    profile: store.getProfile(),
    settings: store.getSettings(),
    travel: store.getTravel(),
    items: store.getItems(),
    stars: store.getStars(),
    manualScores: store.getManualScores(),
    blocks: store.getBlocks(),
    dismissedAlerts: store.getDismissedAlerts(),
    tbaWatch: store.getTbaWatch(),
  };
}

export function restoreStore(store: UserStore, snapshot: UserStoreSnapshot): void {
  store.clear();
  store.setProfile(snapshot.profile);
  if (snapshot.settings) store.setSettings(snapshot.settings);
  if (snapshot.travel) store.setTravel(snapshot.travel);
  store.replaceItems(snapshot.items);
  for (const key of snapshot.stars) store.setStar(key, true);
  for (const [key, score] of Object.entries(snapshot.manualScores)) store.setManualScore(key, score);
  for (const block of snapshot.blocks) store.putBlock(block);
  for (const id of snapshot.dismissedAlerts) store.addDismissedAlert(id);
  store.setTbaWatch(snapshot.tbaWatch);
  store.markSeeded();
}
