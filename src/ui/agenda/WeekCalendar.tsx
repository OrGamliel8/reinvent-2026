import type { ReactNode } from 'react';
import { ArrowLeftRight, Pin, PinOff, Star, Trash2, TriangleAlert } from 'lucide-react';
import { DAYS, type DaySummary } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner } from '../PlannerProvider';
import { useUi } from '../UiState';
import { VENUE_COLORS, fmtMinutes, venueName, venueShort } from '../format';
import { OriginBadge } from '../shared/badges';
import { placeDay, type BlockEntry, type CalendarEntry, type PlacedEntry, type SessionEntry, type TravelEntry } from './calendarModel';

const GRID_START = 7 * 60;
const GRID_END = 21 * 60;
const PX_PER_MIN = 1.1;

interface WeekCalendarProps {
  entries: CalendarEntry[];
  conflictItemIds: Set<string>;
  starredKeys: Set<string>;
  summaries: DaySummary[];
}

export function WeekCalendar({ entries, conflictItemIds, starredKeys, summaries }: WeekCalendarProps): ReactNode {
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START + i * 60);
  const height = (GRID_END - GRID_START) * PX_PER_MIN;
  return (
    <div className="min-w-[700px]">
      <div className="sticky top-0 z-20 grid grid-cols-[3.5rem_repeat(5,1fr)] border-b bg-background">
        <div />
        {DAYS.map((d) => (
          <div key={d.id} className="border-l px-2 py-1.5 text-xs font-medium">
            {d.label}
            <span className="ml-1.5 text-muted-foreground">{entries.filter((e) => e.day === d.id && e.type === 'session').length || ''}</span>
            <SwitchBadge summary={summaries.find((s) => s.day === d.id)} />
          </div>
        ))}
      </div>
      <div className="mt-2 mb-4 grid grid-cols-[3.5rem_repeat(5,1fr)]">
        <div className="relative" style={{ height }}>
          {hours.map((m) => (
            <span key={m} className="absolute right-2 -translate-y-1/2 text-[10px] text-muted-foreground" style={{ top: (m - GRID_START) * PX_PER_MIN }}>
              {fmtMinutes(m)}
            </span>
          ))}
        </div>
        {DAYS.map((d) => (
          <div key={d.id} className="@container relative border-l" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-border/50" style={{ top: (m - GRID_START) * PX_PER_MIN }} />
            ))}
            {entries
              .filter((e): e is TravelEntry => e.day === d.id && e.type === 'travel')
              .map((entry) => (
                <SwitchMarker key={`marker-${entry.id}`} entry={entry} overLimit={entry.switchNo > (summaries.find((s) => s.day === d.id)?.maxSwitches ?? Infinity)} />
              ))}
            {placeDay(entries.filter((e) => e.day === d.id)).map((entry) => (
              <Positioned key={entry.id} entry={entry}>
                <EntryCard
                  entry={entry}
                  conflict={entry.type === 'session' && conflictItemIds.has(entry.id)}
                  starred={entry.type === 'session' && starredKeys.has(entry.session.key)}
                />
              </Positioned>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function Positioned({ entry, children }: { entry: PlacedEntry; children: ReactNode }): ReactNode {
  const start = Math.max(GRID_START, entry.startMin);
  const end = Math.min(GRID_END, entry.endMin);
  const widthPct = 100 / entry.columns;
  return (
    <div
      className={cn('absolute px-0.5', entry.type === 'travel' ? 'z-0' : 'z-10')}
      style={{ top: (start - GRID_START) * PX_PER_MIN, height: Math.max(14, (end - start) * PX_PER_MIN), left: `${entry.column * widthPct}%`, width: `${widthPct}%` }}
    >
      {children}
    </div>
  );
}

function EntryCard({ entry, conflict, starred }: { entry: CalendarEntry; conflict: boolean; starred: boolean }): ReactNode {
  if (entry.type === 'session') return <SessionCard entry={entry} conflict={conflict} starred={starred} />;
  if (entry.type === 'block') return <BlockCard entry={entry} />;
  return <TravelCard entry={entry} />;
}

function SessionCard({ entry, conflict, starred }: { entry: SessionEntry; conflict: boolean; starred: boolean }): ReactNode {
  const { mutate } = usePlanner();
  const { openSession } = useUi();
  const { item, session, slot } = entry;
  const color = slot.venue ? VENUE_COLORS[slot.venue] : 'var(--muted-foreground)';
  return (
    <div
      className={cn(
        'group relative h-full overflow-hidden rounded-md border bg-card text-[11px] leading-tight shadow-xs',
        conflict ? 'border-destructive ring-1 ring-destructive/40' : 'border-border',
      )}
      style={{ borderLeft: `3px solid ${color}` }}
    >
      <button className="block h-full w-full p-1 text-left" onClick={() => openSession(session.key)}>
        <div className="flex items-center gap-1">
          {starred && <Star aria-label="Starred" className="size-3 shrink-0 fill-warning text-warning" />}
          <span className="truncate font-mono text-muted-foreground">{slot.code}</span>
          {item.pinned && <Pin className="size-3 shrink-0 text-primary" />}
          <OriginBadge origin={item.origin} className="ml-auto h-4 px-1 text-[10px]" />
        </div>
        <div className="line-clamp-2 font-medium">{session.title}</div>
        <div className="truncate text-muted-foreground">
          {venueName(slot.venue)}
          {slot.room && ` · ${slot.room}`}
        </div>
      </button>
      <div className="absolute top-0.5 right-0.5 hidden gap-0.5 rounded bg-card/90 group-hover:flex">
        <IconAction label={item.pinned ? 'Unpin' : 'Pin'} onClick={() => void mutate((api) => api.setPinned(item.id, !item.pinned))}>
          {item.pinned ? <PinOff /> : <Pin />}
        </IconAction>
        <IconAction label="Remove" onClick={() => void mutate((api) => api.removeItem(item.id), `Removed ${slot.code}`)}>
          <Trash2 />
        </IconAction>
      </div>
    </div>
  );
}

function IconAction({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }): ReactNode {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground [&_svg]:size-3.5">
      {children}
    </button>
  );
}

function BlockCard({ entry }: { entry: BlockEntry }): ReactNode {
  const { block } = entry;
  return (
    <div className="h-full overflow-hidden rounded-md border border-dashed border-chart-4/60 bg-chart-4/10 p-1 text-[11px] leading-tight">
      <div className="font-medium">{block.title}</div>
      <div className="text-muted-foreground">
        {block.kind === 'keynote' ? 'Keynote' : 'Personal'}
        {block.venue && ` · ${venueName(block.venue)}`}
      </div>
    </div>
  );
}

function TravelCard({ entry }: { entry: TravelEntry }): ReactNode {
  return (
    <div
      className={cn(
        'h-full rounded-sm',
        entry.tight ? 'bg-destructive/15' : 'bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,transparent_4px_8px)]',
      )}
      title={`Walking ${venueName(entry.from)} → ${venueName(entry.to)}: ${entry.minutes} min${entry.tight ? ' (too tight)' : ''}`}
    />
  );
}

function SwitchBadge({ summary }: { summary: DaySummary | undefined }): ReactNode {
  if (!summary || summary.switches === 0) return null;
  const over = summary.switches > summary.maxSwitches;
  const route = summary.route.map(venueName).join(' → ');
  const label = `${summary.switches} switch${summary.switches === 1 ? '' : 'es'}`;
  return (
    <div
      className={cn(
        'mt-0.5 flex w-fit max-w-full items-center gap-1 truncate rounded px-1.5 py-px text-[10px]',
        over ? 'bg-destructive font-semibold text-white' : 'bg-muted text-muted-foreground',
      )}
      title={`${over ? `Over your limit of ${summary.maxSwitches} venue switch${summary.maxSwitches === 1 ? '' : 'es'} per day. ` : ''}Route: ${route}`}
    >
      {over && <TriangleAlert className="size-3 shrink-0" />}
      <span className="truncate">{over ? `${label} · max ${summary.maxSwitches}` : label}</span>
    </div>
  );
}

// A bold pill in the middle of the gap between two entries at different venues; red when over the daily limit or too tight.
function SwitchMarker({ entry, overLimit }: { entry: TravelEntry; overLimit: boolean }): ReactNode {
  const middle = (entry.startMin + entry.gapEndMin) / 2;
  if (middle < GRID_START || middle > GRID_END) return null;
  const problem = entry.tight ? ' (gap too short to travel)' : overLimit ? ' (over your daily venue-switch limit)' : '';
  return (
    <div className="pointer-events-none absolute inset-x-0 z-20 flex -translate-y-1/2 justify-center px-1" style={{ top: (middle - GRID_START) * PX_PER_MIN }}>
      <span
        className={cn(
          'pointer-events-auto flex max-w-full items-center gap-1 truncate rounded-full border px-1.5 py-px text-[10px] leading-4 font-semibold shadow-sm',
          entry.tight ? 'border-destructive bg-destructive text-white' : overLimit ? 'border-destructive bg-background text-destructive' : 'border-foreground bg-foreground text-background',
        )}
        title={`Venue switch: ${venueName(entry.from)} → ${venueName(entry.to)}, ${entry.minutes} min walk, ${entry.gapEndMin - entry.startMin} min gap${problem}`}
      >
        <ArrowLeftRight className="size-3 shrink-0" />
        <span className="truncate">
          {venueShort(entry.from)} → {venueShort(entry.to)}
          <span className="hidden @[9rem]:inline"> · {entry.minutes}m</span>
        </span>
      </span>
    </div>
  );
}
