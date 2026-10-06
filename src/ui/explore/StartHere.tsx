import type { ReactNode } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';

const STEPS = ['Build your profile: pick topics, services, days and formats', 'Star sessions or give them your own score', 'Auto-build a clash-free agenda in My Agenda'];

// First-visit guide: without a profile every session gets the same score, so point new users at the Profile tab.
export function StartHere(): ReactNode {
  const { setTab } = useUi();
  const { data: profile } = usePlannerQuery((api) => api.getProfile(), []);
  if (profile !== null) return null; // undefined while loading, a Profile once set

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-primary/30 bg-primary/10 px-3 py-2.5 lg:px-4">
      <Sparkles className="size-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Start here: tell the planner what you care about</p>
        <ol className="mt-0.5 flex flex-wrap gap-x-4 text-xs text-muted-foreground">
          {STEPS.map((step, i) => (
            <li key={step}>
              <span className="font-mono text-primary">{i + 1}.</span> {step}
            </li>
          ))}
        </ol>
      </div>
      <Button size="sm" onClick={() => setTab('profile')} className="shrink-0">
        Build my profile <ArrowRight />
      </Button>
    </div>
  );
}
