import { useState, type ReactNode } from 'react';
import { Check, Copy, Pencil, Save, Share2, Trash2, UserPlus, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ProfileEntrySummary } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../../PlannerProvider';
import { downloadText, slugify } from '../../download';
import { readPref, writePref } from '../../explore/prefs';
import { fmtDateTime } from '../../format';
import { EmptyState, SectionTitle } from '../../shared/EmptyState';
import { ConfirmDialog, NameDialog, type ConfirmRequest, type NameRequest } from './dialogs';
import { FriendImportDialog } from './FriendImportDialog';

const SHARE_NAME_KEY = 'reinvent-planner-share-name';

export function ProfilesPanel({ hasProfile }: { hasProfile: boolean }): ReactNode {
  const { mutate } = usePlanner();
  const { data: entries } = usePlannerQuery((planner) => planner.profiles(), []);
  const [nameRequest, setNameRequest] = useState<NameRequest | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  if (!entries) return null;
  const mine = entries.filter((e) => e.kind === 'mine');
  const friends = entries.filter((e) => e.kind === 'friend');

  const saveAs = (): void =>
    setNameRequest({
      title: 'Save current profile as…',
      description: 'Keeps a copy of the active profile in your library, so you can switch back to it later.',
      label: 'Profile name',
      initial: '',
      confirmLabel: 'Save',
      onSubmit: (name) => mutate((p) => p.saveProfileAs(name), `Saved "${name}"`),
    });

  const share = (): void =>
    setNameRequest({
      title: 'Share my plan',
      description: 'Downloads your active profile, agenda, stars and scores as a file your friends can add in their Profiles tab.',
      label: 'Your name, as friends will see it',
      initial: readPref(SHARE_NAME_KEY) ?? '',
      confirmLabel: 'Download',
      onSubmit: async (name) => {
        writePref(SHARE_NAME_KEY, name);
        const json = await mutate((p) => p.exportSharedPlan(name));
        if (json) downloadText(`reinvent-2026-plan-${slugify(name, 'me')}-${new Date().toLocaleDateString('en-CA')}.json`, json, 'application/json');
      },
    });

  const actions: EntryActions = {
    activate: (e) => void mutate((p) => p.activateProfile(e.id), `"${e.name}" is now your active profile`),
    rename: (e) =>
      setNameRequest({
        title: `Rename "${e.name}"`,
        label: 'Name',
        initial: e.name,
        confirmLabel: 'Rename',
        onSubmit: (name) => mutate((p) => p.renameProfile(e.id, name)),
      }),
    duplicate: (e) => void mutate((p) => p.duplicateProfile(e.id), `Duplicated "${e.name}"`),
    remove: (e) =>
      setConfirm({
        title: `Delete "${e.name}"?`,
        description: e.active ? 'Your active profile stays as it is; only the saved entry is removed.' : 'The saved entry is removed from your library.',
        confirmLabel: 'Delete',
        onConfirm: () => void mutate((p) => p.deleteProfile(e.id), `Deleted "${e.name}"`),
      }),
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-8">
        <section className="space-y-3">
          <SectionTitle
            action={
              <Button size="xs" variant="outline" disabled={!hasProfile} onClick={saveAs} title={hasProfile ? undefined : 'Build or import a profile first'}>
                <Save /> Save current as…
              </Button>
            }
          >
            My profiles
          </SectionTitle>
          {mine.length ? (
            <EntryList entries={mine} actions={actions} />
          ) : (
            <p className="text-sm text-muted-foreground">Save your active profile to keep several versions (e.g. "Deep security" and "AI breadth") and switch between them. Your agenda stays as it is when you switch.</p>
          )}
        </section>
        <section className="space-y-3">
          <SectionTitle
            action={
              <Button size="xs" variant="outline" onClick={() => setImportOpen(true)}>
                <UserPlus /> Add a friend's plan
              </Button>
            }
          >
            Friends
          </SectionTitle>
          {friends.length ? (
            <EntryList entries={friends} actions={actions} />
          ) : (
            <EmptyState icon={Users} title="No friends' plans yet">
              <p>Ask each friend to open this planner and click <strong>Share my plan</strong>, then send you the downloaded file. Add it here to compare plans.</p>
            </EmptyState>
          )}
        </section>
      </div>
      <aside className="order-first space-y-3 border-b pb-6 lg:order-none lg:border-b-0 lg:pb-0">
        <SectionTitle>Share</SectionTitle>
        <p className="text-sm text-muted-foreground">
          Send friends your active profile and agenda. When they import a newer file from you, it updates the same entry on their side.
        </p>
        <Button size="sm" onClick={share}>
          <Share2 /> Share my plan
        </Button>
      </aside>
      <NameDialog request={nameRequest} onClose={() => setNameRequest(null)} />
      <FriendImportDialog open={importOpen} onOpenChange={setImportOpen} />
      <ConfirmDialog request={confirm} onClose={() => setConfirm(null)} />
    </div>
  );
}

interface EntryActions {
  activate: (entry: ProfileEntrySummary) => void;
  rename: (entry: ProfileEntrySummary) => void;
  duplicate: (entry: ProfileEntrySummary) => void;
  remove: (entry: ProfileEntrySummary) => void;
}

function EntryList({ entries, actions }: { entries: ProfileEntrySummary[]; actions: EntryActions }): ReactNode {
  return (
    <ul className="divide-y rounded-lg border">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{entry.name}</span>
              {entry.active && (
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  <Check /> Active
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{describe(entry)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="xs"
              variant="outline"
              disabled={!entry.hasProfile || entry.active}
              title={entry.hasProfile ? 'Rank sessions with this profile; your agenda stays as it is' : 'Imported from an agenda file: no profile to use'}
              onClick={() => actions.activate(entry)}
            >
              Use as active
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Rename ${entry.name}`} title="Rename" onClick={() => actions.rename(entry)}>
              <Pencil />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Duplicate ${entry.name}`} title="Duplicate as one of my profiles" disabled={!entry.hasProfile} onClick={() => actions.duplicate(entry)}>
              <Copy />
            </Button>
            <Button size="icon-xs" variant="ghost" aria-label={`Delete ${entry.name}`} title="Delete" onClick={() => actions.remove(entry)}>
              <Trash2 className="text-destructive" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

function describe(entry: ProfileEntrySummary): string {
  const parts = [`Updated ${fmtDateTime(entry.updatedAt)}`];
  if (entry.hasPlan) parts.push(`${entry.agendaCount} sessions`, `${entry.starCount} starred`);
  if (!entry.hasProfile) parts.push('agenda only, no profile');
  return parts.join(' · ');
}
