import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ItemOrigin, ReservationStatus, SlotFit } from '@/core/types';

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

export function StatusBadge({ status }: { status: ReservationStatus }): ReactNode {
  return <Badge className={cn('rounded-md capitalize', STATUS[status])}>{status}</Badge>;
}

export function ScorePill({ score, max }: { score: number; max: number }): ReactNode {
  const ratio = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  return (
    <div className="flex items-center gap-1.5" title={`Score ${score.toFixed(2)}`}>
      <div className="h-1.5 w-10 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={{ width: `${ratio * 100}%` }} />
      </div>
      <span className="w-8 text-right font-mono text-xs tabular-nums text-muted-foreground">{score.toFixed(1)}</span>
    </div>
  );
}
