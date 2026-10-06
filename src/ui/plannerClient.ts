import * as Comlink from 'comlink';
import type { WorkerApi } from '@/core/types';

export type Planner = Comlink.Remote<WorkerApi>;

let planner: Planner | null = null;
let ready: Promise<void> | null = null;

// One worker per tab; the Planner core lives entirely inside it.
export function getPlanner(): Planner {
  if (!planner) {
    const worker = new Worker(new URL('../worker/planner.worker.ts', import.meta.url), { type: 'module' });
    planner = Comlink.wrap<WorkerApi>(worker);
  }
  return planner;
}

// init() must run exactly once per worker, even under StrictMode's double effects.
export function initPlanner(): Promise<void> {
  // ?memory=1 forces the in-memory store, to check the "not being saved" banner by hand.
  ready ??= getPlanner().init({ forceMemory: new URLSearchParams(window.location.search).get('memory') === '1' });
  return ready;
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}
