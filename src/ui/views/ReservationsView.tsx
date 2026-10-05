import { Fragment, type ReactNode } from 'react';
import { ClipboardList } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChecklistItem, ReservationStatus } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { slotWhen, venueName } from '../format';
import { StatusBadge } from '../shared/badges';
import { CopyButton } from '../shared/CopyButton';
import { EmptyState } from '../shared/EmptyState';
import { AlternativesList } from '../shared/AlternativesList';

const STATUSES: ReservationStatus[] = ['none', 'reserved', 'waitlisted', 'failed', 'walk-up'];

export function ReservationsView(): ReactNode {
  const { data: items } = usePlannerQuery((api) => api.reservationChecklist(), []);
  if (!items) return null;
  if (items.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title="Nothing to reserve yet">
        Add sessions to My Agenda (or run Auto-build). The checklist orders them by priority and scarcity so you reserve the hardest ones first.
      </EmptyState>
    );
  }
  const counts = STATUSES.map((s) => [s, items.filter((i) => i.status === s).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center gap-3 px-4 py-3">
        <p className="text-sm text-muted-foreground">Reserve top to bottom: smallest rooms, single-slot and hands-on sessions come first.</p>
        <div className="ml-auto flex gap-1.5">
          {counts.map(([status, n]) => (
            <span key={status} className="flex items-center gap-1 text-xs">
              <StatusBadge status={status} /> {n}
            </span>
          ))}
        </div>
      </div>
      <Table className="text-[13px]">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="w-36">Code</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-44">Slot</TableHead>
            <TableHead className="w-32">Venue</TableHead>
            <TableHead className="w-32">Room</TableHead>
            <TableHead className="w-16 text-right">Seats</TableHead>
            <TableHead className="w-36">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item, index) => (
            <ChecklistRow key={item.itemId} item={item} index={index} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ChecklistRow({ item, index }: { item: ChecklistItem; index: number }): ReactNode {
  const { mutate } = usePlanner();
  const { openSession } = useUi();
  const failed = item.status === 'failed';
  return (
    <Fragment>
      <TableRow className={cn(failed && 'border-b-0 bg-destructive/5')}>
        <TableCell className="text-muted-foreground tabular-nums">{index + 1}</TableCell>
        <TableCell>
          <span className="font-mono text-xs">{item.code}</span>
          <CopyButton text={item.code} label="Copy session code" />
        </TableCell>
        <TableCell className="max-w-0">
          <button className="block w-full truncate text-left font-medium hover:underline" onClick={() => openSession(item.sessionKey)}>
            {item.title}
          </button>
        </TableCell>
        <TableCell className="text-xs">{slotWhen(item.slot)}</TableCell>
        <TableCell className="text-xs">{venueName(item.slot.venue)}</TableCell>
        <TableCell className="truncate text-xs">{item.slot.room ?? '—'}</TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">{item.slot.seats ?? '—'}</TableCell>
        <TableCell>
          <Select value={item.status} onValueChange={(status) => void mutate((api) => api.setReservationStatus(item.itemId, status as ReservationStatus))}>
            <SelectTrigger size="sm" className="w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
      </TableRow>
      {failed && (
        <TableRow className="bg-destructive/5 hover:bg-destructive/5">
          <TableCell />
          <TableCell colSpan={7} className="pt-0 whitespace-normal">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Alternatives</p>
            <AlternativesList alternatives={item.alternatives} replaceItemId={item.itemId} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}
