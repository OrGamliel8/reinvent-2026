import { useState, type ReactNode } from 'react';
import { Plus, RotateCcw, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { DAYS, type DayId, type Interest, type Profile, type Result, type ValidationError, type Vocabulary } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { MultiSelect, toOptions } from '../shared/MultiSelect';
import { SectionTitle } from '../shared/EmptyState';
import { ListInput, WeightMapEditor, WindowInput } from './fields';
import { ValidationErrors } from './ValidationErrors';

const LEVELS = [100, 200, 300, 400, 500];
const DEFAULT_WINDOW = { start: '08:00', end: '18:00' };

export function ProfileEditor({ profile, vocabulary }: { profile: Profile; vocabulary: Vocabulary }): ReactNode {
  const { mutate } = usePlanner();
  const [draft, setDraft] = useState(profile);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(profile);
  const set = (patch: Partial<Profile>): void => setDraft({ ...draft, ...patch });

  const save = async (): Promise<void> => {
    const result = await mutate<Result<Profile>>((api) => api.updateProfile(draft));
    if (result) setErrors(result.ok ? [] : result.errors);
  };

  return (
    <div className="space-y-8">
      <div className="sticky top-0 z-10 -mx-6 flex items-center gap-2 border-b bg-background/95 px-6 py-2 backdrop-blur">
        <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} className="h-8 max-w-xs font-medium" aria-label="Profile name" />
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="ghost" disabled={!dirty} onClick={() => setDraft(profile)}>
            <RotateCcw /> Revert
          </Button>
          <Button size="sm" disabled={!dirty} onClick={() => void save()}>
            <Save /> Save profile
          </Button>
        </div>
      </div>
      <ValidationErrors errors={errors} title="Not saved — fix these fields" />

      <InterestsSection interests={draft.interests} onChange={(interests) => set({ interests })} />

      <section className="space-y-3">
        <SectionTitle>Topics</SectionTitle>
        <WeightMapEditor value={draft.topics} onChange={(topics) => set({ topics })} options={vocabulary.topics} addLabel="Add a topic…" />
      </section>

      <section className="space-y-3">
        <SectionTitle>Services</SectionTitle>
        <WeightMapEditor value={draft.services} onChange={(services) => set({ services })} options={vocabulary.services} addLabel="Add a service…" />
      </section>

      <section className="space-y-3">
        <SectionTitle>Level & formats</SectionTitle>
        <div className="flex items-center gap-2 text-sm">
          Level
          <LevelSelect value={draft.level.min} onChange={(min) => set({ level: { ...draft.level, min } })} />
          to
          <LevelSelect value={draft.level.max} onChange={(max) => set({ level: { ...draft.level, max } })} />
        </div>
        <p className="text-xs text-muted-foreground">Format preference: −1 avoid … +1 prefer.</p>
        <WeightMapEditor value={draft.formats} onChange={(formats) => set({ formats })} options={vocabulary.types} min={-1} max={1} addLabel="Add a format…" />
      </section>

      <section className="space-y-3">
        <SectionTitle>Avoid</SectionTitle>
        <p className="text-xs text-muted-foreground">Matching sessions are hidden from ranking (the Sessions filter "Show avoided" brings them back).</p>
        <Label className="text-xs">Keywords</Label>
        <ListInput value={draft.avoid.keywords} onChange={(keywords) => set({ avoid: { ...draft.avoid, keywords } })} placeholder="e.g. mainframe, SAP" />
        <div className="flex gap-2">
          <MultiSelect label="Topics" options={toOptions(vocabulary.topics)} selected={draft.avoid.topics} onChange={(topics) => set({ avoid: { ...draft.avoid, topics } })} />
          <MultiSelect label="Services" options={toOptions(vocabulary.services)} selected={draft.avoid.services} onChange={(services) => set({ avoid: { ...draft.avoid, services } })} />
        </div>
      </section>

      <AvailabilitySection availability={draft.availability} onChange={(availability) => set({ availability })} />
    </div>
  );
}

function LevelSelect({ value, onChange }: { value: number; onChange: (v: number) => void }): ReactNode {
  return (
    <Select value={String(value)} onValueChange={(v) => onChange(Number(v))}>
      <SelectTrigger size="sm" className="w-20 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {LEVELS.map((l) => (
          <SelectItem key={l} value={String(l)}>
            {l}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InterestsSection({ interests, onChange }: { interests: Interest[]; onChange: (v: Interest[]) => void }): ReactNode {
  const update = (index: number, patch: Partial<Interest>): void => onChange(interests.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  return (
    <section className="space-y-3">
      <SectionTitle
        action={
          <Button size="xs" variant="outline" onClick={() => onChange([...interests, { label: 'New interest', weight: 0.5, keywords: [] }])}>
            <Plus /> Add interest
          </Button>
        }
      >
        Interests
      </SectionTitle>
      {interests.map((interest, index) => (
        <div key={index} className="space-y-2 rounded-md border p-3">
          <div className="grid grid-cols-[minmax(0,14rem)_1fr_2.5rem_1.5rem] items-center gap-3">
            <Input value={interest.label} onChange={(e) => update(index, { label: e.target.value })} className="h-7 text-sm font-medium" />
            <Slider min={0} max={1} step={0.05} value={[interest.weight]} onValueChange={([weight]) => update(index, { weight })} />
            <span className="text-right font-mono text-xs tabular-nums">{interest.weight.toFixed(2)}</span>
            <Button size="icon-xs" variant="ghost" aria-label="Remove interest" onClick={() => onChange(interests.filter((_, i) => i !== index))}>
              <X />
            </Button>
          </div>
          <ListInput value={interest.keywords} onChange={(keywords) => update(index, { keywords })} placeholder="Keywords and synonyms, comma-separated" />
        </div>
      ))}
    </section>
  );
}

function AvailabilitySection({ availability, onChange }: { availability: Profile['availability']; onChange: (v: Profile['availability']) => void }): ReactNode {
  const setDay = (day: DayId, window: Profile['availability']['days'][DayId] | undefined): void => {
    const days = { ...availability.days };
    if (window) days[day] = window;
    else delete days[day];
    onChange({ ...availability, days });
  };
  return (
    <section className="space-y-3">
      <SectionTitle>Availability</SectionTitle>
      <div className="space-y-1.5">
        {DAYS.map((d) => {
          const window = availability.days[d.id];
          return (
            <div key={d.id} className="flex items-center gap-3">
              <label className="flex w-32 items-center gap-2 text-sm">
                <Checkbox checked={!!window} onCheckedChange={(c) => setDay(d.id, c === true ? DEFAULT_WINDOW : undefined)} />
                {d.label}
              </label>
              {window ? <WindowInput value={window} onChange={(w) => setDay(d.id, w)} /> : <span className="text-xs text-muted-foreground">Not attending</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3">
        <label className="flex w-32 items-center gap-2 text-sm">
          <Checkbox checked={!!availability.lunch} onCheckedChange={(c) => onChange({ ...availability, lunch: c === true ? { start: '12:00', end: '13:00' } : null })} />
          Lunch
        </label>
        {availability.lunch && <WindowInput value={availability.lunch} onChange={(lunch) => onChange({ ...availability, lunch })} />}
      </div>
      <div className="flex items-center gap-3">
        <Label className="w-32 text-sm font-normal">Max per day</Label>
        <Input
          type="number"
          min={1}
          max={20}
          value={availability.maxPerDay}
          onChange={(e) => onChange({ ...availability, maxPerDay: Number(e.target.value) })}
          className="h-7 w-20 text-xs"
        />
      </div>
    </section>
  );
}
