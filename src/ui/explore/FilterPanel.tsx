import type { ReactNode } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAYS, VENUES, type DayId, type Filters, type VenueId, type Vocabulary } from '@/core/types';
import { cn } from '@/lib/utils';
import { VENUE_COLORS } from '../format';
import { SELECTED_CHIP } from '../shared/chipStyles';
import { MultiSelect, toOptions } from '../shared/MultiSelect';

type ListKey = 'types' | 'levels' | 'topics' | 'services' | 'roles' | 'industries' | 'features';
type FlagKey = 'starredOnly' | 'onAgendaOnly' | 'tbaOnly' | 'hideConflicting' | 'showAvoided';

const FLAGS: { key: FlagKey; label: string }[] = [
  { key: 'starredOnly', label: 'Starred only' },
  { key: 'onAgendaOnly', label: 'On my agenda' },
  { key: 'tbaOnly', label: 'TBA only' },
  { key: 'hideConflicting', label: 'Hide conflicting' },
  { key: 'showAvoided', label: 'Show avoided' },
];

const VENUE_SHORT: Record<VenueId, string> = { venetian: 'Venetian', wynn: 'Wynn', 'caesars-forum': 'Forum', 'caesars-palace': 'Caesars', mgm: 'MGM' };

const SCORED: { value: NonNullable<Filters['scored']> | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'manual', label: 'Scored by me' },
  { value: 'unscored', label: 'Not scored yet' },
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
            <ToggleGroupItem key={d.id} value={d.id} className={cn('flex-1 px-0 text-xs capitalize', SELECTED_CHIP)} title={d.label}>
              {d.id}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Venue</Label>
        <ToggleGroup
          type="multiple"
          variant="outline"
          size="sm"
          spacing={1}
          value={filters.venues ?? []}
          onValueChange={(venues: string[]) => set({ venues: venues.length ? (venues as VenueId[]) : undefined })}
          className="w-full flex-wrap"
        >
          {VENUES.map((v) => (
            <ToggleGroupItem key={v.id} value={v.id} className={cn('gap-1 px-1.5 text-xs', SELECTED_CHIP)} title={v.name}>
              <span className="size-2 rounded-full ring-1 ring-background" style={{ background: VENUE_COLORS[v.id] }} />
              {VENUE_SHORT[v.id]}
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

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">My scores</Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={filters.scored ?? 'all'}
          onValueChange={(v: string) => v && set({ scored: v === 'all' ? undefined : (v as NonNullable<Filters['scored']>) })}
          className="w-full"
        >
          {SCORED.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className={cn('flex-auto px-1 text-[11px]', SELECTED_CHIP)}>
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
