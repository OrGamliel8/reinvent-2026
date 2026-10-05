import { useState, type ReactNode } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import type { DayWindow } from '@/core/types';

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
