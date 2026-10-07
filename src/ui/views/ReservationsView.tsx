import { Fragment, useState, type ReactNode } from 'react';
import { ClipboardList, ExternalLink, Plus, Search, Star, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DAYS, type ChecklistItem, type DayId, type ReservationStatus } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { slotWhen, venueName } from '../format';
import { StatusBadge, TypeChip } from '../shared/badges';
import { CopyButton } from '../shared/CopyButton';
import { EmptyState } from '../shared/EmptyState';
import { AlternativesList } from '../shared/AlternativesList';
import { MultiSelect, toOptions } from '../shared/MultiSelect';
import { readPref, writePref } from '../explore/prefs';

const STATUSES: ReservationStatus[] = ['none', 'reserved', 'waitlisted', 'failed', 'walk-up'];
const SHOW_STARRED_KEY = 'reinvent.reservations.showStarred';
const COLUMNS = 10;

interface Filters {
  query: string;
  statuses: ReservationStatus[];
  types: string[];
  days: DayId[];
}

const NO_FILTERS: Filters = { query: '', statuses: [], types: [], days: [] };

function matches(item: ChecklistItem, f: Filters): boolean {
  const needle = f.query.trim().toLowerCase();
  if (needle && !`${item.code} ${item.title}`.toLowerCase().includes(needle)) return false;
  if (f.statuses.length && !f.statuses.includes(item.status)) return false;
  if (f.types.length && !f.types.includes(item.type)) return false;
  return !f.days.length || (item.slot.day !== null && f.days.includes(item.slot.day));
}

// Rank is the row's position in the unfiltered checklist, so filtering keeps the reserve-first order readable.
function ranked(items: ChecklistItem[], f: Filters): { item: ChecklistItem; rank: number }[] {
  return items.map((item, index) => ({ item, rank: index + 1 })).filter(({ item }) => matches(item, f));
}

export function ReservationsView(): ReactNode {
  const [showStarred, setShowStarred] = useState(() => readPref(SHOW_STARRED_KEY) === '1');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const { data: all } = usePlannerQuery((api) => api.reservationChecklist({ includeStarred: true }), []);
  if (!all) return null;
  const items = all.filter((i) => i.onAgenda);
  const rows = ranked(items, filters);
  const starredRows = showStarred ? ranked(all.filter((i) => !i.onAgenda), filters) : [];
  const types = [...new Set(all.map((i) => i.type))].sort();
  const toggleStarred = (on: boolean): void => {
    setShowStarred(on);
    writePref(SHOW_STARRED_KEY, on ? '1' : '0');
  };
  if (all.length === 0) {
    return (
      <EmptyState icon={ClipboardList} title="Nothing to reserve yet">
        Add sessions to My Agenda (or run Auto-build). The checklist orders them by priority and scarcity so you reserve the hardest ones first.
      </EmptyState>
    );
  }
  const counts = STATUSES.map((s) => [s, items.filter((i) => i.status === s).length] as const).filter(([, n]) => n > 0);
  return (
    <div className="h-full overflow-auto">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <p className="text-sm text-muted-foreground">Reserve top to bottom: smallest rooms, single-slot and hands-on sessions come first.</p>
        <div className="flex items-center gap-2">
          <Switch id="show-starred" checked={showStarred} onCheckedChange={toggleStarred} />
          <Label htmlFor="show-starred" className="text-xs font-normal">
            Show starred, not on agenda
          </Label>
        </div>
        <div className="ml-auto flex gap-1.5">
          {counts.map(([status, n]) => (
            <span key={status} className="flex items-center gap-1 text-xs">
              <StatusBadge status={status} /> {n}
            </span>
          ))}
        </div>
      </div>
      <FilterBar filters={filters} onChange={setFilters} types={types} shown={rows.length + starredRows.length} />
      <Table className="min-w-[760px] table-fixed text-[13px]">
        <TableHeader className="sticky top-0 bg-background">
          <TableRow>
            <TableHead className="w-10">#</TableHead>
            <TableHead className="w-28">Code</TableHead>
            <TableHead>Title</TableHead>
            <TableHead className="w-44">Slot</TableHead>
            <TableHead className="hidden w-32 lg:table-cell">Venue</TableHead>
            <TableHead className="hidden w-32 xl:table-cell">Room</TableHead>
            <TableHead className="w-16 text-right">Seats</TableHead>
            <TableHead className="w-36">Status</TableHead>
            <TableHead className="w-24">Portal</TableHead>
            <TableHead className="w-10">
              <span className="sr-only">Remove</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ item, rank }) => (
            <ChecklistRow key={item.itemId} item={item} rank={rank} />
          ))}
          {showStarred && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS} className="bg-muted/50 py-1.5 text-xs font-medium text-muted-foreground">
                <Star className="mr-1 inline size-3.5 fill-amber-400 text-amber-500" />
                Starred, not on your agenda ({starredRows.length}){all.every((i) => i.onAgenda) && ' — star sessions in Explore to see them here'}
              </TableCell>
            </TableRow>
          )}
          {starredRows.map(({ item, rank }) => (
            <ChecklistRow key={item.sessionKey} item={item} rank={rank} />
          ))}
          {rows.length + starredRows.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={COLUMNS} className="py-6 text-center text-xs text-muted-foreground">
                No sessions match these filters.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

function ChecklistRow({ item, rank }: { item: ChecklistItem; rank: number }): ReactNode {
  const { mutate } = usePlanner();
  const { openSession } = useUi();
  const failed = item.status === 'failed';
  // Agenda rows leave the agenda; starred-only rows are unstarred. Neither touches the official portal.
  const remove = (): void => {
    if (item.itemId) void mutate((api) => api.removeItem(item.itemId!), `Removed ${item.code} from your agenda`);
    else void mutate((api) => api.unstar(item.sessionKey), `Unstarred ${item.code}`);
  };
  const removeLabel = item.itemId
    ? `Remove ${item.code} from your agenda (does not cancel a reservation in the official portal)`
    : `Unstar ${item.code}`;
  return (
    <Fragment>
      <TableRow className={cn(failed && 'border-b-0 bg-destructive/5')}>
        <TableCell className="text-muted-foreground tabular-nums">{rank}</TableCell>
        <TableCell>
          <span className="font-mono text-xs">{item.code}</span>
          <CopyButton text={item.code} label="Copy session code" />
        </TableCell>
        <TableCell>
          <div className="flex min-w-0 items-center gap-1.5">
            {item.starred && <Star className="size-3.5 shrink-0 fill-amber-400 text-amber-500" aria-label="Starred" />}
            <button className="min-w-0 flex-1 truncate text-left font-medium hover:underline" title={item.title} onClick={() => openSession(item.sessionKey)}>
              {item.title}
            </button>
            <TypeChip type={item.type} className="max-w-[45%] min-w-0 shrink" />
          </div>
          <div className="truncate text-xs text-muted-foreground xl:hidden">
            <span className="lg:hidden">{venueName(item.slot.venue)}</span>
            {item.slot.room && <span className="before:content-['_·_'] lg:before:content-none">{item.slot.room}</span>}
          </div>
        </TableCell>
        <TableCell className="text-xs">{slotWhen(item.slot)}</TableCell>
        <TableCell className="hidden text-xs lg:table-cell">{venueName(item.slot.venue)}</TableCell>
        <TableCell className="hidden truncate text-xs xl:table-cell">{item.slot.room ?? '—'}</TableCell>
        <TableCell className="text-right font-mono text-xs tabular-nums">{item.slot.seats ?? '—'}</TableCell>
        <TableCell>
          {item.itemId === null ? (
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              disabled={!item.slot.start}
              onClick={() => void mutate((api) => api.addSlot(item.slot.slotId))}
            >
              <Plus /> Add to agenda
            </Button>
          ) : (
            <Select value={item.status} onValueChange={(status) => void mutate((api) => api.setReservationStatus(item.itemId!, status as ReservationStatus))}>
              <SelectTrigger size="sm" className="w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </TableCell>
        <TableCell>
          <a
            href={item.portalUrl}
            target="_blank"
            rel="noreferrer"
            title={`Open ${item.code} in the official re:Invent catalog to reserve it`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium whitespace-nowrap hover:bg-accent"
          >
            Reserve <ExternalLink className="size-3" />
          </a>
        </TableCell>
        <TableCell>
          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive" aria-label={removeLabel} title={removeLabel} onClick={remove}>
            <Trash2 />
          </Button>
        </TableCell>
      </TableRow>
      {failed && (
        <TableRow className="bg-destructive/5 hover:bg-destructive/5">
          <TableCell />
          <TableCell colSpan={COLUMNS - 1} className="pt-0 whitespace-normal">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Alternatives</p>
            <AlternativesList alternatives={item.alternatives} replaceItemId={item.itemId} />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

function FilterBar({ filters, onChange, types, shown }: { filters: Filters; onChange: (f: Filters) => void; types: string[]; shown: number }): ReactNode {
  const active = filters.query.trim() !== '' || filters.statuses.length + filters.types.length + filters.days.length > 0;
  return (
    <div className="flex flex-wrap items-center gap-2 px-4 pb-3">
      <div className="relative w-56">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search code or title…"
          value={filters.query}
          onChange={(e) => onChange({ ...filters, query: e.target.value })}
          className="h-8 pl-7 text-xs"
          aria-label="Search code or title"
        />
      </div>
      <MultiSelect label="Status" options={toOptions(STATUSES)} selected={filters.statuses} onChange={(statuses) => onChange({ ...filters, statuses })} />
      <MultiSelect label="Type" options={toOptions(types)} selected={filters.types} onChange={(t) => onChange({ ...filters, types: t })} />
      <MultiSelect
        label="Day"
        options={toOptions(
          DAYS.map((d) => d.id),
          (id) => DAYS.find((d) => d.id === id)!.label,
        )}
        selected={filters.days}
        onChange={(days) => onChange({ ...filters, days })}
      />
      {active && (
        <>
          <span className="text-xs text-muted-foreground">{shown} shown</span>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => onChange(NO_FILTERS)}>
            <X /> Clear filters
          </Button>
        </>
      )}
    </div>
  );
}
