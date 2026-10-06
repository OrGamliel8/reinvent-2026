import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { usePlanner } from '../PlannerProvider';

const QUICK: { label: string; score: number }[] = [
  { label: 'Must', score: 100 },
  { label: 'High', score: 75 },
  { label: 'Medium', score: 50 },
  { label: 'Low', score: 25 },
  { label: 'Skip', score: 0 },
];

interface ScoreProps {
  sessionKey: string;
  score: number; // effective
  computedScore: number;
  manualScore: number | null;
}

export function scoreTooltip({ computedScore, manualScore }: Pick<ScoreProps, 'computedScore' | 'manualScore'>): string {
  return manualScore !== null ? `Your score · computed ${computedScore.toFixed(1)}` : `Computed score ${computedScore.toFixed(1)} · click to set your own`;
}

// Score cell of the Explore list: effective score bar; click to set your own. Arrow up/down jump to the neighbouring row's score.
// When a focused row leaves the list (re-sorted off the page, or filtered out by "Not scored yet"), focus moves to the row now in its place.
export function ScoreCell({ max, ...props }: ScoreProps & { max: number }): ReactNode {
  const { score, manualScore } = props;
  const buttonRef = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => {
    const button = buttonRef.current;
    return () => {
      const row = button?.closest('tr');
      const body = row?.parentElement;
      const active = document.activeElement;
      if (!button || !row || !body || (active !== button && !active?.closest('[data-score-popover]'))) return;
      const index = [...body.children].indexOf(row);
      requestAnimationFrame(() => {
        if (document.activeElement !== document.body || !body.isConnected) return;
        const rows = [...body.children];
        rows[Math.min(index, rows.length - 1)]?.querySelector<HTMLButtonElement>('[data-score-trigger]')?.focus();
      });
    };
  }, []);
  const manual = manualScore !== null;
  const ratio = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
  return (
    <ManualScorePopover {...props}>
      <button
        ref={buttonRef}
        data-score-trigger
        className="flex items-center gap-1.5 rounded px-1 py-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        title={scoreTooltip(props)}
        aria-label={manual ? `Your score ${score}. Change it` : `Score ${score.toFixed(1)}. Set your score`}
        onKeyDown={moveBetweenRows}
      >
        <div className="h-1.5 w-8 overflow-hidden rounded-full bg-muted">
          <div className={cn('h-full rounded-full', manual ? 'bg-info' : 'bg-primary')} style={{ width: `${ratio * 100}%` }} />
        </div>
        <span className={cn('w-7 text-right font-mono text-xs tabular-nums', manual ? 'font-semibold text-info' : 'text-muted-foreground')}>
          {manual ? score : score.toFixed(1)}
        </span>
        <Pencil className={cn('size-2.5', manual ? 'text-info' : 'text-transparent')} aria-hidden />
      </button>
    </ManualScorePopover>
  );
}

// Compact "Your score" button for the session drawer.
export function ManualScoreButton(props: ScoreProps): ReactNode {
  const manual = props.manualScore !== null;
  return (
    <ManualScorePopover {...props}>
      <Button size="xs" variant="outline" className={cn(manual && 'border-info/50 text-info')} title={scoreTooltip(props)}>
        <Pencil />
        {manual ? `Your score ${props.manualScore}` : 'Set your score'}
      </Button>
    </ManualScorePopover>
  );
}

function ManualScorePopover({ sessionKey, computedScore, manualScore, children }: ScoreProps & { children: ReactNode }): ReactNode {
  const { mutate } = usePlanner();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const save = (score: number | null): void => {
    setOpen(false);
    void mutate((api) => api.setManualScore(sessionKey, score));
  };

  const saveDraft = (): void => {
    if (validDraft(draft)) save(Number(draft));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
    const quick = QUICK[Number(e.key) - 1];
    if (quick) {
      e.preventDefault();
      save(quick.score);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft(manualScore === null ? '' : String(manualScore));
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        data-score-popover
        align="start"
        className="w-64 gap-2 p-2"
        onKeyDown={onKeyDown}
        onOpenAutoFocus={(e) => {
          // Focus the panel (not the input) so 1–5 pick a quick score right away.
          e.preventDefault();
          contentRef.current?.focus();
        }}
        tabIndex={-1}
      >
        <div className="flex items-baseline justify-between text-xs">
          <span className="font-medium">Your score</span>
          <span className="text-muted-foreground">computed {computedScore.toFixed(1)}</span>
        </div>
        <div className="grid grid-cols-5 gap-1">
          {QUICK.map((q, i) => (
            <Button
              key={q.score}
              size="xs"
              variant={manualScore === q.score ? 'secondary' : 'outline'}
              className="h-auto flex-col gap-0 px-0 py-1"
              onClick={() => save(q.score)}
              title={`${q.label} (${q.score}) · key ${i + 1}`}
            >
              <span className="text-[11px]">{q.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {q.score} · {i + 1}
              </span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            max={100}
            step={1}
            value={draft}
            placeholder={computedScore.toFixed(0)}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveDraft();
              }
            }}
            className="h-7 flex-1 text-xs"
            aria-invalid={draft.trim() !== '' && !validDraft(draft)}
            aria-label="Score from 0 to 100"
          />
          <Button size="xs" onClick={saveDraft} disabled={!validDraft(draft)}>
            Save
          </Button>
        </div>
        <Button size="xs" variant="ghost" className="justify-start text-muted-foreground" disabled={manualScore === null} onClick={() => save(null)}>
          <RotateCcw /> Reset to computed
        </Button>
      </PopoverContent>
    </Popover>
  );
}

function validDraft(draft: string): boolean {
  const value = Number(draft);
  return draft.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100;
}

function moveBetweenRows(e: KeyboardEvent<HTMLButtonElement>): void {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
  const row = e.currentTarget.closest('tr');
  const next = e.key === 'ArrowDown' ? row?.nextElementSibling : row?.previousElementSibling;
  const target = next?.querySelector<HTMLButtonElement>('[data-score-trigger]');
  if (target) {
    e.preventDefault();
    target.focus();
  }
}
