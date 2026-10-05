import type { ReactNode } from 'react';
import { Footprints, Pin, PinOff, Trash2 } from 'lucide-react';
import { DAYS } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner } from '../PlannerProvider';
import { useUi } from '../UiState';
import { VENUE_COLORS, fmtMinutes, venueName } from '../format';
import { OriginBadge } from '../shared/badges';
import { placeDay, type BlockEntry, type CalendarEntry, type PlacedEntry, type SessionEntry, type TravelEntry } from './calendarModel';

const GRID_START = 7 * 60;
const GRID_END = 21 * 60;
const PX_PER_MIN = 1.1;

interface WeekCalendarProps {
  entries: CalendarEntry[];
  conflictItemIds: Set<string>;
}

export function WeekCalendar({ entries, conflictItemIds }: WeekCalendarProps): ReactNode {
  const hours = Array.from({ length: (GRID_END - GRID_START) / 60 + 1 }, (_, i) => GRID_START + i * 60);
  const height = (GRID_END - GRID_START) * PX_PER_MIN;
  return (
    <div className="min-w-[760px]">
      <div className="sticky top-0 z-20 grid grid-cols-[3.5rem_repeat(5,1fr)] border-b bg-background">
        <div />
        {DAYS.map((d) => (
          <div key={d.id} className="border-l px-2 py-1.5 text-xs font-medium">
            {d.label}
            <span className="ml-1.5 text-muted-foreground">{entries.filter((e) => e.day === d.id && e.type === 'session').length || ''}</span>
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
          <div key={d.id} className="relative border-l" style={{ height }}>
            {hours.map((m) => (
              <div key={m} className="absolute inset-x-0 border-t border-border/50" style={{ top: (m - GRID_START) * PX_PER_MIN }} />
            ))}
            {placeDay(entries.filter((e) => e.day === d.id)).map((entry) => (
              <Positioned key={entry.id} entry={entry}>
                <EntryCard entry={entry} conflict={entry.type === 'session' && conflictItemIds.has(entry.id)} />
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

function EntryCard({ entry, conflict }: { entry: CalendarEntry; conflict: boolean }): ReactNode {
  if (entry.type === 'session') return <SessionCard entry={entry} conflict={conflict} />;
  if (entry.type === 'block') return <BlockCard entry={entry} />;
  return <TravelCard entry={entry} />;
}

function SessionCard({ entry, conflict }: { entry: SessionEntry; conflict: boolean }): ReactNode {
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
        'flex h-full items-start gap-1 overflow-hidden rounded-sm px-1 text-[10px]',
        entry.tight ? 'bg-destructive/10 text-destructive' : 'bg-[repeating-linear-gradient(135deg,var(--muted)_0_4px,transparent_4px_8px)] text-muted-foreground',
      )}
      title={`${venueName(entry.from)} → ${venueName(entry.to)}: ${entry.minutes} min${entry.tight ? ' (too tight)' : ''}`}
    >
      <Footprints className="size-3 shrink-0" />
      <span className="truncate">{entry.minutes}m</span>
    </div>
  );
}
