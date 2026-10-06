import { useState, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { travelKey } from '@/core/defaults';
import { VENUES, type RankingWeights, type Settings, type TravelTable, type VenueId } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { useTheme } from '../ThemeToggle';
import type { Theme } from '../theme';
import { SectionTitle } from '../shared/EmptyState';

const WEIGHTS: { key: keyof RankingWeights; label: string; hint: string }[] = [
  { key: 'text', label: 'Text relevance', hint: 'Full-text match of your interest keywords' },
  { key: 'tags', label: 'Tag match', hint: 'Topic and service weights from your profile' },
  { key: 'level', label: 'Level fit', hint: 'Inside your level range' },
  { key: 'format', label: 'Format preference', hint: 'Your format preferences and not-recorded bonus' },
];

export function SettingsView(): ReactNode {
  const { data } = usePlannerQuery(async (api) => ({ settings: await api.settings(), travel: await api.travelTable(), vocabulary: await api.vocabulary() }), []);
  if (!data) return null;
  const types = [...new Set([...data.vocabulary.types, ...Object.keys(data.settings.recorded)])].sort();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-8 p-6">
        <WeightsSection key={JSON.stringify(data.settings.weights)} settings={data.settings} />
        <RecordedSection settings={data.settings} types={types} />
        <TravelSection travel={data.travel} />
        <VenueSwitchesSection settings={data.settings} />
        <ThemeSection />
        <AboutSection />
      </div>
    </div>
  );
}

function WeightsSection({ settings }: { settings: Settings }): ReactNode {
  const { mutate } = usePlanner();
  const [weights, setWeights] = useState(settings.weights);
  const commit = (next: RankingWeights): void => void mutate((api) => api.updateSettings({ ...settings, weights: next }));
  return (
    <section className="space-y-3">
      <SectionTitle>Ranking weights</SectionTitle>
      <div className="space-y-4 rounded-lg border p-4">
        {WEIGHTS.map(({ key, label, hint }) => (
          <div key={key} className="grid grid-cols-[12rem_1fr_3rem] items-center gap-4">
            <div>
              <Label className="text-sm">{label}</Label>
              <p className="text-xs text-muted-foreground">{hint}</p>
            </div>
            <Slider
              min={0}
              max={2}
              step={0.05}
              value={[weights[key]]}
              onValueChange={([v]) => setWeights({ ...weights, [key]: v })}
              onValueCommit={([v]) => commit({ ...weights, [key]: v })}
            />
            <span className="text-right font-mono text-xs tabular-nums">{weights[key].toFixed(2)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecordedSection({ settings, types }: { settings: Settings; types: string[] }): ReactNode {
  const { mutate } = usePlanner();
  const toggle = (type: string, recorded: boolean): void =>
    void mutate((api) => api.updateSettings({ ...settings, recorded: { ...settings.recorded, [type]: recorded } }));
  return (
    <section className="space-y-3">
      <SectionTitle>Recorded formats</SectionTitle>
      <p className="text-xs text-muted-foreground">Auto-build prefers formats that aren't recorded, so you spend your time on what you can't watch later.</p>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 rounded-lg border p-4">
        {types.map((type) => (
          <label key={type} className="flex cursor-pointer items-center justify-between text-sm">
            {type}
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {settings.recorded[type] ? 'recorded' : 'not recorded'}
              <Switch size="sm" checked={settings.recorded[type] ?? false} onCheckedChange={(c) => toggle(type, c)} />
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function TravelSection({ travel }: { travel: TravelTable }): ReactNode {
  const { mutate } = usePlanner();
  const save = (a: VenueId, b: VenueId, value: string): void => {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0 || minutes === travel[travelKey(a, b)]) return;
    void mutate((api) => api.setTravel(a, b, minutes));
  };
  return (
    <section className="space-y-3">
      <SectionTitle>Travel time between venues (minutes)</SectionTitle>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th />
              {VENUES.map((v) => (
                <th key={v.id} className="px-2 py-2 text-left text-xs font-medium text-muted-foreground">
                  {v.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {VENUES.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">{row.name}</th>
                {VENUES.map((col) => (
                  <td key={col.id} className="px-2 py-1.5">
                    {row.id === col.id ? (
                      <span className="block px-2 text-muted-foreground">0</span>
                    ) : (
                      <Input
                        key={`${travelKey(row.id, col.id)}-${travel[travelKey(row.id, col.id)]}`}
                        type="number"
                        min={0}
                        defaultValue={travel[travelKey(row.id, col.id)] ?? 0}
                        onBlur={(e) => save(row.id, col.id, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="h-7 w-16 text-xs"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">The table is symmetric: editing one cell updates its mirror.</p>
    </section>
  );
}

function VenueSwitchesSection({ settings }: { settings: Settings }): ReactNode {
  const { mutate } = usePlanner();
  const save = (value: string): void => {
    if (value) void mutate((api) => api.updateSettings({ ...settings, maxVenueSwitchesPerDay: Number(value) }));
  };
  return (
    <section className="space-y-3">
      <SectionTitle>Max venue switches per day</SectionTitle>
      <ToggleGroup type="single" variant="outline" size="sm" value={String(settings.maxVenueSwitchesPerDay)} onValueChange={save} aria-label="Max venue switches per day">
        {['0', '1', '2', '3'].map((n) => (
          <ToggleGroupItem key={n} value={n} className="w-10">
            {n}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="text-xs text-muted-foreground">
        A switch is moving to a different hotel between two consecutive items (sessions or personal blocks with a venue). Auto-build never goes over this
        limit; 0 keeps each day in one venue. Pinned items are left alone, and days over the limit are flagged in My Agenda.
      </p>
    </section>
  );
}

function ThemeSection(): ReactNode {
  const [theme, setTheme] = useTheme();
  return (
    <section className="space-y-3">
      <SectionTitle>Theme</SectionTitle>
      <ToggleGroup type="single" variant="outline" size="sm" value={theme} onValueChange={(v: string) => v && setTheme(v as Theme)}>
        <ToggleGroupItem value="light">Light</ToggleGroupItem>
        <ToggleGroupItem value="dark">Dark</ToggleGroupItem>
        <ToggleGroupItem value="system">System</ToggleGroupItem>
      </ToggleGroup>
    </section>
  );
}

function AboutSection(): ReactNode {
  return (
    <section className="space-y-2 text-xs text-muted-foreground">
      <SectionTitle>About</SectionTitle>
      <p>
        Session data comes from the community catalog at{' '}
        <a className="underline hover:text-foreground" href="https://reinvent-planner.cloud/" target="_blank" rel="noreferrer">
          reinvent-planner.cloud
        </a>
        , thanks to its maintainer. This planner is an unofficial personal project, not affiliated with or endorsed by AWS. Always confirm times and
        reservations in the official re:Invent portal.
      </p>
      <p>Your profile, agenda and scores stay in this browser; nothing is sent anywhere.</p>
    </section>
  );
}
