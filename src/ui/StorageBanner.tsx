import { useState, type ReactNode } from 'react';
import { DatabaseBackup, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanner, usePlannerQuery } from './PlannerProvider';
import { saveBackup } from './backup';

const DISMISSED_KEY = 'planner-storage-banner-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
}

// Shown when the worker fell back to the in-memory store (private window, blocked site storage, or ?memory=1).
export function StorageBanner(): ReactNode {
  const { api } = usePlanner();
  const { data: status } = usePlannerQuery((planner) => planner.storageStatus(), []);
  const [dismissed, setDismissed] = useState(readDismissed);
  if (!status || status.persistent || dismissed) return null;

  const dismiss = (): void => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISSED_KEY, '1');
    } catch {
      // storage blocked: the banner comes back on the next load, which is fine
    }
  };

  return (
    <div role="status" className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-warning/40 bg-warning/15 px-3 py-2 text-sm lg:px-4">
      <TriangleAlert className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1" title={status.reason ?? undefined}>
        Your plan isn't being saved in this browser — it will be lost when you close or reload this tab.{' '}
        <span className="text-muted-foreground">(Private window or blocked site storage.)</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => void saveBackup(api)}>
          <DatabaseBackup /> Export backup
        </Button>
        <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={dismiss}>
          Dismiss for now
        </Button>
      </div>
    </div>
  );
}
