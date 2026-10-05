import { useMemo, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string | number> {
  label: string;
  options: Option<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  className?: string;
}

export function MultiSelect<T extends string | number>({ label, options, selected, onChange, className }: MultiSelectProps<T>): ReactNode {
  const [search, setSearch] = useState('');
  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  }, [options, search]);

  const toggle = (value: T): void => {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn('justify-between font-normal', selected.length > 0 && 'border-primary/50 text-primary', className)}>
          <span className="truncate">
            {label}
            {selected.length > 0 && <span className="ml-1 font-medium">· {selected.length}</span>}
          </span>
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        {options.length > 8 && (
          <div className="border-b p-2">
            <Input autoFocus placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} className="h-7" />
          </div>
        )}
        <div className="max-h-72 overflow-y-auto p-1">
          {visible.map((option) => (
            <label key={option.value} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
              <Checkbox checked={selected.includes(option.value)} onCheckedChange={() => toggle(option.value)} />
              <span className="truncate">{option.label}</span>
            </label>
          ))}
          {visible.length === 0 && <p className="px-2 py-3 text-center text-xs text-muted-foreground">No matches</p>}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="xs" className="w-full" onClick={() => onChange([])}>
              Clear
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function toOptions<T extends string | number>(values: T[], label: (v: T) => string = String): Option<T>[] {
  return values.map((value) => ({ value, label: label(value) }));
}
