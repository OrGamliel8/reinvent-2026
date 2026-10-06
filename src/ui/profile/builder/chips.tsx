import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { DraftWeight } from '@/core/types';
import { cn } from '@/lib/utils';

const WEIGHTS: { value: DraftWeight; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Med' },
  { value: 'low', label: 'Low' },
];

const chipBase = 'inline-flex items-center rounded-full border text-xs transition-colors';
const chipOn = 'border-primary/60 bg-primary/10 text-foreground';
const chipOff = 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground';

// A selectable chip; when selected it shows a High / Med / Low weight switch.
export function WeightChip({ name, weight, onChange }: { name: string; weight: DraftWeight | undefined; onChange: (w: DraftWeight | undefined) => void }): ReactNode {
  return (
    <div className={cn(chipBase, weight ? chipOn : chipOff)}>
      <button type="button" className="px-3 py-1" aria-pressed={!!weight} onClick={() => onChange(weight ? undefined : 'high')}>
        {name}
      </button>
      {weight && (
        <div role="radiogroup" aria-label={`${name} weight`} className="flex overflow-hidden rounded-r-full border-l border-primary/30">
          {WEIGHTS.map((w) => (
            <button
              key={w.value}
              type="button"
              role="radio"
              aria-checked={weight === w.value}
              className={cn('px-1.5 py-1 text-[0.7rem]', weight === w.value ? 'bg-primary text-primary-foreground' : 'hover:bg-primary/15')}
              onClick={() => onChange(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function WeightChips({ options, value, onChange }: { options: string[]; value: Record<string, DraftWeight>; onChange: (v: Record<string, DraftWeight>) => void }): ReactNode {
  const set = (name: string, weight: DraftWeight | undefined): void => {
    const next = { ...value };
    if (weight) next[name] = weight;
    else delete next[name];
    onChange(next);
  };
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((name) => (
        <WeightChip key={name} name={name} weight={value[name]} onChange={(w) => set(name, w)} />
      ))}
    </div>
  );
}

export function ToggleChips({ options, selected, onChange }: { options: string[]; selected: string[]; onChange: (v: string[]) => void }): ReactNode {
  const toggle = (name: string): void => onChange(selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((name) => (
        <button key={name} type="button" aria-pressed={selected.includes(name)} className={cn(chipBase, 'px-3 py-1', selected.includes(name) ? chipOn : chipOff)} onClick={() => toggle(name)}>
          {name}
        </button>
      ))}
    </div>
  );
}

export function RemovableChips({ values, onRemove }: { values: string[]; onRemove: (v: string) => void }): ReactNode {
  if (values.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v) => (
        <span key={v} className={cn(chipBase, chipOn, 'gap-1 py-1 pr-1 pl-3')}>
          {v}
          <button type="button" aria-label={`Remove ${v}`} className="rounded-full p-0.5 hover:bg-primary/20" onClick={() => onRemove(v)}>
            <X className="size-3" />
          </button>
        </span>
      ))}
    </div>
  );
}
