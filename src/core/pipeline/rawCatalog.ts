// The raw shape of https://reinvent-planner.cloud/api/aws/reinvent/2026/catalog (only the fields we use).

export interface RawNamed {
  id?: string;
  displayName: string;
}

export interface RawSpeaker {
  displayName?: string;
  name?: string;
  company?: string | null;
}

export interface RawRepeat {
  id: string;
  shortId?: string;
  startDateTime?: string;
  endDateTime?: string;
}

export interface RawEntry {
  id: string;
  hash: string;
  shortId: string;
  title: string;
  abstract?: string;
  startDateTime?: string;
  endDateTime?: string;
  day?: string;
  venue?: RawNamed;
  venueRoomName?: string;
  type?: RawNamed;
  level?: { value?: number; displayName?: string };
  services?: RawNamed[];
  topics?: RawNamed[];
  areaOfInterest?: RawNamed[];
  industry?: RawNamed[];
  role?: RawNamed[];
  features?: RawNamed[];
  speakers?: RawSpeaker[];
  seatCapacity?: number;
  lastModified?: string;
  repeats?: RawRepeat[];
}

export interface RawCatalog {
  catalog: RawEntry[];
  sharedList?: unknown;
}

export interface CatalogSource {
  sourceUrl: string;
  fetchedAt: string; // ISO
  etag: string | null;
}
