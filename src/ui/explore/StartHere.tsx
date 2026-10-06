import type { ReactNode } from 'react';
import { ArrowRight, CalendarCheck, Sparkles, Star, UserRound, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi } from '../UiState';

const STEPS: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: UserRound, title: 'Build your profile', text: 'Pick topics, services, days and formats. Optionally let Claude expand it.' },
  { icon: Star, title: 'Star and score', text: 'Browse the ranked sessions, star the ones you want, set your own scores.' },
  { icon: CalendarCheck, title: 'Auto-build your agenda', text: 'Get a clash-free week in My Agenda that respects travel time and lunch.' },
];

// First-visit guide: without a profile every session gets the same score, so point new users at the Profile tab.
export function StartHere(): ReactNode {
  const { setTab } = useUi();
  const { data: profile } = usePlannerQuery((api) => api.getProfile(), []);
  if (profile !== null) return null; // undefined while loading, a Profile once set

  return (
    <section className="shrink-0 border-b border-primary/30 bg-primary/10 px-4 py-5 @3xl:px-8 @3xl:py-7">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <Sparkles className="mt-1 size-6 shrink-0 text-primary" />
            <div className="min-w-0">
              <h2 className="text-xl font-semibold tracking-tight @3xl:text-2xl">Start here: tell the planner what you care about</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Right now every session has the same score. A profile takes about two minutes and ranks all 1,600+ sessions for you.
              </p>
            </div>
          </div>
          <Button size="lg" onClick={() => setTab('profile')} className="shrink-0">
            Build my profile <ArrowRight />
          </Button>
        </div>
        <ol className="grid gap-3 @2xl:grid-cols-3">
          {STEPS.map(({ icon: Icon, title, text }, i) => (
            <li key={title} className="flex gap-3 rounded-lg border bg-card p-4">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Icon className="size-4 text-primary" />
                  {title}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
