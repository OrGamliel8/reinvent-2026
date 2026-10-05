import type { ReactNode } from 'react';
import { Sparkles } from 'lucide-react';
import type { AutoBuildResult } from '@/core/types';
import { useUi } from '../UiState';
import { EmptyState } from '../shared/EmptyState';

export function AutoBuildPanel({ result }: { result: AutoBuildResult | null }): ReactNode {
  const { openSession } = useUi();
  if (!result) {
    return (
      <EmptyState icon={Sparkles} title="Auto-build">
        Fills your agenda with pinned items first, then starred sessions, then top-ranked ones. Pinned items never move.
      </EmptyState>
    );
  }
  const counts = result.agenda.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.origin]: (acc[item.origin] ?? 0) + 1 }), {});
  return (
    <div className="space-y-3">
      <p className="text-sm">
        Placed <strong>{result.agenda.length}</strong> items
        <span className="text-muted-foreground">
          {' '}
          ({Object.entries(counts)
            .map(([origin, n]) => `${n} ${origin}`)
            .join(', ')}
          )
        </span>
      </p>
      {result.unplaced.length === 0 ? (
        <p className="text-sm text-success">Every starred session fit.</p>
      ) : (
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Starred sessions that didn't fit</p>
          <ul className="divide-y rounded-md border">
            {result.unplaced.map((u) => (
              <li key={u.sessionKey} className="px-2.5 py-1.5 text-xs">
                <button className="text-left font-medium hover:underline" onClick={() => openSession(u.sessionKey)}>
                  {u.title}
                </button>
                <div className="text-muted-foreground">{u.reason}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
