import type { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { DraftWeight, ProfileDraft, Vocabulary } from '@/core/types';
import { MultiSelect, toOptions } from '../../shared/MultiSelect';
import { AvailabilityFields, LevelSelect, ListInput } from '../fields';
import { BuilderActions } from './BuilderActions';
import { RemovableChips, ToggleChips, WeightChips } from './chips';
import { FormatChoices } from './FormatChoices';
import { useProfileDraft } from './useProfileDraft';

interface SectionProps {
  draft: ProfileDraft;
  update: (patch: Partial<ProfileDraft>) => void;
  vocabulary: Vocabulary;
}

export function ProfileBuilder({ vocabulary, recorded }: { vocabulary: Vocabulary; recorded: Record<string, boolean> }): ReactNode {
  const { draft, update, resetFromProfile } = useProfileDraft();
  if (!draft) return null;
  const props = { draft, update, vocabulary };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="min-w-0 space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="max-w-prose text-sm text-muted-foreground">
            Pick what you care about. Your draft saves automatically. Then copy a prompt for Claude, or use your picks directly.
          </p>
          <Button size="xs" variant="ghost" onClick={() => void resetFromProfile()}>
            <RotateCcw /> Reset to active profile
          </Button>
        </div>
        <AboutSection {...props} />
        <Section step={2} title="Topics" hint="Click a topic to select it, then set how much it matters.">
          <WeightChips options={vocabulary.topics} value={draft.topics} onChange={(topics) => update({ topics })} />
        </Section>
        <ServicesSection {...props} />
        <Section step={4} title="Level range" hint="100 foundational · 200 intermediate · 300 advanced · 400 expert · 500 distinguished">
          <LevelRange {...props} />
        </Section>
        <Section step={5} title="Formats" hint="Recorded formats can be watched later, so unrecorded ones are preferred by default.">
          <FormatChoices types={vocabulary.types} recorded={recorded} value={draft.formats} onChange={(formats) => update({ formats })} />
        </Section>
        <Section step={6} title="Availability" hint="Days you attend, in Las Vegas local time.">
          <AvailabilityFields availability={draft.availability} onChange={(availability) => update({ availability })} />
        </Section>
        <AvoidSection {...props} />
        <Section step={8} title="In your own words">
          <Label htmlFor="builder-free-text" className="text-sm font-normal text-muted-foreground">
            Describe what you want from re:Invent in your own words
          </Label>
          <Textarea
            id="builder-free-text"
            rows={5}
            value={draft.freeText}
            onChange={(e) => update({ freeText: e.target.value })}
            placeholder="e.g. I lead a platform team moving to agentic workflows. I want deep, hands-on content on building and securing agents, and I skip anything about mainframes."
            className="text-sm"
          />
        </Section>
      </div>
      <aside className="lg:sticky lg:top-4 lg:self-start">
        <Section step={9} title="Generate your profile">
          <BuilderActions draft={draft} onImported={() => void resetFromProfile()} />
        </Section>
      </aside>
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }): ReactNode {
  return (
    <section className="space-y-3" aria-labelledby={`builder-step-${step}`}>
      <div>
        <h2 id={`builder-step-${step}`} className="flex items-center gap-2 text-sm font-semibold">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary/15 text-[0.7rem] text-primary tabular-nums">{step}</span>
          {title}
        </h2>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function AboutSection({ draft, update, vocabulary }: SectionProps): ReactNode {
  return (
    <Section step={1} title="About you">
      <div className="space-y-1.5">
        <Label htmlFor="builder-name" className="text-xs">
          Profile name
        </Label>
        <Input id="builder-name" value={draft.name} onChange={(e) => update({ name: e.target.value })} className="h-8 max-w-sm" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Roles</Label>
        <ToggleChips options={vocabulary.roles} selected={draft.roles} onChange={(roles) => update({ roles })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Industries (optional, context for Claude)</Label>
        <ToggleChips options={vocabulary.industries} selected={draft.industries} onChange={(industries) => update({ industries })} />
      </div>
    </Section>
  );
}

function ServicesSection({ draft, update, vocabulary }: SectionProps): ReactNode {
  const selected = Object.keys(draft.services);
  const pick = (names: string[]): void => update({ services: Object.fromEntries(names.map((n): [string, DraftWeight] => [n, draft.services[n] ?? 'high'])) });
  return (
    <Section step={3} title="Services" hint="Search the catalog's AWS services; set a weight for each one you pick.">
      <MultiSelect label="Services" options={toOptions(vocabulary.services)} selected={selected} onChange={pick} className="w-56" />
      {selected.length > 0 && <WeightChips options={selected} value={draft.services} onChange={(services) => update({ services })} />}
    </Section>
  );
}

function LevelRange({ draft, update, vocabulary }: SectionProps): ReactNode {
  const { min, max } = draft.level;
  return (
    <div className="flex items-center gap-2 text-sm">
      From
      <LevelSelect label="Minimum level" levels={vocabulary.levels} value={min} onChange={(v) => update({ level: { min: v, max: Math.max(v, max) } })} />
      to
      <LevelSelect label="Maximum level" levels={vocabulary.levels} value={max} onChange={(v) => update({ level: { min: Math.min(v, min), max: v } })} />
    </div>
  );
}

function AvoidSection({ draft, update, vocabulary }: SectionProps): ReactNode {
  const avoid = draft.avoid;
  const set = (patch: Partial<ProfileDraft['avoid']>): void => update({ avoid: { ...avoid, ...patch } });
  return (
    <Section step={7} title="Avoid" hint="Sessions matching any of these are left out of the ranking.">
      <div className="space-y-1.5">
        <Label className="text-xs">Keywords</Label>
        <ListInput key={avoid.keywords.join('|')} value={avoid.keywords} onChange={(keywords) => set({ keywords })} placeholder="e.g. mainframe, blockchain" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Topics</Label>
        <ToggleChips options={vocabulary.topics} selected={avoid.topics} onChange={(topics) => set({ topics })} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Services</Label>
        <MultiSelect label="Services" options={toOptions(vocabulary.services)} selected={avoid.services} onChange={(services) => set({ services })} className="w-56" />
        <RemovableChips values={avoid.services} onRemove={(s) => set({ services: avoid.services.filter((v) => v !== s) })} />
      </div>
    </Section>
  );
}
