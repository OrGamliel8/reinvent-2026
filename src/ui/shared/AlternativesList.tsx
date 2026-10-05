import type { ReactNode } from 'react';
import { ArrowRightLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Alternative } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { useUi } from '../UiState';
import { dayShort, fmtRange, lvDay, venueName } from '../format';
import { FitBadge } from './badges';

interface AlternativesListProps {
  alternatives: Alternative[];
  replaceItemId: string | null; // when set, choosing an alternative swaps out this agenda item
  onDone?: () => void;
}

export function AlternativesList({ alternatives, replaceItemId, onDone }: AlternativesListProps): ReactNode {
  const { mutate } = usePlanner();
  const { openSession } = useUi();

  const choose = async (alternative: Alternative): Promise<void> => {
    await mutate(async (api) => {
      const added = await api.addSlot(alternative.slotId);
      if (replaceItemId && added.id !== replaceItemId) await api.removeItem(replaceItemId);
    }, replaceItemId ? `Swapped to ${alternative.code}` : `Added ${alternative.code}`);
    onDone?.();
  };

  if (alternatives.length === 0) return <p className="text-xs text-muted-foreground">No alternatives found.</p>;

  return (
    <ul className="divide-y rounded-md border">
      {alternatives.map((alt) => (
        <li key={alt.slotId} className="flex items-center gap-3 px-2.5 py-1.5 text-xs">
          <span className="w-20 shrink-0 whitespace-nowrap text-muted-foreground">{alt.kind === 'otherSlot' ? 'Other slot' : 'Other session'}</span>
          <button className="min-w-0 flex-1 text-left hover:underline" onClick={() => openSession(alt.sessionKey)}>
            <span className="font-mono text-muted-foreground">{alt.code}</span> <span className="font-medium">{alt.title}</span>
            <span className="block text-muted-foreground">
              {dayShort(lvDay(alt.start))} {fmtRange(alt.start, alt.end)} · {venueName(alt.venue)}
            </span>
          </button>
          <FitBadge fit={alt.fit} />
          <Button size="xs" variant="outline" onClick={() => void choose(alt)}>
            {replaceItemId ? <ArrowRightLeft /> : <Plus />}
            {replaceItemId ? 'Swap' : 'Add'}
          </Button>
        </li>
      ))}
    </ul>
  );
}
