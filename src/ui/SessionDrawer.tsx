import type { ReactNode } from 'react';
import { Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import type { AgendaItem, MatchExplanation, Session, Slot, SlotFit } from '@/core/types';
import { usePlanner, usePlannerQuery } from './PlannerProvider';
import { useUi } from './UiState';
import { levelLabel, slotWhen, venueName } from './format';
import { FitBadge, TbaBadge } from './shared/badges';
import { StarButton } from './shared/StarButton';
import { SectionTitle } from './shared/EmptyState';

export function SessionDrawer(): ReactNode {
  const { sessionKey, openSession } = useUi();
  return (
    <Sheet open={sessionKey !== null} onOpenChange={(open) => !open && openSession(null)}>
      <SheetContent className="w-full gap-0 p-0 data-[side=right]:sm:max-w-xl">{sessionKey && <SessionDetail sessionKey={sessionKey} />}</SheetContent>
    </Sheet>
  );
}

interface DetailData {
  session: Session;
  score: number | null;
  explanation: MatchExplanation | null;
  starred: boolean;
  items: AgendaItem[];
  fits: Record<string, SlotFit>;
}

function SessionDetail({ sessionKey }: { sessionKey: string }): ReactNode {
  const { data, error } = usePlannerQuery(async (api): Promise<DetailData | null> => {
    const [ranked, session, agenda, starred] = await Promise.all([api.explain(sessionKey), api.session(sessionKey), api.agenda(), api.starred()]);
    const full = ranked?.session ?? session;
    if (!full) return null;
    const fits = await Promise.all(full.slots.map(async (slot) => [slot.slotId, await api.slotFit(slot.slotId)] as const));
    return {
      session: full,
      score: ranked?.score ?? null,
      explanation: ranked?.explanation ?? null,
      starred: starred.includes(sessionKey),
      items: agenda.filter((item) => item.sessionKey === sessionKey),
      fits: Object.fromEntries(fits),
    };
  }, [sessionKey]);

  if (error) return <p className="p-6 text-sm text-destructive">{error}</p>;
  if (data === undefined) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (data === null) return <p className="p-6 text-sm text-muted-foreground">This session is no longer in the catalog.</p>;

  const { session } = data;
  return (
    <>
      <SheetHeader className="border-b p-4 pr-12">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-mono">{session.code}</span>
          <span>·</span>
          <span>{session.type}</span>
          <span>·</span>
          <span>Level {levelLabel(session.level)}</span>
          {session.tba && <TbaBadge />}
        </div>
        <div className="flex items-start gap-2">
          <SheetTitle className="flex-1 text-base leading-snug">{session.title}</SheetTitle>
          <StarButton sessionKey={session.key} starred={data.starred} />
        </div>
        <SheetDescription className="sr-only">Session details</SheetDescription>
      </SheetHeader>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <section className="space-y-2">
          <SectionTitle>Slots</SectionTitle>
          <SlotList slots={session.slots} items={data.items} fits={data.fits} />
        </section>
        {data.explanation && (
          <section className="space-y-2">
            <SectionTitle>Why this matches · score {data.score?.toFixed(2)}</SectionTitle>
            <ExplanationBreakdown explanation={data.explanation} />
          </section>
        )}
        <section className="space-y-2">
          <SectionTitle>Abstract</SectionTitle>
          <p className="text-sm leading-relaxed whitespace-pre-line">{session.abstract}</p>
        </section>
        {session.speakers.length > 0 && (
          <section className="space-y-2">
            <SectionTitle>Speakers</SectionTitle>
            <ul className="space-y-0.5 text-sm">
              {session.speakers.map((s) => (
                <li key={s.name}>
                  {s.name}
                  {s.company && <span className="text-muted-foreground"> · {s.company}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="space-y-2">
          <SectionTitle>Tags</SectionTitle>
          <TagGroups session={session} />
        </section>
      </div>
    </>
  );
}

function SlotList({ slots, items, fits }: { slots: Slot[]; items: AgendaItem[]; fits: Record<string, SlotFit> }): ReactNode {
  const { mutate } = usePlanner();
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">No slots yet — star it to be alerted when it gets a time.</p>;
  return (
    <ul className="divide-y rounded-md border">
      {slots.map((slot) => {
        const item = items.find((i) => i.slotId === slot.slotId);
        return (
          <li key={slot.slotId} className="flex items-center gap-3 px-3 py-2 text-sm">
            <div className="min-w-0 flex-1">
              <div className="font-medium">{slotWhen(slot)}</div>
              <div className="text-xs text-muted-foreground">
                <span className="font-mono">{slot.code}</span> · {venueName(slot.venue)}
                {slot.room && ` · ${slot.room}`}
                {slot.seats != null && ` · ${slot.seats} seats`}
              </div>
            </div>
            {item ? (
              <>
                <span className="flex items-center gap-1 text-xs text-success">
                  <Check className="size-3.5" /> On agenda
                </span>
                <Button size="icon-xs" variant="ghost" aria-label="Remove from agenda" onClick={() => void mutate((api) => api.removeItem(item.id), 'Removed from agenda')}>
                  <Trash2 />
                </Button>
              </>
            ) : (
              <>
                {fits[slot.slotId] && <FitBadge fit={fits[slot.slotId]} />}
                <Button size="xs" variant="outline" disabled={!slot.start} onClick={() => void mutate((api) => api.addSlot(slot.slotId), `Added ${slot.code}`)}>
                  <Plus /> Add this slot
                </Button>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ExplanationBreakdown({ explanation }: { explanation: MatchExplanation }): ReactNode {
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
      {explanation.avoided.length > 0 && (
        <>
          <dt className="text-destructive">Avoided</dt>
          <dd className="text-destructive">{explanation.avoided.join(', ')}</dd>
        </>
      )}
      <dt className="text-muted-foreground">Interests</dt>
      <dd className="space-y-1">
        {explanation.interests.length === 0 && <span className="text-muted-foreground">No interest matched</span>}
        {explanation.interests.map((interest) => (
          <div key={interest.label}>
            <span className="font-medium">{interest.label}</span> <span className="font-mono text-xs text-muted-foreground">+{interest.contribution.toFixed(2)}</span>
            {interest.keywords.length > 0 && <div className="text-xs text-muted-foreground">{interest.keywords.join(', ')}</div>}
          </div>
        ))}
      </dd>
      <dt className="text-muted-foreground">Tags</dt>
      <dd className="flex flex-wrap gap-1">
        {explanation.tags.length === 0 && <span className="text-muted-foreground">No tag matched</span>}
        {explanation.tags.map((tag) => (
          <span key={tag.kind + tag.name} className="rounded bg-secondary px-1.5 py-px text-xs">
            {tag.name} <span className="text-muted-foreground">×{tag.weight}</span>
          </span>
        ))}
      </dd>
      <dt className="text-muted-foreground">Level</dt>
      <dd>
        {explanation.level.fit === 'in' ? 'In your range' : explanation.level.fit === 'unknown' ? 'Unknown' : `${explanation.level.fit} your range`}{' '}
        <Contribution value={explanation.level.contribution} />
      </dd>
      <dt className="text-muted-foreground">Format</dt>
      <dd>
        {explanation.format.type} · {explanation.format.recorded ? 'recorded' : 'not recorded'} <Contribution value={explanation.format.contribution} />
      </dd>
    </dl>
  );
}

function Contribution({ value }: { value: number }): ReactNode {
  return (
    <span className="font-mono text-xs text-muted-foreground">
      {value >= 0 ? '+' : ''}
      {value.toFixed(2)}
    </span>
  );
}

function TagGroups({ session }: { session: Session }): ReactNode {
  const groups: [string, string[]][] = [
    ['Topics', session.topics],
    ['Services', session.services],
    ['Areas', session.areasOfInterest],
    ['Roles', session.roles],
    ['Industries', session.industries],
    ['Features', session.features],
  ];
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
      {groups
        .filter(([, values]) => values.length > 0)
        .map(([label, values]) => (
          <div key={label} className="contents">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="flex flex-wrap gap-1">
              {values.map((v) => (
                <span key={v} className="rounded bg-secondary px-1.5 py-px text-xs">
                  {v}
                </span>
              ))}
            </dd>
          </div>
        ))}
    </dl>
  );
}
