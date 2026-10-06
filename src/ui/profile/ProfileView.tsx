import { useState, type ReactNode } from 'react';
import { Download, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { Profile, Vocabulary } from '@/core/types';
import { usePlanner, usePlannerQuery } from '../PlannerProvider';
import { downloadText } from '../download';
import { EmptyState, SectionTitle } from '../shared/EmptyState';
import { ProfileBuilder } from './builder/ProfileBuilder';
import { ImportPanel } from './ImportPanel';
import { ProfileEditor } from './ProfileEditor';

export function ProfileView(): ReactNode {
  const { data } = usePlannerQuery(
    async (api) => ({ profile: await api.getProfile(), vocabulary: await api.vocabulary(), recorded: (await api.settings()).recorded }),
    [],
  );
  const [tab, setTab] = useState('builder');
  if (!data) return null;
  const { profile, vocabulary, recorded } = data;

  return (
    <div className="h-full overflow-y-auto">
      <Tabs value={tab} onValueChange={setTab} className="mx-auto max-w-6xl gap-6 px-4 pt-4 pb-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold">Your profile</h1>
            <p className="text-xs text-muted-foreground">{profile ? `Active: ${profile.name}` : 'No active profile yet'}</p>
          </div>
          <TabsList>
            <TabsTrigger value="builder">Builder</TabsTrigger>
            <TabsTrigger value="active">Edit active profile</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="builder">
          <ProfileBuilder vocabulary={vocabulary} recorded={recorded} />
        </TabsContent>
        <TabsContent value="active">
          <ActiveProfile profile={profile} vocabulary={vocabulary} onBuild={() => setTab('builder')} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// The advanced editor: interest weights and keywords, raw weights, export and file import.
function ActiveProfile({ profile, vocabulary, onBuild }: { profile: Profile | null; vocabulary: Vocabulary; onBuild: () => void }): ReactNode {
  return (
    <div className="flex flex-col gap-8 lg:flex-row">
      <div className="min-w-0 flex-1">
        {profile ? (
          <ProfileEditor key={JSON.stringify(profile)} profile={profile} vocabulary={vocabulary} />
        ) : (
          <EmptyState icon={UserRound} title="No profile yet">
            <p>Build one in the Builder tab, run the <code className="font-mono">profile-builder</code> skill in Claude Code, or import a JSON file.</p>
            <Button size="sm" className="mt-3" onClick={onBuild}>
              Open the builder
            </Button>
          </EmptyState>
        )}
      </div>
      <aside className="w-full shrink-0 space-y-6 border-t pt-6 lg:w-80 lg:border-t-0 lg:pt-0">
        {profile?.description && (
          <section className="space-y-2">
            <SectionTitle>Your description</SectionTitle>
            <blockquote className="rounded-md border-l-2 border-primary bg-muted/50 p-3 text-sm whitespace-pre-line italic">{profile.description}</blockquote>
          </section>
        )}
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
