import { useState, type ReactNode } from 'react';
import { CalendarRange, List, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePlannerQuery } from '../PlannerProvider';
import { ExploreFiltersProvider, useExploreFilters } from './ExploreFilters';
import { FilterPanel } from './FilterPanel';
import { SessionsList } from './SessionsList';
import { TimelineControls, TimelineView } from './TimelineView';
import { useTimelineSettings } from './useTimeline';
import { readPref, writePref } from './prefs';

type ExploreMode = 'list' | 'timeline';

const SIDEBAR_KEY = 'reinvent.sessions.filtersOpen';
const MODE_KEY = 'reinvent.explore.view';

function usePref<T extends string>(key: string, initial: () => T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(initial);
  const set = (next: T): void => {
    setValue(next);
    writePref(key, next);
  };
  return [value, set];
}

export function ExploreView(): ReactNode {
  return (
    <ExploreFiltersProvider>
      <ExploreLayout />
    </ExploreFiltersProvider>
  );
}

function ExploreLayout(): ReactNode {
  const { filters, setFilters, query, setQuery } = useExploreFilters();
  const { data: vocabulary } = usePlannerQuery((api) => api.vocabulary(), []);
  const [sidebar, setSidebar] = usePref(SIDEBAR_KEY, () => readPref(SIDEBAR_KEY) ?? (window.innerWidth >= 1024 ? '1' : '0'));
  const [mode, setMode] = usePref<ExploreMode>(MODE_KEY, () => (readPref(MODE_KEY) === 'timeline' ? 'timeline' : 'list'));
  const timeline = useTimelineSettings(filters.days);
  const sidebarOpen = sidebar === '1';

  return (
    <div className="flex h-full">
      {vocabulary && sidebarOpen && <FilterPanel vocabulary={vocabulary} filters={filters} onChange={setFilters} query={query} onQueryChange={setQuery} />}
      <div className="@container flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b px-2 py-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebar(sidebarOpen ? '0' : '1')}
            aria-expanded={sidebarOpen}
            title={sidebarOpen ? 'Hide filters' : 'Show filters'}
            className="text-muted-foreground"
          >
            {sidebarOpen ? <PanelLeftClose /> : <PanelLeftOpen />}
            <span className="hidden @lg:inline">{sidebarOpen ? 'Hide filters' : 'Filters'}</span>
          </Button>
          <ToggleGroup type="single" variant="outline" size="sm" value={mode} onValueChange={(v: string) => v && setMode(v as ExploreMode)} aria-label="View">
            <ToggleGroupItem value="list" className="px-2.5 text-xs" title="List">
              <List /> List
            </ToggleGroupItem>
            <ToggleGroupItem value="timeline" className="px-2.5 text-xs" title="Timeline">
              <CalendarRange /> Timeline
            </ToggleGroupItem>
          </ToggleGroup>
          {mode === 'timeline' && (
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <TimelineControls settings={timeline} />
            </div>
          )}
        </div>
        {mode === 'list' ? <SessionsList /> : <TimelineView settings={timeline} />}
      </div>
    </div>
  );
}
