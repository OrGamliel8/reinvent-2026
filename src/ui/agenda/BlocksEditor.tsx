import { useState, type ReactNode } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DAYS, VENUES, type DayId, type PersonalBlock, type VenueId } from '@/core/types';
import { cn } from '@/lib/utils';
import { usePlanner } from '../PlannerProvider';
import { SectionTitle } from '../shared/EmptyState';

const NONE = '__none';

const NEW_BLOCK: Omit<PersonalBlock, 'id'> = { title: 'New block', kind: 'personal', day: 'mon', start: '12:00', end: '13:00', venue: null, enabled: true };

export function BlocksEditor({ blocks }: { blocks: PersonalBlock[] }): ReactNode {
  const { mutate } = usePlanner();
  const keynotes = blocks.filter((b) => b.kind === 'keynote');
  const personal = blocks.filter((b) => b.kind === 'personal');
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <SectionTitle>Keynotes</SectionTitle>
        <p className="text-xs text-muted-foreground">Keynotes aren't in the catalog. Enter times from the official agenda, then switch them on.</p>
        {keynotes.map((b) => (
          <BlockRow key={JSON.stringify(b)} block={b} />
        ))}
      </section>
      <section className="space-y-2">
        <SectionTitle
          action={
            <Button size="xs" variant="outline" onClick={() => void mutate((api) => api.createBlock(NEW_BLOCK), 'Block added')}>
              <Plus /> Add block
            </Button>
          }
        >
          Personal blocks
        </SectionTitle>
        {personal.length === 0 && <p className="text-xs text-muted-foreground">Meetings, expo hall, parties — the planner schedules around them.</p>}
        {personal.map((b) => (
          <BlockRow key={JSON.stringify(b)} block={b} />
        ))}
      </section>
    </div>
  );
}

// Keyed by the saved values, so the draft resets whenever the stored block changes.
function BlockRow({ block }: { block: PersonalBlock }): ReactNode {
  const { mutate } = usePlanner();
  const [draft, setDraft] = useState(block);
  const dirty = JSON.stringify(draft) !== JSON.stringify(block);
  const set = (patch: Partial<PersonalBlock>): void => setDraft({ ...draft, ...patch });
  const scheduled = draft.day && draft.start && draft.end;
  const save = (next: PersonalBlock): void => void mutate((api) => api.updateBlock(next));

  return (
    <div className={cn('space-y-1.5 rounded-md border p-2', !draft.enabled && 'opacity-70')}>
      <div className="flex items-center gap-2">
        <Input value={draft.title} onChange={(e) => set({ title: e.target.value })} className="h-7 flex-1 text-sm font-medium" disabled={block.kind === 'keynote'} />
        <Switch
          size="sm"
          checked={draft.enabled}
          disabled={!scheduled}
          title={scheduled ? 'Use in planning' : 'Set a day and time first'}
          onCheckedChange={(enabled) => save({ ...draft, enabled })}
        />
        {block.kind === 'personal' && (
          <Button size="icon-xs" variant="ghost" aria-label="Delete block" onClick={() => void mutate((api) => api.deleteBlock(block.id), 'Block deleted')}>
            <Trash2 />
          </Button>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={draft.day ?? NONE} onValueChange={(v) => set({ day: v === NONE ? null : (v as DayId) })}>
          <SelectTrigger size="sm" className="w-28 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No day</SelectItem>
            {DAYS.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="time" value={draft.start ?? ''} onChange={(e) => set({ start: e.target.value || null })} className="h-7 w-24 px-1.5 text-xs" />
        <span className="text-xs text-muted-foreground">–</span>
        <Input type="time" value={draft.end ?? ''} onChange={(e) => set({ end: e.target.value || null })} className="h-7 w-24 px-1.5 text-xs" />
        <Select value={draft.venue ?? NONE} onValueChange={(v) => set({ venue: v === NONE ? null : (v as VenueId) })}>
          <SelectTrigger size="sm" className="w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No venue</SelectItem>
            {VENUES.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {dirty && (
          <Button size="xs" onClick={() => save(draft)}>
            <Save /> Save
          </Button>
        )}
      </div>
    </div>
  );
}
