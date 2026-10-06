import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Comlink from 'comlink';
import { toast } from 'sonner';
import type { StorageStatus } from '@/core/types';
import { InactiveTabOverlay } from './InactiveTabOverlay';
import { errorMessage, getPlanner, initPlanner, type Planner } from './plannerClient';

interface PlannerContextValue {
  api: Planner;
  version: number;
  storage: StorageStatus;
  // Run a mutation, then bump the version so every view refetches. Errors become toasts.
  mutate: <T>(fn: (api: Planner) => Promise<T>, successMessage?: string) => Promise<T | undefined>;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

type InitState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export function PlannerProvider({ children }: { children: ReactNode }): ReactNode {
  const api = getPlanner();
  const [init, setInit] = useState<InitState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [storage, setStorage] = useState<StorageStatus>({ mode: 'memory', reason: null });

  useEffect(() => {
    let cancelled = false;
    initPlanner()
      .then(() => {
        // The worker pushes ownership changes (another tab took over, or "Use here" took it back); every view refetches.
        const onChange = (status: StorageStatus): void => {
          if (cancelled) return;
          setStorage(status);
          setVersion((v) => v + 1);
        };
        return api.watchStorage(Comlink.proxy(onChange));
      })
      .then(
        (status) => {
          if (cancelled) return;
          setStorage(status);
          setInit({ status: 'ready' });
        },
        (error: unknown) => !cancelled && setInit({ status: 'error', message: errorMessage(error) }),
      );
    return () => {
      cancelled = true;
    };
  }, [api]);

  const mutate = useCallback(
    async <T,>(fn: (api: Planner) => Promise<T>, successMessage?: string): Promise<T | undefined> => {
      try {
        const result = await fn(api);
        if (successMessage) toast.success(successMessage);
        return result;
      } catch (error) {
        toast.error(errorMessage(error));
        return undefined;
      } finally {
        setVersion((v) => v + 1);
      }
    },
    [api],
  );

  const useHere = useCallback(async (): Promise<void> => {
    try {
      await api.useHere();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }, [api]);

  const value = useMemo(() => ({ api, version, storage, mutate }), [api, version, storage, mutate]);

  if (init.status === 'loading') return <LoadingScreen />;
  if (init.status === 'error') return <ErrorScreen message={init.message} />;
  return (
    <PlannerContext.Provider value={value}>
      {children}
      {storage.mode === 'inactive' && <InactiveTabOverlay onUseHere={useHere} />}
    </PlannerContext.Provider>
  );
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) throw new Error('usePlanner must be used inside <PlannerProvider>');
  return ctx;
}

interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
}

// Fetch from the planner; refetches whenever a mutation bumps the version or `deps` change.
// Keeps the previous data while a refetch is in flight, so views don't flicker.
export function usePlannerQuery<T>(fn: (api: Planner) => Promise<T>, deps: readonly unknown[]): QueryState<T> {
  const { api, version } = usePlanner();
  const [state, setState] = useState<QueryState<T>>({ data: undefined, error: null, loading: true });
  const requestId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    const id = ++requestId.current;
    setState((s) => ({ ...s, loading: true }));
    fnRef.current(api).then(
      (data) => id === requestId.current && setState({ data, error: null, loading: false }),
      (error: unknown) => id === requestId.current && setState((s) => ({ ...s, error: errorMessage(error), loading: false })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, version, ...deps]);

  return state;
}

function LoadingScreen(): ReactNode {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground">
      <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <p className="text-sm">Loading the catalog…</p>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }): ReactNode {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="max-w-lg rounded-lg border border-destructive/40 bg-destructive/5 p-6">
        <h1 className="text-base font-semibold text-destructive">The planner failed to start</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The catalog or your saved state could not be loaded. Check that <code className="font-mono">public/catalog.sqlite3</code> exists (run{' '}
          <code className="font-mono">npm run refresh-data</code>) and reload the page.
        </p>
        <pre className="mt-4 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap">{message}</pre>
        <button className="mt-4 text-sm font-medium text-primary hover:underline" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  );
}
