import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { DAYS, type DayId, type DayWindow, type Profile } from '@/core/types';

// Comma- or newline-separated list, parsed on blur so typing commas feels natural.
export function ListInput({ value, onChange, placeholder, rows = 2 }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; rows?: number }): ReactNode {
  const [text, setText] = useState(value.join(', '));
  const commit = (): void => {
    const next = text
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);
    onChange(next);
    setText(next.join(', '));
  };
  return <Textarea value={text} rows={rows} placeholder={placeholder} onChange={(e) => setText(e.target.value)} onBlur={commit} className="min-h-0 text-xs" />;
}

interface WeightMapEditorProps {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
  options: string[];
  min?: number;
  max?: number;
  addLabel: string;
}

// Name -> weight editor; names are picked from the catalog vocabulary so tag matching hits.
export function WeightMapEditor({ value, onChange, options, min = 0, max = 1, addLabel }: WeightMapEditorProps): ReactNode {
  const entries = Object.entries(value);
  const remaining = options.filter((o) => !(o in value));
  const set = (name: string, weight: number): void => onChange({ ...value, [name]: weight });
  const remove = (name: string): void => onChange(Object.fromEntries(entries.filter(([n]) => n !== name)));
  return (
    <div className="space-y-1.5">
      {entries.map(([name, weight]) => (
        <div key={name} className="grid grid-cols-[minmax(0,14rem)_1fr_2.5rem_1.5rem] items-center gap-3">
          <span className={!options.includes(name) ? 'truncate text-xs text-destructive' : 'truncate text-xs'} title={options.includes(name) ? name : `${name} is not in the catalog vocabulary`}>
            {name}
          </span>
          <Slider min={min} max={max} step={0.05} value={[weight]} onValueChange={([w]) => set(name, w)} />
          <span className="text-right font-mono text-xs tabular-nums">{weight.toFixed(2)}</span>
          <Button size="icon-xs" variant="ghost" aria-label={`Remove ${name}`} onClick={() => remove(name)}>
            <X />
          </Button>
        </div>
      ))}
      {remaining.length > 0 && (
        <Select value="" onValueChange={(name) => set(name, max > 0 ? Math.min(max, 0.5) : 0)}>
          <SelectTrigger size="sm" className="w-64 text-xs">
            <Plus className="size-3.5" />
            <SelectValue placeholder={addLabel} />
          </SelectTrigger>
          <SelectContent>
            {remaining.map((o) => (
              <SelectItem key={o} value={o}>
                {o}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

export function WindowInput({ value, onChange }: { value: DayWindow; onChange: (w: DayWindow) => void }): ReactNode {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="time" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} className="h-7 w-24 px-1.5 text-xs" />
      <span className="text-xs text-muted-foreground">–</span>
      <Input type="time" value={value.end} onChange={(e) => onChange({ ...value, end: e.target.value })} className="h-7 w-24 px-1.5 text-xs" />
    </div>
  );
}

const DEFAULT_WINDOW: DayWindow = { start: '08:00', end: '18:00' };
const DEFAULT_LUNCH: DayWindow = { start: '12:00', end: '13:00' };

export function LevelSelect({ levels, value, onChange, label }: { levels: number[]; value: number; onChange: (v: number) => void; label?: string }): ReactNode {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="w-20 text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {levels.map((l) => (
          <SelectItem key={l} value={String(l)}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type Availability = Profile['availability'];

export function AvailabilityFields({ availability, onChange }: { availability: Availability; onChange: (v: Availability) => void }): ReactNode {
  const setDay = (day: DayId, window: DayWindow | undefined): void => {
    const days = { ...availability.days };
    if (window) days[day] = window;
    else delete days[day];
    onChange({ ...availability, days });
  };
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {DAYS.map((d) => {
          const window = availability.days[d.id];
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <label className="flex w-32 items-center gap-2 text-sm">
                <Checkbox checked={!!window} onCheckedChange={(c) => setDay(d.id, c === true ? DEFAULT_WINDOW : undefined)} />
                {d.label}
              </label>
              {window ? <WindowInput value={window} onChange={(w) => setDay(d.id, w)} /> : <span className="text-xs text-muted-foreground">Not attending</span>}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex w-32 items-center gap-2 text-sm">
          <Checkbox checked={!!availability.lunch} onCheckedChange={(c) => onChange({ ...availability, lunch: c === true ? DEFAULT_LUNCH : null })} />
          Lunch break
        </label>
        {availability.lunch ? (
          <WindowInput value={availability.lunch} onChange={(lunch) => onChange({ ...availability, lunch })} />
        ) : (
          <span className="text-xs text-muted-foreground">No lunch break kept free</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-32 text-sm font-normal">Max per day</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={availability.maxPerDay}
          onChange={(e) => onChange({ ...availability, maxPerDay: Number(e.target.value) })}
          className="h-7 w-20 text-xs"
        />
      </div>
    </div>
  );
}
