import { useMemo, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, PanelLeftClose, PanelLeftOpen, SearchX } from 'lucide-react';
import { createColumnHelper, tableFeatures, useTable } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import type { Filters, RankedSession, SortBy } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';
import { levelLabel, slotWhen, venueName } from '../format';
import { ScorePill, TbaBadge } from '../shared/badges';
import { MatchChips } from '../shared/MatchChips';
import { StarButton } from '../shared/StarButton';
import { EmptyState } from '../shared/EmptyState';
import { useDebounced } from '../shared/useDebounced';
import { FilterPanel } from './FilterPanel';
import { AddSlotMenu } from './AddSlotMenu';

const PAGE_SIZE = 100;
const NO_ROWS: RankedSession[] = [];

const features = tableFeatures({});
const helper = createColumnHelper<typeof features, RankedSession>();

function firstTimedSlot(row: RankedSession): RankedSession['session']['slots'][number] | undefined {
  return row.session.slots.find((s) => s.start) ?? row.session.slots[0];
}

const columns = helper.columns([
  helper.display({ id: 'star', header: '', cell: ({ row }) => <StarButton sessionKey={row.original.session.key} starred={row.original.starred} /> }),
  helper.accessor('score', { id: 'score', header: 'Score', cell: ({ row, table }) => <ScorePill score={row.original.score} max={(table.options.meta as { maxScore: number }).maxScore} /> }),
  helper.display({ id: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.session.code}</span> }),
  helper.display({ id: 'title', header: 'Title', cell: ({ row }) => <TitleCell row={row.original} /> }),
  helper.display({ id: 'type', header: 'Type', cell: ({ row }) => <span className="text-xs">{row.original.session.type}</span> }),
  helper.display({ id: 'level', header: 'Level', cell: ({ row }) => <span className="font-mono text-xs">{levelLabel(row.original.session.level)}</span> }),
  helper.display({ id: 'time', header: 'Day / time', cell: ({ row }) => <WhenCell row={row.original} /> }),
  helper.display({ id: 'venue', header: 'Venue', cell: ({ row }) => <span className="text-xs whitespace-nowrap">{venueName(firstTimedSlot(row.original)?.venue ?? null)}</span> }),
  helper.display({ id: 'seats', header: 'Seats', cell: ({ row }) => <span className="font-mono text-xs tabular-nums">{firstTimedSlot(row.original)?.seats ?? '—'}</span> }),
  helper.display({ id: 'add', header: '', cell: ({ row }) => <AddSlotMenu session={row.original.session} /> }),
]);

const SORTABLE: Partial<Record<string, SortBy>> = { score: 'score', time: 'time', level: 'level', venue: 'venue', seats: 'seats' };

// Width and responsive visibility per column, keyed to the table container's width (not the viewport),
// so collapsing the filter sidebar brings columns back. Title takes the remaining space.
const LAYOUT: Record<string, { col: string; cell: string }> = {
  star: { col: 'w-9', cell: '' },
  score: { col: 'w-24', cell: '' },
  code: { col: 'hidden w-24 @6xl:table-column', cell: 'hidden @6xl:table-cell' },
  title: { col: '', cell: '' },
  type: { col: 'hidden w-32 @4xl:table-column', cell: 'hidden @4xl:table-cell' },
  level: { col: 'hidden w-14 @6xl:table-column', cell: 'hidden @6xl:table-cell' },
  time: { col: 'w-44', cell: '' },
  venue: { col: 'hidden w-32 @3xl:table-column', cell: 'hidden @3xl:table-cell' },
  seats: { col: 'hidden w-16 @6xl:table-column', cell: 'hidden @6xl:table-cell' },
  add: { col: 'w-10', cell: '' },
};

const SIDEBAR_KEY = 'reinvent.sessions.filtersOpen';

function initialSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY);
    if (stored !== null) return stored === '1';
  } catch {
    // storage unavailable: fall back to width
  }
  return window.innerWidth >= 1024;
}

function TitleCell({ row }: { row: RankedSession }): ReactNode {
  const { openSession } = useUi();
  return (
    <button className="block w-full min-w-0 text-left" onClick={() => openSession(row.session.key)}>
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground @6xl:hidden">{row.session.code}</span>
        <span className="min-w-0 truncate text-[13px] font-medium hover:underline" title={row.session.title}>
          {row.session.title}
        </span>
        {row.session.tba && <TbaBadge />}
        {row.onAgenda && <span className="size-1.5 shrink-0 rounded-full bg-success" title="On your agenda" />}
      </div>
      <MatchChips explanation={row.explanation} className="mt-0.5 flex-nowrap overflow-hidden" />
    </button>
  );
}

function WhenCell({ row }: { row: RankedSession }): ReactNode {
  const slot = firstTimedSlot(row);
  const more = row.session.slots.filter((s) => s.start).length - 1;
  return (
    <span className="text-xs whitespace-nowrap">
      {slot ? slotWhen(slot) : 'TBA'}
      {more > 0 && <span className="ml-1 text-muted-foreground">+{more}</span>}
    </span>
  );
}

export function SessionsView(): ReactNode {
  const [filters, setFilters] = useState<Filters>({ sort: { by: 'score', dir: 'desc' } });
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);
  const [paging, setPaging] = useState({ key: '', page: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(initialSidebarOpen);

  const toggleSidebar = (): void => {
    const next = !sidebarOpen;
    setSidebarOpen(next);
    try {
      localStorage.setItem(SIDEBAR_KEY, next ? '1' : '0');
    } catch {
      // per-viewer convenience only
    }
  };

  const effective = useMemo(() => ({ ...filters, q: q || undefined }), [filters, q]);
  const filterKey = JSON.stringify(effective);
  const { data: vocabulary } = usePlannerQuery((api) => api.vocabulary(), []);
  const { data: rows, loading } = usePlannerQuery((api) => api.rank(effective), [filterKey]);

  // Any filter change sends you back to page 1.
  const page = paging.key === filterKey ? paging.page : 0;
  const setPage = (next: number): void => setPaging({ key: filterKey, page: next });

  const all = rows ?? NO_ROWS;
  const maxScore = useMemo(() => all.reduce((m, r) => Math.max(m, r.score), 0), [all]);
  const pageRows = useMemo(() => all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [all, page]);
  const pageCount = Math.max(1, Math.ceil(all.length / PAGE_SIZE));

  const table = useTable({ features, columns, data: pageRows, meta: { maxScore }, getRowId: (row) => row.session.key });

  const toggleSort = (by: SortBy): void => {
    const current = filters.sort;
    const dir = current?.by === by ? (current.dir === 'asc' ? 'desc' : 'asc') : by === 'score' || by === 'seats' ? 'desc' : 'asc';
    setFilters({ ...filters, sort: { by, dir } });
  };

  return (
    <div className="flex h-full">
      {vocabulary && sidebarOpen && <FilterPanel vocabulary={vocabulary} filters={filters} onChange={setFilters} query={query} onQueryChange={setQuery} />}
      <div className="@container flex min-w-0 flex-1 flex-col">
        <div className={cn('min-h-0 flex-1 overflow-auto transition-opacity', loading && 'opacity-60')}>
          {/* min width = always-visible columns + ~260px for Title; narrower containers scroll horizontally */}
          <table className="w-full min-w-[610px] table-fixed border-collapse text-sm">
            <colgroup>
              {columns.map((column) => (
                <col key={column.id} className={LAYOUT[column.id!]?.col} />
              ))}
            </colgroup>
            <thead className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="border-b">
                  {group.headers.map((header) => {
                    const sortBy = SORTABLE[header.column.id];
                    const active = sortBy && filters.sort?.by === sortBy;
                    return (
                      <th key={header.id} className={cn('h-8 truncate px-2 text-left text-xs font-medium whitespace-nowrap text-muted-foreground', LAYOUT[header.column.id]?.cell)}>
                        {sortBy ? (
                          <button className={cn('inline-flex items-center gap-1 hover:text-foreground', active && 'text-foreground')} onClick={() => toggleSort(sortBy)}>
                            <table.FlexRender header={header} />
                            {active && (filters.sort?.dir === 'asc' ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                          </button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => (
                <tr key={row.id} className={cn('border-b border-border/60 hover:bg-muted/50', row.original.onAgenda && 'bg-success/5')}>
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className={cn('px-2 py-1.5 align-middle', LAYOUT[cell.column.id]?.cell)}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rows && all.length === 0 && (
            <EmptyState icon={SearchX} title="No sessions match">
              Loosen the filters or clear the search.
            </EmptyState>
          )}
        </div>
        <footer className="flex h-10 shrink-0 items-center justify-between gap-2 border-t px-2 text-xs text-muted-foreground">
          <Button
            size="xs"
            variant="ghost"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            className="text-muted-foreground"
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            <span className="hidden @lg:inline">{sidebarOpen ? 'Hide filters' : 'Filters'}</span>
          </Button>
          <span className="mr-auto truncate">
            {!rows && 'Ranking…'}
            {rows && `${all.length.toLocaleString()} sessions`}{all.length > 0 && ` · showing ${page * PAGE_SIZE + 1}–${Math.min(all.length, (page + 1) * PAGE_SIZE)}`}
          </span>
          <div className="flex items-center gap-1">
            <Button size="icon-xs" variant="ghost" disabled={page === 0} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <span>
              Page {page + 1} / {pageCount}
            </span>
            <Button size="icon-xs" variant="ghost" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
