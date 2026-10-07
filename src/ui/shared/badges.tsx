import type { ReactNode } from 'react';
import { Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ItemOrigin, ReservationStatus, SlotFit } from '@/core/types';
import { isHandsOn } from '../format';

const FIT: Record<SlotFit, { label: string; className: string }> = {
  free: { label: 'Free', className: 'bg-success/15 text-success' },
  conflict: { label: 'Conflict', className: 'bg-destructive/15 text-destructive' },
  travel: { label: 'Travel too tight', className: 'bg-warning/20 text-warning' },
  outside: { label: 'Outside availability', className: 'bg-muted text-muted-foreground' },
  tba: { label: 'TBA', className: 'bg-muted text-muted-foreground' },
};

export function FitBadge({ fit }: { fit: SlotFit }): ReactNode {
  return <Badge className={cn('rounded-md', FIT[fit].className)}>{FIT[fit].label}</Badge>;
}

const ORIGIN: Record<ItemOrigin, string> = {
  manual: 'border-border text-foreground',
  starred: 'border-warning/40 text-warning',
  suggested: 'border-info/40 text-info',
};

export function OriginBadge({ origin, className }: { origin: ItemOrigin; className?: string }): ReactNode {
  return (
    <Badge variant="outline" className={cn('rounded-md capitalize', ORIGIN[origin], className)}>
      {origin}
    </Badge>
  );
}

export function TbaBadge(): ReactNode {
  return <Badge className="rounded-md bg-warning/20 text-warning">TBA</Badge>;
}

const STATUS: Record<ReservationStatus, string> = {
  none: 'bg-muted text-muted-foreground',
  reserved: 'bg-success/15 text-success',
  waitlisted: 'bg-warning/20 text-warning',
  failed: 'bg-destructive/15 text-destructive',
  'walk-up': 'bg-info/15 text-info',
};

export function StatusBadge({ status, className }: { status: ReservationStatus; className?: string }): ReactNode {
  return <Badge className={cn('rounded-md capitalize', STATUS[status], className)}>{status}</Badge>;
}

// Hands-on formats (worth reserving first) get a filled chip with a wrench; talks an outlined one.
export function TypeChip({ type, className }: { type: string; className?: string }): ReactNode {
  const handsOn = isHandsOn(type);
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] whitespace-nowrap',
        handsOn ? 'border-primary/30 bg-primary/10 text-primary' : 'text-muted-foreground',
        className,
      )}
    >
      {handsOn && <Wrench className="size-3 shrink-0" aria-hidden />}
      <span className="truncate">{type}</span>
    </span>
  );
}
