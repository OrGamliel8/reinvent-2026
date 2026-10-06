import { useState, type ReactNode } from 'react';
import { Check, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ME, type ComparePerson } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlannerQuery } from '../../PlannerProvider';
import { dayShort } from '../../format';
import { EmptyState, SectionTitle } from '../../shared/EmptyState';
import { CompareGrid } from './CompareGrid';
import { CompareLists } from './CompareLists';
import { personInfo, type PersonInfo } from './people';

const MAX_PEOPLE = 5;

export function ComparePanel({ onAddFriends }: { onAddFriends: () => void }): ReactNode {
  const [selected, setSelected] = useState<string[] | null>(null); // null = default: you plus your friends, up to MAX_PEOPLE
  const { data: entries } = usePlannerQuery((api) => api.profiles(), []);
  const options = [{ id: ME, name: 'You' }, ...(entries ?? []).filter((e) => e.hasPlan)];
  const ids = (selected ?? options.slice(0, MAX_PEOPLE).map((o) => o.id)).filter((id) => options.some((o) => o.id === id)); // drops entries deleted meanwhile
  const { data, error } = usePlannerQuery(async (api) => ({ result: await api.compare(ids), starred: new Set(await api.starred()) }), [ids.join('|')]);
  if (!entries) return null;

  if (options.length === 1) {
    return (
      <EmptyState icon={Users} title="Nobody to compare with yet">
        <p>
          Ask each friend to open this planner, go to <strong>Profile → Profiles</strong> and click <strong>Share my plan</strong>. They send you the downloaded
          file, and you add it with <strong>Add a friend's plan</strong>. A plain agenda export works too.
        </p>
        <Button size="sm" className="mt-3" onClick={onAddFriends}>
          Go to Profiles
        </Button>
      </EmptyState>
    );
  }

  const toggle = (id: string): void => setSelected(ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]);
  const people = data ? personInfo(data.result.people) : new Map<string, PersonInfo>();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Compare</span>
        {options.map((o) => {
          const on = ids.includes(o.id);
          return (
            <Button
              key={o.id}
              size="xs"
              variant={on ? 'secondary' : 'outline'}
              aria-pressed={on}
              disabled={!on && ids.length >= MAX_PEOPLE}
              onClick={() => toggle(o.id)}
              className={cn('rounded-full', on && 'bg-primary/10 text-primary hover:bg-primary/15')}
            >
              {on && <Check />} {o.name}
            </Button>
          );
        })}
        <span className="text-xs text-muted-foreground">up to {MAX_PEOPLE}</span>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {ids.length === 0 && <p className="text-sm text-muted-foreground">Pick at least one person to compare.</p>}
      {data && ids.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.result.people.map((p) => (
              <PersonCard key={p.id} person={p} info={people.get(p.id)!} />
            ))}
          </div>
          <section className="space-y-3">
            <SectionTitle>Side by side</SectionTitle>
            <CompareGrid result={data.result} people={people} />
          </section>
          <CompareLists result={data.result} people={people} starred={data.starred} />
        </>
      )}
    </div>
  );
}

function PersonCard({ person, info }: { person: ComparePerson; info: PersonInfo }): ReactNode {
  const { topInterests, topics, level, days } = person.profileSummary;
  const facts: [string, string][] = [
    ['Interests', topInterests.join(', ') || '—'],
    ['Topics', topics.join(', ') || '—'],
    ['Level', level ? `${level.min}–${level.max}` : '—'],
    ['Days', days.map(dayShort).join(', ') || '—'],
  ];
  return (
    <div className="min-w-0 space-y-2 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', info.color)} />
        <span className="truncate text-sm font-medium">{person.name}</span>
        <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums">
          {person.agendaCount} sessions
          {person.missing.length > 0 && <span className="text-warning"> · {person.missing.length} missing</span>}
        </span>
      </div>
      <dl className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-2 gap-y-0.5 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate" title={value}>
              {value}
            </dd>
          </div>
        ))}
      </dl>
      {person.missing.length > 0 && (
        <p className="text-xs text-muted-foreground" title={person.missing.map((m) => `${m.code} ${m.title}`).join('\n')}>
          Not in the current catalog: {person.missing.map((m) => m.code).join(', ')}
        </p>
      )}
    </div>
  );
}
