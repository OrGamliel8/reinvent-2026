import { useMemo, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { AutoBuildResult, Session } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { WeekCalendar } from './WeekCalendar';
import { ConflictsPanel } from './ConflictsPanel';
import { AutoBuildPanel } from './AutoBuildPanel';
import { BlocksEditor } from './BlocksEditor';
import { ExportControls } from './ExportControls';
import { buildEntries } from './calendarModel';

const NO_STARS = new Set<string>();

export function AgendaView(): ReactNode {
  const { mutate } = usePlanner();
  const [result, setResult] = useState<AutoBuildResult | null>(null);
  const [panel, setPanel] = useState('conflicts');
  const [building, setBuilding] = useState(false);
  // The side panel eats a third of a split-screen laptop, so it starts closed on narrow windows.
  const [panelOpen, setPanelOpen] = useState(() => window.innerWidth >= 1200);

  const { data } = usePlannerQuery(async (api) => {
    const [agenda, blocks, travel, conflicts, starred] = await Promise.all([api.agenda(), api.personalBlocks(), api.travelTable(), api.conflicts(), api.starred()]);
    const keys = [...new Set(agenda.map((i) => i.sessionKey))];
    const sessions = await Promise.all(keys.map((k) => api.session(k)));
    return { agenda, blocks, travel, conflicts, starred: new Set(starred), sessions: new Map(sessions.filter((s): s is Session => s !== null).map((s) => [s.key, s])) };
  }, []);

  const entries = useMemo(() => (data ? buildEntries(data.agenda, data.sessions, data.blocks, data.travel) : []), [data]);
  const conflictIds = useMemo(() => new Set(data?.conflicts.map((c) => c.itemId)), [data]);
  const titles = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of data?.agenda ?? []) map.set(item.id, data?.sessions.get(item.sessionKey)?.title ?? item.sessionKey);
    return map;
  }, [data]);

  const autoBuild = async (): Promise<void> => {
    setBuilding(true);
    const built = await mutate((api) => api.autoBuild());
    setBuilding(false);
    if (built) {
      setResult(built);
      setPanel('autobuild');
      setPanelOpen(true);
    }
  };

  const unscheduled = data ? data.agenda.length - entries.filter((e) => e.type === 'session').length : 0;

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b px-4 py-2">
          <Button size="sm" onClick={() => void autoBuild()} disabled={building}>
            <Sparkles /> {building ? 'Building…' : 'Auto-build'}
          </Button>
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {data?.agenda.length ?? 0} sessions
            {unscheduled > 0 && ` · ${unscheduled} without a time`}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <ExportControls agendaSize={data?.agenda.length ?? 0} />
            <Button
              size="sm"
              variant={panelOpen ? 'secondary' : 'ghost'}
              onClick={() => setPanelOpen(!panelOpen)}
              aria-expanded={panelOpen}
              title={panelOpen ? 'Hide side panel' : 'Show conflicts, auto-build and blocks'}
            >
              {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
              {data && data.conflicts.length > 0 && <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white">{data.conflicts.length}</span>}
              <span className="sr-only">{panelOpen ? 'Hide side panel' : 'Show side panel'}</span>
            </Button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <WeekCalendar entries={entries} conflictItemIds={conflictIds} starredKeys={data?.starred ?? NO_STARS} />
        </div>
      </div>
      <aside className={cn('w-80 shrink-0 flex-col border-l bg-sidebar xl:w-96', panelOpen ? 'flex' : 'hidden')}>
        <Tabs value={panel} onValueChange={setPanel} className="flex min-h-0 flex-1 flex-col gap-0">
          <TabsList variant="line" className="w-full shrink-0 border-b px-2">
            <TabsTrigger value="conflicts" className="text-xs">
              Conflicts {data && data.conflicts.length > 0 && <span className="rounded-full bg-destructive px-1.5 text-[10px] text-white">{data.conflicts.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="autobuild" className="text-xs">
              Auto-build
            </TabsTrigger>
            <TabsTrigger value="blocks" className="text-xs">
              Blocks
            </TabsTrigger>
          </TabsList>
          <TabsContent value="conflicts" className="min-h-0 flex-1 overflow-y-auto p-3">
            <ConflictsPanel conflicts={data?.conflicts ?? []} titles={titles} />
          </TabsContent>
          <TabsContent value="autobuild" className="min-h-0 flex-1 overflow-y-auto p-3">
            <AutoBuildPanel result={result} />
          </TabsContent>
          <TabsContent value="blocks" className="min-h-0 flex-1 overflow-y-auto p-3">
            <BlocksEditor blocks={data?.blocks ?? []} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
