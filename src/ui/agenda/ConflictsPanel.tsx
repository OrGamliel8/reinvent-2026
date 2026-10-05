import type { ReactNode } from 'react';
import { CircleCheck } from 'lucide-react';
import type { Conflict, ConflictKind } from '@/core/types';
import { AlternativesList } from '../shared/AlternativesList';
import { EmptyState } from '../shared/EmptyState';

const KIND_LABEL: Record<ConflictKind, string> = {
  overlap: 'Overlap',
  travel: 'Travel too tight',
  availability: 'Outside availability',
  lunch: 'Lunch',
  dailyMax: 'Over daily max',
};

export function ConflictsPanel({ conflicts, titles }: { conflicts: Conflict[]; titles: Map<string, string> }): ReactNode {
  if (conflicts.length === 0) return <EmptyState icon={CircleCheck} title="No conflicts">Your agenda is clash-free.</EmptyState>;
  return (
    <ul className="space-y-3">
      {conflicts.map((c) => (
        <li key={`${c.itemId}-${c.kind}-${c.withId ?? ''}`} className="space-y-2 rounded-md border p-2.5">
          <div className="flex items-center gap-2">
            <span className="rounded bg-destructive/15 px-1.5 py-px text-[11px] font-medium text-destructive">{KIND_LABEL[c.kind]}</span>
            <span className="truncate text-sm font-medium">{titles.get(c.itemId) ?? c.itemId}</span>
          </div>
          <p className="text-xs text-muted-foreground">{c.message}</p>
          {c.alternatives.length > 0 && <AlternativesList alternatives={c.alternatives} replaceItemId={c.itemId} />}
        </li>
      ))}
    </ul>
  );
}
