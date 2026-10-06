import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Filters } from '@/core/types';
import { useDebounced } from '../shared/useDebounced';

interface ExploreFiltersValue {
  filters: Filters; // what the sidebar edits (search text lives in `query`)
  setFilters: (filters: Filters) => void;
  query: string;
  setQuery: (query: string) => void;
  effective: Filters; // filters + debounced search: what every Explore view ranks with
  effectiveKey: string;
}

const ExploreFiltersContext = createContext<ExploreFiltersValue | null>(null);

export function ExploreFiltersProvider({ children }: { children: ReactNode }): ReactNode {
  const [filters, setFilters] = useState<Filters>({ sort: { by: 'score', dir: 'desc' } });
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 250);

  const value = useMemo(() => {
    const effective = { ...filters, q: q || undefined };
    return { filters, setFilters, query, setQuery, effective, effectiveKey: JSON.stringify(effective) };
  }, [filters, query, q]);
  return <ExploreFiltersContext.Provider value={value}>{children}</ExploreFiltersContext.Provider>;
}

export function useExploreFilters(): ExploreFiltersValue {
  const ctx = useContext(ExploreFiltersContext);
  if (!ctx) throw new Error('useExploreFilters must be used inside <ExploreFiltersProvider>');
  return ctx;
}
