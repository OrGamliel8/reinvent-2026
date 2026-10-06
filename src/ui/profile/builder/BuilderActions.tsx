import { useState, type ReactNode } from 'react';
import { ClipboardCopy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { Profile, ProfileDraft, Result, ValidationError } from '@/core/types';
import { usePlanner } from '../../PlannerProvider';
import { copyText } from '../../shared/CopyButton';
import { ImportPanel } from '../ImportPanel';
import { ValidationErrors } from '../ValidationErrors';

export function BuilderActions({ draft, onImported }: { draft: ProfileDraft; onImported: () => void }): ReactNode {
  const { api, mutate } = usePlanner();
  const [errors, setErrors] = useState<ValidationError[]>([]);

  const copyPrompt = async (): Promise<void> => {
    if (await copyText(await api.copyPrompt(draft))) toast.success('Prompt copied', { description: 'Paste into Claude, then paste the JSON below.' });
  };

  const applyDraft = async (): Promise<void> => {
    const result = await mutate<Result<Profile>>(async (planner) => {
      const built = await planner.profileFromDraft(draft);
      return built.ok ? planner.updateProfile(built.value) : built;
    });
    if (!result) return;
    setErrors(result.ok ? [] : result.errors);
    if (result.ok) toast.success('Profile saved', { description: 'Sessions are now ranked by your picks.' });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void copyPrompt()}>
            <ClipboardCopy /> Copy prompt
          </Button>
          <Button size="sm" variant="outline" onClick={() => void applyDraft()}>
            <Wand2 /> Use without Claude
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          <strong className="font-medium text-foreground">Copy prompt</strong> bakes your choices into a prompt; Claude adds rich interests and keywords.{' '}
          <strong className="font-medium text-foreground">Use without Claude</strong> saves a profile from your picks right away (it replaces the active profile's interests).
        </p>
        <ValidationErrors errors={errors} title="Not saved — fix these fields" />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Paste Claude's JSON</h3>
        <ImportPanel onImported={onImported} />
      </div>
    </div>
  );
}
