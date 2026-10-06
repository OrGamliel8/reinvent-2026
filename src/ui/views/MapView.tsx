import { useMemo, useState, type ReactNode } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Tooltip } from 'react-leaflet';
import { Input } from '@/components/ui/input';
import { VENUES, type DayId, type Session, type VenueId } from '@/core/types';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { VENUE_COLORS, fmtRange, hhmmToMinutes, lvMinutes, venueName } from '../format';
import { DayPicker } from '../shared/DayPicker';

const CENTER: [number, number] = [36.1145, -115.1705];
const RELEVANT_LIMIT = 150;

interface OnNow {
  key: string;
  code: string;
  title: string;
  start: string;
  end: string;
}

export function MapView(): ReactNode {
  const [day, setDay] = useState<DayId>('mon');
  const [time, setTime] = useState('10:00');
  const minute = hhmmToMinutes(time || '00:00');

  const { data: ranked } = usePlannerQuery((api) => api.rank({ days: [day], limit: RELEVANT_LIMIT }), [day]);
  const { data: route } = usePlannerQuery(async (api) => {
    const items = await api.agenda();
    const sessions = await Promise.all([...new Set(items.map((i) => i.sessionKey))].map((k) => api.session(k)));
    const byKey = new Map(sessions.filter((s): s is Session => s !== null).map((s) => [s.key, s]));
    return items
      .map((item) => byKey.get(item.sessionKey)?.slots.find((s) => s.slotId === item.slotId))
      .filter((slot) => slot?.day === day && slot.start && slot.venue)
      .sort((a, b) => a!.start!.localeCompare(b!.start!))
      .map((slot) => ({ venue: slot!.venue!, code: slot!.code, start: slot!.start! }));
  }, [day]);

  const onNow = useMemo(() => {
    const byVenue = new Map<VenueId, OnNow[]>(VENUES.map((v) => [v.id, []]));
    for (const r of ranked ?? []) {
      for (const slot of r.session.slots) {
        if (!r.matchingSlotIds.includes(slot.slotId) || !slot.start || !slot.end || !slot.venue) continue;
        if (lvMinutes(slot.start) <= minute && minute < lvMinutes(slot.end)) {
          byVenue.get(slot.venue)?.push({ key: r.session.key, code: slot.code, title: r.session.title, start: slot.start, end: slot.end });
        }
      }
    }
    return byVenue;
  }, [ranked, minute]);

  const coords = new Map(VENUES.map((v) => [v.id, [v.lat, v.lng] as [number, number]]));
  const path = (route ?? []).map((stop) => coords.get(stop.venue)!);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2">
        <DayPicker value={day} onChange={setDay} />
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          At
          <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-7 w-28 px-1.5 text-xs" />
        </label>
        <span className="text-xs text-muted-foreground">
          Counts = your top {RELEVANT_LIMIT} sessions that day running at that time · line = your route in agenda order
          {route && ` (${route.length} stops)`}
        </span>
      </div>
      <div className="relative min-h-0 flex-1">
        <MapContainer center={CENTER} zoom={15} className="h-full w-full" scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#6366f1', weight: 4, opacity: 0.8, dashArray: '6 6' }} />}
          {VENUES.map((venue) => (
            <VenueMarker key={venue.id} venue={venue.id} position={coords.get(venue.id)!} sessions={onNow.get(venue.id) ?? []} stops={(route ?? []).flatMap((s, i) => (s.venue === venue.id ? [i + 1] : []))} />
          ))}
        </MapContainer>
      </div>
    </div>
  );
}

function VenueMarker({ venue, position, sessions, stops }: { venue: VenueId; position: [number, number]; sessions: OnNow[]; stops: number[] }): ReactNode {
  const { openSession } = useUi();
  const count = sessions.length;
  return (
    <CircleMarker center={position} radius={12 + Math.min(count, 20)} pathOptions={{ color: VENUE_COLORS[venue], fillColor: VENUE_COLORS[venue], fillOpacity: 0.35, weight: 2 }}>
      <Tooltip permanent direction="right" offset={[14, 0]} className="text-xs">
        <strong>{venueName(venue)}</strong> · {count} on now
        {stops.length > 0 && ` · stop ${stops.join(', ')}`}
      </Tooltip>
      <Popup>
        <div className="max-h-64 w-64 space-y-1 overflow-y-auto text-xs">
          <div className="font-semibold">{venueName(venue)}</div>
          {count === 0 && <div className="text-muted-foreground">Nothing relevant on at this time.</div>}
          {sessions.map((s) => (
            <button key={s.code} className="block w-full text-left hover:underline" onClick={() => openSession(s.key)}>
              <span className="font-mono">{s.code}</span> {s.title} <span className="opacity-70">({fmtRange(s.start, s.end)})</span>
            </button>
          ))}
        </div>
      </Popup>
    </CircleMarker>
  );
}
