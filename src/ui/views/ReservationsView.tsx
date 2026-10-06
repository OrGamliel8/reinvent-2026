import { Fragment, type ReactNode } from 'react';
import { ClipboardList, ExternalLink, Star, Wrench } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChecklistItem, ReservationStatus } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { isHandsOn, slotWhen, venueName } from '../format';
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <p className="text-sm text-muted-foreground">Reserve top to bottom: smallest rooms, single-slot and hands-on sessions come first.</p>
        <div className="ml-auto flex gap-1.5">
          {counts.map(([status, n]) => (
            <span key={status} className="flex items-center gap-1 text-xs">
              <StatusBadge status={status} /> {n}
            </span>
          ))}
        </div>
      </div>
      <Table className="min-w-[720px] table-fixed text-[13px]">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="w-28">Code</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-44">Slot</TableHead>
            <TableHead className="hidden w-32 lg:table-cell">Venue</TableHead>
            <TableHead className="hidden w-32 xl:table-cell">Room</TableHead>
            <TableHead className="w-16 text-right">Seats</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="w-24">Portal</TableHead>
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
        <TableCell>
          <div className="flex min-w-0 items-center gap-1.5">
            {item.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Starred" />}
            <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline" title={item.title} onClick={() => openSession(item.sessionKey)}>
              {item.title}
            </button>
            <TypeChip type={item.type} />
          </div>
          <div className="truncate text-xs text-muted-foreground xl:hidden">
            <span className="lg:hidden">{venueName(item.slot.venue)}</span>
            {item.slot.room && <span className="before:content-['_·_'] lg:before:content-none">{item.slot.room}</span>}
          </div>
        </TableCell>
        <TableCell className="text-xs">{slotWhen(item.slot)}</TableCell>
        <TableCell className="hidden text-xs lg:table-cell">{venueName(item.slot.venue)}</TableCell>
        <TableCell className="hidden truncate text-xs xl:table-cell">{item.slot.room ?? '—'}</TableCell>
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
        <TableCell>
          <a
            href={item.portalUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${item.code} in the official re:Invent catalog to reserve it`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap hover:bg-accent"
          >
            Reserve <ExternalLink className="size-3" />
          </a>
        </TableCell>
      </TableRow>
      {failed && (
        <TableRow className="bg-destructive/5 hover:bg-destructive/5">
          <TableCell />
          <TableCell colSpan={8} className="pt-0 whitespace-normal">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Alternatives</p>
            <AlternativesList alternatives={item.alternatives} replaceItemId={item.itemId} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

// Hands-on formats (worth reserving first) get a filled chip with a wrench; talks an outlined one.
function TypeChip({ type }: { type: string }): ReactNode {
  const handsOn = isHandsOn(type);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap',
        handsOn ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground',
      )}
    >
      {handsOn && <Wrench className="size-3" aria-hidden />}
      {type}
    </span>
  );
}
