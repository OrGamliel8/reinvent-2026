import type { ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAYS, type DayId, type Filters, type Vocabulary } from '@/core/types';
import { venueName } from '../format';
import { MultiSelect, toOptions } from '../shared/MultiSelect';

type ListKey = 'venues' | 'types' | 'levels' | 'topics' | 'services' | 'roles' | 'industries' | 'features';
type FlagKey = 'starredOnly' | 'onAgendaOnly' | 'tbaOnly' | 'hideConflicting' | 'showAvoided';

const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'starredOnly', label: 'Starred only' },
  { key: 'onAgendaOnly', label: 'On my agenda' },
  { key: 'tbaOnly', label: 'TBA only' },
  { key: 'hideConflicting', label: 'Hide conflicting' },
  { key: 'showAvoided', label: 'Show avoided' },
];

interface FilterPanelProps {
  vocabulary: Vocabulary;
  filters: Filters;
  onChange: (filters: Filters) => void;
  query: string;
  onQueryChange: (query: string) => void;
}

export function FilterPanel({ vocabulary, filters, onChange, query, onQueryChange }: FilterPanelProps): ReactNode {
  const set = (patch: Partial<Filters>): void => onChange({ ...filters, ...patch });
  const list = <K extends ListKey>(key: K): NonNullable<Filters[K]> => (filters[key] ?? []) as NonNullable<Filters[K]>;
  const setList = (key: ListKey, values: (string | number)[]): void => set({ [key]: values.length ? values : undefined });

  const multi: { key: ListKey; label: string; options: { value: string | number; label: string }[] }[] = [
    { key: 'venues', label: 'Venue', options: toOptions(vocabulary.venues, venueName) },
    { key: 'types', label: 'Type', options: toOptions(vocabulary.types) },
    { key: 'levels', label: 'Level', options: toOptions(vocabulary.levels) },
    { key: 'topics', label: 'Topic', options: toOptions(vocabulary.topics) },
    { key: 'services', label: 'Service', options: toOptions(vocabulary.services) },
    { key: 'roles', label: 'Role', options: toOptions(vocabulary.roles) },
    { key: 'industries', label: 'Industry', options: toOptions(vocabulary.industries) },
    { key: 'features', label: 'Features', options: toOptions(vocabulary.features) },
  ];

  return (
    <aside className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r bg-sidebar p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => onQueryChange(e.target.value)} placeholder="Search titles, speakers, tags…" className="h-8 pl-7 text-sm" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Day</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          value={filters.days ?? []}
          onValueChange={(days: string[]) => set({ days: days.length ? (days as DayId[]) : undefined })}
          className="w-full"
        >
          {DAYS.map((d) => (
            <ToggleGroupItem key={d.id} value={d.id} className="flex-1 px-0 text-xs capitalize" title={d.label}>
              {d.id}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Time (Las Vegas)</Label>
        <div className="flex items-center gap-1.5">
          <Input type="time" value={filters.timeFrom ?? ''} onChange={(e) => set({ timeFrom: e.target.value || undefined })} className="h-7 px-1.5 text-xs" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="time" value={filters.timeTo ?? ''} onChange={(e) => set({ timeTo: e.target.value || undefined })} className="h-7 px-1.5 text-xs" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {multi.map(({ key, label, options }) => (
          <MultiSelect key={key} label={label} options={options} selected={list(key) as (string | number)[]} onChange={(values) => setList(key, values)} />
        ))}
      </div>

      <div className="space-y-2">
        {FLAGS.map(({ key, label }) => (
          <label key={key} className="flex cursor-pointer items-center justify-between text-sm">
            {label}
            <Switch size="sm" checked={filters[key] ?? false} onCheckedChange={(checked) => set({ [key]: checked || undefined })} />
          </label>
        ))}
      </div>

      <Button
        variant="ghost"
        size="sm"
        className="mt-auto"
        onClick={() => {
          onQueryChange('');
          onChange({ sort: filters.sort });
        }}
      >
        <RotateCcw /> Reset filters
      </Button>
    </aside>
  );
}
