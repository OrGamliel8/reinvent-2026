import type { ReactNode } from 'react';
import { Bell, CalendarDays, CalendarRange, ClipboardCheck, List, Map as MapIcon, Settings as SettingsIcon, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePlannerQuery } from './PlannerProvider';
import { useUi, type TabId } from './UiState';
import { fmtDateTime } from './format';
import { ThemeToggle } from './ThemeToggle';
import { SessionDrawer } from './SessionDrawer';
import { AlertsDrawer } from './AlertsDrawer';
import { AlternativesDialog } from './shared/AlternativesDialog';
import { SessionsView } from './views/SessionsView';
import { TimelineView } from './views/TimelineView';
import { AgendaView } from './agenda/AgendaView';
import { MapView } from './views/MapView';
import { ReservationsView } from './views/ReservationsView';
import { ProfileView } from './profile/ProfileView';
import { SettingsView } from './views/SettingsView';

const TABS: { id: TabId; label: string; icon: typeof List; view: () => ReactNode }[] = [
  { id: 'sessions', label: 'Sessions', icon: List, view: SessionsView },
  { id: 'timeline', label: 'Timeline', icon: CalendarRange, view: TimelineView },
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
      <header className="flex h-12 shrink-0 items-center gap-4 border-b bg-sidebar px-4">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">rI</div>
          <span className="text-sm font-semibold whitespace-nowrap">re:Invent 2026 Planner</span>
        </div>
        <TabsList variant="line" className="h-12! gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id} className="px-2 text-[13px]">
              <Icon />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="ml-auto flex items-center gap-2">
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
  return (
    <span className="hidden text-xs whitespace-nowrap text-muted-foreground lg:inline" title={meta.sourceUrl}>
      Catalog refreshed {fmtDateTime(meta.fetchedAt)} · {meta.sessionCount.toLocaleString()} sessions
    </span>
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
