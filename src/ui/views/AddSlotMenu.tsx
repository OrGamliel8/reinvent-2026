import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Session } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { slotWhen, venueName } from '../format';
import { FitBadge } from '../shared/badges';

// "+ add": pick which slot of the session goes on the agenda.
export function AddSlotMenu({ session }: { session: Session }): ReactNode {
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
        <SlotOptions session={session} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SlotOptions({ session }: { session: Session }): ReactNode {
  const { mutate } = usePlanner();
  const timed = session.slots.filter((s) => s.start);
  const { data: fits } = usePlannerQuery((api) => Promise.all(timed.map((s) => api.slotFit(s.slotId))), [session.key]);
  return (
    <>
      <DropdownMenuLabel className="text-xs">Add a slot of {session.code}</DropdownMenuLabel>
      {timed.map((slot, i) => (
        <DropdownMenuItem key={slot.slotId} onSelect={() => void mutate((api) => api.addSlot(slot.slotId), `Added ${slot.code}`)}>
          <div className="min-w-0 flex-1">
            <div className="text-sm">{slotWhen(slot)}</div>
            <div className="text-xs text-muted-foreground">
              {slot.code} · {venueName(slot.venue)}
            </div>
          </div>
          {fits?.[i] && <FitBadge fit={fits[i]} />}
        </DropdownMenuItem>
      ))}
    </>
  );
}
