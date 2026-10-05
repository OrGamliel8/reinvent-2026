import type { AgendaItem, PersonalBlock, Profile, Settings, TravelTable } from '../types';
import type { UserStore } from './userStore';

// In-memory User Store (tests, and the fallback when OPFS is unavailable). Values are cloned on the way in and out.
export class MemoryUserStore implements UserStore {
  private profile: Profile | null = null;
  private settings: Settings | null = null;
  private travel: TravelTable | null = null;
  private items = new Map<string, AgendaItem>();
  private stars = new Set<string>();
  private blocks = new Map<string, PersonalBlock>();
  private dismissed = new Set<string>();
  private tbaWatch: string[] = [];
  private seeded = false;

  getProfile(): Profile | null {
    return clone(this.profile);
  }
  setProfile(profile: Profile | null): void {
    this.profile = clone(profile);
  }

  getSettings(): Settings | null {
    return clone(this.settings);
  }
  setSettings(settings: Settings): void {
    this.settings = clone(settings);
  }

  getTravel(): TravelTable | null {
    return clone(this.travel);
  }
  setTravel(table: TravelTable): void {
    this.travel = clone(table);
  }

  getItems(): AgendaItem[] {
    return clone([...this.items.values()]);
  }
  putItem(item: AgendaItem): void {
    this.items.set(item.id, clone(item));
  }
  deleteItem(id: string): void {
    this.items.delete(id);
  }
  replaceItems(items: AgendaItem[]): void {
    this.items = new Map(items.map((item) => [item.id, clone(item)]));
  }

  getStars(): string[] {
    return [...this.stars];
  }
  setStar(sessionKey: string, starred: boolean): void {
    if (starred) this.stars.add(sessionKey);
    else this.stars.delete(sessionKey);
  }

  getBlocks(): PersonalBlock[] {
    return clone([...this.blocks.values()]);
  }
  putBlock(block: PersonalBlock): void {
    this.blocks.set(block.id, clone(block));
  }
  deleteBlock(id: string): void {
    this.blocks.delete(id);
  }

  getDismissedAlerts(): string[] {
    return [...this.dismissed];
  }
  addDismissedAlert(id: string): void {
    this.dismissed.add(id);
  }

  getTbaWatch(): string[] {
    return [...this.tbaWatch];
  }
  setTbaWatch(sessionKeys: string[]): void {
    this.tbaWatch = [...sessionKeys];
  }

  isSeeded(): boolean {
    return this.seeded;
  }
  markSeeded(): void {
    this.seeded = true;
  }

  clear(): void {
    this.profile = null;
    this.settings = null;
    this.travel = null;
    this.items.clear();
    this.stars.clear();
    this.blocks.clear();
    this.dismissed.clear();
    this.tbaWatch = [];
    this.seeded = false;
  }
}

function clone<T>(value: T): T {
  return value === null ? value : structuredClone(value);
}
