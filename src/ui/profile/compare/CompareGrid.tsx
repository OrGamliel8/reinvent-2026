import { useState, type ReactNode } from 'react';
import type { CompareCellStatus, CompareResult, DayId } from '@/core/types';
import { cn } from '@/lib/utils';
import { useUi } from '../../UiState';
import { fmtRange, venueName } from '../../format';
import { DayPicker } from '../../shared/DayPicker';
import type { PersonInfo } from './people';

const STATUS_STYLES: Record<CompareCellStatus, string> = {
  together: 'border-success/50 bg-success/15 hover:bg-success/25',
  split: 'border-warning/60 bg-warning/15 hover:bg-warning/25',
  solo: 'border-border bg-muted/60 hover:bg-muted',
};

const LEGEND: { status: CompareCellStatus; label: string }[] = [
  { status: 'together', label: 'Together (same slot)' },
  { status: 'split', label: 'Split (different sessions at once)' },
  { status: 'solo', label: 'Only one person' },
];

// Time rows × person columns for one day. The table scrolls horizontally inside its own container.
export function CompareGrid({ result, people }: { result: CompareResult; people: Map<string, PersonInfo> }): ReactNode {
  const { openSession } = useUi();
  const days = result.days.map((d) => d.day);
  const [picked, setDay] = useState<DayId | null>(null);
  const day = picked && days.includes(picked) ? picked : days[0];
  const rows = result.days.find((d) => d.day === day)?.rows ?? [];
  const ids = result.people.map((p) => p.id);
  if (!day) return <p className="text-sm text-muted-foreground">Nobody has a timed session on their agenda yet.</p>;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DayPicker value={day} onChange={setDay} options={days} short />
        <ul className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {LEGEND.map(({ status, label }) => (
            <li key={status} className="flex items-center gap-1.5">
              <span className={cn('size-3 rounded-sm border', STATUS_STYLES[status])} />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="sticky left-0 z-10 w-28 min-w-28 bg-muted px-2 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
              {ids.map((id) => (
                <th key={id} className="min-w-44 px-2 py-2 text-left text-xs font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className={cn('size-2.5 shrink-0 rounded-full', people.get(id)?.color)} />
                    <span className="truncate">{people.get(id)?.name}</span>
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.start + row.end + ids.map((id) => row.cells[id]?.slotId).join()} className="border-b last:border-b-0">
                <td className="sticky left-0 z-10 bg-background px-2 py-1.5 align-top text-xs whitespace-nowrap text-muted-foreground tabular-nums">
                  {fmtRange(row.start, row.end)}
                </td>
                {ids.map((id) => {
                  const cell = row.cells[id];
                  return (
                    <td key={id} className="px-1.5 py-1.5 align-top">
                      {cell ? (
                        <button
                          type="button"
                          onClick={() => openSession(cell.sessionKey)}
                          className={cn('w-full rounded-md border px-2 py-1 text-left transition-colors', STATUS_STYLES[cell.status])}
                        >
                          <span className="line-clamp-2 text-xs font-medium">{cell.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {cell.slotCode} · {venueName(cell.venue)}
                          </span>
                        </button>
                      ) : (
                        <span className="block px-2 py-1 text-xs text-muted-foreground/60">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
