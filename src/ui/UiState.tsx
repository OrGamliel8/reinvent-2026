import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type TabId = 'sessions' | 'timeline' | 'agenda' | 'map' | 'reservations' | 'profile' | 'settings';

export interface AlternativesRequest {
  ref: { slotId: string } | { sessionKey: string };
  replaceItemId: string | null; // agenda item swapped out when an alternative is chosen
  title: string;
}

interface UiContextValue {
  tab: TabId;
  setTab: (tab: TabId) => void;
  sessionKey: string | null;
  openSession: (key: string | null) => void;
  alertsOpen: boolean;
  setAlertsOpen: (open: boolean) => void;
  alternatives: AlternativesRequest | null;
  openAlternatives: (request: AlternativesRequest | null) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }): ReactNode {
  const [tab, setTab] = useState<TabId>('sessions');
  const [sessionKey, openSession] = useState<string | null>(null);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [alternatives, openAlternatives] = useState<AlternativesRequest | null>(null);

  const value = useMemo(
    () => ({ tab, setTab, sessionKey, openSession, alertsOpen, setAlertsOpen, alternatives, openAlternatives }),
    [tab, sessionKey, alertsOpen, alternatives],
  );
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiContextValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used inside <UiProvider>');
  return ctx;
}
