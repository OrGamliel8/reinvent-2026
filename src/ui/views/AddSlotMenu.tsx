import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Session, Slot, SlotFit } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { slotWhen, venueName } from '../format';
import { FitBadge } from '../shared/badges';

// "+ add": pick which slot of the session goes on the agenda. Slots matching the current filters (`matchingSlotIds`) come first.
export function AddSlotMenu({ session, matchingSlotIds }: { session: Session; matchingSlotIds?: string[] }): ReactNode {
  const timed = session.slots.filter((s) => s.start);
  if (timed.length === 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-xs" variant="ghost" aria-label="Add to agenda">
          <Plus />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <SlotOptions session={session} matchingSlotIds={matchingSlotIds} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SlotOptions({ session, matchingSlotIds }: { session: Session; matchingSlotIds?: string[] }): ReactNode {
  const timed = session.slots.filter((s) => s.start);
  const matches = (slot: Slot): boolean => !matchingSlotIds || matchingSlotIds.includes(slot.slotId);
  const matching = timed.filter(matches);
  const others = timed.filter((slot) => !matches(slot));
  const { data: fits } = usePlannerQuery(async (api) => new Map(await Promise.all(timed.map(async (s) => [s.slotId, await api.slotFit(s.slotId)] as const))), [session.key]);
  return (
    <>
      <DropdownMenuLabel className="text-xs">Add a slot of {session.code}</DropdownMenuLabel>
      {matching.map((slot) => (
        <SlotOption key={slot.slotId} slot={slot} fit={fits?.get(slot.slotId)} />
      ))}
      {matching.length > 0 && others.length > 0 && (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Outside the current filters</DropdownMenuLabel>
        </>
      )}
      {others.map((slot) => (
        <SlotOption key={slot.slotId} slot={slot} fit={fits?.get(slot.slotId)} />
      ))}
    </>
  );
}

function SlotOption({ slot, fit }: { slot: Slot; fit: SlotFit | undefined }): ReactNode {
  const { mutate } = usePlanner();
  return (
    <DropdownMenuItem onSelect={() => void mutate((api) => api.addSlot(slot.slotId), `Added ${slot.code}`)}>
      <div className="min-w-0 flex-1">
        <div className="text-sm">{slotWhen(slot)}</div>
        <div className="text-xs text-muted-foreground">
          {slot.code} · {venueName(slot.venue)}
        </div>
      </div>
      {fit && <FitBadge fit={fit} />}
    </DropdownMenuItem>
  );
}
