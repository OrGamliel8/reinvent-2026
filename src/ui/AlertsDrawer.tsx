import type { ReactNode } from 'react';
import { BellOff, Check, RefreshCw, Search, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AgendaItem, AlertKind, ChangeAlert, SlotFingerprint } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner, usePlannerQuery } from './PlannerProvider';
import { useUi } from './UiState';
import { dayShort, fmtRange, lvDay, venueName } from './format';
import { EmptyState } from './shared/EmptyState';

const KIND: Record<AlertKind, { label: string; className: string }> = {
  moved: { label: 'Moved', className: 'bg-warning/20 text-warning' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive/15 text-destructive' },
  removed: { label: 'Removed', className: 'bg-destructive/15 text-destructive' },
  newConflict: { label: 'New conflict', className: 'bg-destructive/15 text-destructive' },
  tbaScheduled: { label: 'Now scheduled', className: 'bg-success/15 text-success' },
};

export function AlertsDrawer(): ReactNode {
  const { alertsOpen, setAlertsOpen } = useUi();
  return (
    <Sheet open={alertsOpen} onOpenChange={setAlertsOpen}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-lg">
        <SheetHeader className="border-b p-4">
          <SheetTitle>Change alerts</SheetTitle>
          <SheetDescription>What changed in your plan since the last catalog refresh.</SheetDescription>
        </SheetHeader>
        {alertsOpen && <AlertList />}
      </SheetContent>
    </Sheet>
  );
}

function AlertList(): ReactNode {
  const { data } = usePlannerQuery(async (api) => ({ alerts: await api.detectChanges(), agenda: await api.agenda() }), []);
  if (!data) return <p className="p-4 text-sm text-muted-foreground">Checking…</p>;
  if (data.alerts.length === 0) return <EmptyState icon={BellOff} title="No changes">Your agenda matches the current catalog.</EmptyState>;
  return (
    <ul className="flex-1 divide-y overflow-y-auto">
      {data.alerts.map((alert) => (
        <AlertRow key={alert.id} alert={alert} item={data.agenda.find((i) => i.id === alert.itemId) ?? null} />
      ))}
    </ul>
  );
}

function AlertRow({ alert, item }: { alert: ChangeAlert; item: AgendaItem | null }): ReactNode {
  const { mutate } = usePlanner();
  const { openSession, openAlternatives, setAlertsOpen } = useUi();
  const kind = KIND[alert.kind];

  const findAlternative = (): void => {
    openAlternatives({
      ref: item ? { slotId: item.slotId } : { sessionKey: alert.sessionKey },
      replaceItemId: item?.id ?? null,
      title: alert.title,
    });
  };

  const rerunAutoBuild = async (): Promise<void> => {
    const result = await mutate((api) => api.autoBuild());
    if (result) toast.success(`Auto-build placed ${result.agenda.length} items, ${result.unplaced.length} starred unplaced`);
  };

  return (
    <li className="space-y-2 p-4">
      <div className="flex items-center gap-2">
        <span className={cn('rounded px-1.5 py-px text-[11px] font-medium', kind.className)}>{kind.label}</span>
        <button
          className="min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline"
          onClick={() => {
            setAlertsOpen(false);
            openSession(alert.sessionKey);
          }}
        >
          {alert.title}
        </button>
      </div>
      <p className="text-sm text-muted-foreground">{alert.message}</p>
      {(alert.before || alert.after) && (
        <div className="grid grid-cols-[3.5rem_1fr] gap-x-2 text-xs">
          {alert.before && <Fingerprint label="Before" fp={alert.before} />}
          {alert.after && <Fingerprint label="After" fp={alert.after} />}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {item && alert.kind !== 'removed' && (
          <Button size="xs" variant="outline" onClick={() => void mutate((api) => api.acceptChange(alert.id), 'Change accepted')}>
            <Check /> Accept change
          </Button>
        )}
        <Button size="xs" variant="outline" onClick={findAlternative}>
          <Search /> Find alternative
        </Button>
        <Button size="xs" variant="outline" onClick={() => void rerunAutoBuild()}>
          <RefreshCw /> Re-run auto-build
        </Button>
        <Button size="xs" variant="ghost" onClick={() => void mutate((api) => api.dismissAlert(alert.id))}>
          <X /> Dismiss
        </Button>
      </div>
    </li>
  );
}

function Fingerprint({ label, fp }: { label: string; fp: SlotFingerprint }): ReactNode {
  const text = fp.exists ? `${dayShort(lvDay(fp.start))} ${fmtRange(fp.start, fp.end)} · ${venueName(fp.venue)}${fp.room ? ` · ${fp.room}` : ''}` : 'No longer exists';
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span>{text}</span>
    </>
  );
}
