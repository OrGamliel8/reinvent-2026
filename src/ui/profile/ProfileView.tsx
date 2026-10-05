import type { ReactNode } from 'react';
import { ClipboardCopy, Download, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { downloadText } from '../download';
import { copyText } from '../shared/CopyButton';
import { EmptyState, SectionTitle } from '../shared/EmptyState';
import { ImportPanel } from './ImportPanel';
import { ProfileEditor } from './ProfileEditor';

export function ProfileView(): ReactNode {
  const { data } = usePlannerQuery(async (api) => ({ profile: await api.getProfile(), vocabulary: await api.vocabulary() }), []);
  if (!data) return null;
  const { profile, vocabulary } = data;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-6xl gap-8 px-6 pb-10">
        <div className="min-w-0 flex-1">
          {profile ? (
            <ProfileEditor key={JSON.stringify(profile)} profile={profile} vocabulary={vocabulary} />
          ) : (
            <EmptyState icon={UserRound} title="No profile yet">
              <p>Describe what you care about in plain English and let Claude turn it into a profile. Two ways:</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-left">
                <li>
                  In Claude Code in this repo, run the <code className="font-mono">profile-builder</code> skill. It writes a JSON file into <code className="font-mono">profiles/</code>.
                </li>
                <li>Or click "Copy prompt", paste it into any Claude chat with your description, and save the JSON it returns.</li>
              </ol>
              <p className="mt-3">Then import the JSON on the right.</p>
            </EmptyState>
          )}
        </div>
        <aside className="w-80 shrink-0 space-y-6 pt-4">
          {profile?.description && (
            <section className="space-y-2">
              <SectionTitle>Your description</SectionTitle>
              <blockquote className="rounded-md border-l-2 border-primary bg-muted/50 p-3 text-sm whitespace-pre-line italic">{profile.description}</blockquote>
            </section>
          )}
          <section className="space-y-2">
            <SectionTitle>Generate with Claude</SectionTitle>
            <CopyPromptButton />
            <p className="text-xs text-muted-foreground">Copies a prompt with the profile schema and the catalog's real topics and services. Paste it into Claude with your description.</p>
          </section>
          <section className="space-y-2">
            <SectionTitle>Import</SectionTitle>
            <ImportPanel />
          </section>
          {profile && (
            <section className="space-y-2">
              <SectionTitle>Export</SectionTitle>
              <ExportProfileButton name={profile.name} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function CopyPromptButton(): ReactNode {
  const { api } = usePlanner();
  const copy = async (): Promise<void> => {
    if (await copyText(await api.copyPrompt())) toast.success('Prompt copied — paste it into Claude');
  };
  return (
    <Button size="sm" variant="outline" onClick={() => void copy()}>
      <ClipboardCopy /> Copy prompt
    </Button>
  );
}

function ExportProfileButton({ name }: { name: string }): ReactNode {
  const { api } = usePlanner();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'profile';
  return (
    <Button size="sm" variant="outline" onClick={() => void api.exportProfile().then((json) => downloadText(`${slug}.json`, json, 'application/json'))}>
      <Download /> Export profile JSON
    </Button>
  );
}
