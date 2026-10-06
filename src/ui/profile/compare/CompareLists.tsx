import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ME, type CompareResult } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner } from '../../PlannerProvider';
import { useUi } from '../../UiState';
import { fmtRange, slotWhen, venueName } from '../../format';
import { SectionTitle } from '../../shared/EmptyState';
import { StarButton } from '../../shared/StarButton';
import type { PersonInfo } from './people';

interface ListsProps {
  result: CompareResult;
  people: Map<string, PersonInfo>;
  starred: Set<string>;
}

export function CompareLists({ result, people, starred }: ListsProps): ReactNode {
  const names = (ids: string[]): string => ids.map((id) => people.get(id)?.name ?? id).join(', ');
  const others = result.people.filter((p) => p.id !== ME);

  return (
    <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
      <List title="Together" count={result.together.length + result.sameSessionDifferentSlot.length} empty="No session where two people share the same slot.">
        {result.together.map((t) => (
          <SessionLine key={t.slotId} sessionKey={t.sessionKey} title={t.title} meta={`${t.slotCode} · ${fmtRange(t.start, t.end)} · ${venueName(t.venue)} · ${names(t.personIds)}`}>
            {!t.personIds.includes(ME) && <SessionActions sessionKey={t.sessionKey} slotId={t.slotId} starred={starred} />}
          </SessionLine>
        ))}
        {result.sameSessionDifferentSlot.map((s) => (
          <SessionLine
            key={s.sessionKey}
            sessionKey={s.sessionKey}
            title={s.title}
            meta={`Same session, different times: ${s.placements.map((p) => `${people.get(p.personId)?.name} ${slotWhen(p)}`).join(' · ')}`}
          >
            {s.placements.some((p) => p.personId === ME) &&
              s.placements
                .filter((p) => p.personId !== ME)
                .map((p) => <AddButton key={p.personId} slotId={p.slotId} label={`Switch to ${people.get(p.personId)?.name}'s slot`} />)}
          </SessionLine>
        ))}
      </List>

      <List title="Split decisions" count={result.split.length} empty="Nobody is at different sessions at the same time.">
        {result.split.map((s) => (
          <li key={s.start + s.entries.map((e) => e.slotId).join()} className="space-y-1 py-2">
            <div className="text-xs text-muted-foreground tabular-nums">{fmtRange(s.start, s.end)}</div>
            <ul className="space-y-1">
              {s.entries.map((e) => (
                <SessionLine key={e.personId} sessionKey={e.sessionKey} title={e.title} meta={`${people.get(e.personId)?.name} · ${venueName(e.venue)}`} nested>
                  {e.personId !== ME && <AddButton slotId={e.slotId} label="Add to my agenda" />}
                </SessionLine>
              ))}
            </ul>
          </li>
        ))}
      </List>

      {others.map((person) => {
        const list = result.onlyOne[person.id] ?? [];
        return (
          <List key={person.id} title={`Only on ${person.name}'s agenda`} count={list.length} empty={`Everything on ${person.name}'s agenda is shared with someone.`}>
            {list.map((s) => (
              <SessionLine key={s.sessionKey} sessionKey={s.sessionKey} title={s.title} meta={`${s.slotCode} · ${slotWhen(s)} · ${venueName(s.venue)}`}>
                <SessionActions sessionKey={s.sessionKey} slotId={s.slotId} starred={starred} />
              </SessionLine>
            ))}
          </List>
        );
      })}

      {others.length > 0 && (
        <List title="Others picked, you don't have" count={result.starredByOthers.length} empty="You already have everything your friends picked or starred.">
          {result.starredByOthers.map((s) => (
            <SessionLine key={s.sessionKey} sessionKey={s.sessionKey} title={s.title} meta={`${s.code} · ${names(s.personIds)}`}>
              <SessionActions sessionKey={s.sessionKey} slotId={s.slotId} starred={starred} />
            </SessionLine>
          ))}
        </List>
      )}
    </div>
  );
}

function List({ title, count, empty, children }: { title: string; count: number; empty: string; children: ReactNode }): ReactNode {
  return (
    <section className="min-w-0 space-y-2">
      <SectionTitle>
        {title} <span className="font-normal tabular-nums">({count})</span>
      </SectionTitle>
      {count > 0 ? <ul className="divide-y">{children}</ul> : <p className="text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function SessionLine({ sessionKey, title, meta, nested, children }: { sessionKey: string; title: string; meta: string; nested?: boolean; children?: ReactNode }): ReactNode {
  const { openSession } = useUi();
  return (
    <li className={cn('flex items-start gap-2', nested ? 'py-0.5' : 'py-2')}>
      <button type="button" onClick={() => openSession(sessionKey)} className="min-w-0 flex-1 text-left">
        <span className="line-clamp-2 text-sm hover:underline">{title}</span>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </button>
      <div className="flex shrink-0 items-center gap-1">{children}</div>
    </li>
  );
}

function SessionActions({ sessionKey, slotId, starred }: { sessionKey: string; slotId: string | null; starred: Set<string> }): ReactNode {
  return (
    <>
      {slotId && <AddButton slotId={slotId} label="Add to my agenda" />}
      <StarButton sessionKey={sessionKey} starred={starred.has(sessionKey)} />
    </>
  );
}

function AddButton({ slotId, label }: { slotId: string; label: string }): ReactNode {
  const { mutate } = usePlanner();
  return (
    <Button size="xs" variant="outline" onClick={() => void mutate((api) => api.addSlot(slotId), 'Added to your agenda')}>
      <Plus /> {label}
    </Button>
  );
}
