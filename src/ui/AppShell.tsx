import type { ReactNode } from 'react';
import { Bell, CalendarDays, Compass, Info, ClipboardCheck, Map as MapIcon, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlannerQuery } from './PlannerProvider';
import { useUi, type TabId } from './UiState';
import { fmtDateTime } from './format';
import { ThemeToggle } from './ThemeToggle';
import { SessionDrawer } from './SessionDrawer';
import { AlertsDrawer } from './AlertsDrawer';
import { AlternativesDialog } from './shared/AlternativesDialog';
import { ExploreView } from './explore/ExploreView';
import { AgendaView } from './agenda/AgendaView';
import { MapView } from './views/MapView';
import { ReservationsView } from './views/ReservationsView';
import { ProfileView } from './profile/ProfileView';
import { SettingsView } from './views/SettingsView';

const TABS: { id: TabId; label: string; icon: typeof Compass; view: () => ReactNode }[] = [
  { id: 'explore', label: 'Explore', icon: Compass, view: ExploreView },
  { id: 'agenda', label: 'My Agenda', icon: CalendarDays, view: AgendaView },
  { id: 'map', label: 'Map', icon: MapIcon, view: MapView },
  { id: 'reservations', label: 'Reservations', icon: ClipboardCheck, view: ReservationsView },
  { id: 'profile', label: 'Profile', icon: UserRound, view: ProfileView },
  { id: 'settings', label: 'Settings', icon: SettingsIcon, view: SettingsView },
];

export function AppShell(): ReactNode {
  const { tab, setTab } = useUi();
  return (
    <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="flex h-full flex-col gap-0">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-sidebar px-3 lg:gap-4 lg:px-4">
        <div className="flex shrink-0 items-center gap-2" title="re:Invent 2026 Planner">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">rI</div>
          <span className="hidden text-sm font-semibold whitespace-nowrap md:inline lg:hidden xl:inline">re:Invent 2026 Planner</span>
        </div>
        <TabsList variant="line" className="h-12! min-w-0 gap-1 overflow-x-auto overflow-y-hidden">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} title={label} aria-label={label} className="px-2 text-[13px]">
              <Icon />
              <span className="hidden lg:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <CatalogFreshness />
          <AlertsBell />
          <ThemeToggle />
        </div>
      </header>
      {TABS.map(({ id, view: View }) => (
        <TabsContent key={id} value={id} className="min-h-0 flex-1 overflow-hidden">
          <View />
        </TabsContent>
      ))}
      <SessionDrawer />
      <AlertsDrawer />
      <AlternativesDialog />
    </Tabs>
  );
}

function CatalogFreshness(): ReactNode {
  const { data: meta } = usePlannerQuery((api) => api.meta(), []);
  if (!meta) return null;
  const sessions = `${meta.sessionCount.toLocaleString()} sessions`;
  const full = `Catalog refreshed ${fmtDateTime(meta.fetchedAt)} · ${sessions}`;
  return (
    <>
      <span className="hidden text-xs whitespace-nowrap text-muted-foreground min-[1360px]:inline" title={meta.sourceUrl}>
        {full}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs whitespace-nowrap text-muted-foreground hover:text-foreground min-[1360px]:hidden" aria-label={full}>
            <Info className="size-3.5" />
            <span className="hidden md:inline lg:hidden xl:inline">{sessions}</span>
          </button>
        </TooltipTrigger>
        <TooltipContent>{full}</TooltipContent>
      </Tooltip>
    </>
  );
}

function AlertsBell(): ReactNode {
  const { setAlertsOpen } = useUi();
  const { data: alerts } = usePlannerQuery((api) => api.detectChanges(), []);
  const count = alerts?.length ?? 0;
  return (
    <Button variant="ghost" size="icon-sm" className="relative" onClick={() => setAlertsOpen(true)} aria-label={`${count} change alerts`}>
      <Bell />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-white">
          {count}
        </span>
      )}
    </Button>
  );
}
