import { useState, type ReactNode } from 'react';
import { ClipboardCopy, Wand2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import type { ProfileDraft, ValidationError } from '@/core/types';
import { usePlanner } from '../../PlannerProvider';
import { copyText } from '../../shared/CopyButton';
import { ImportPanel } from '../ImportPanel';
import { useIncomingProfile } from '../library/useIncomingProfile';
import { ValidationErrors } from '../ValidationErrors';

export function BuilderActions({ draft, onImported }: { draft: ProfileDraft; onImported: () => void }): ReactNode {
  const { api } = usePlanner();
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const { offer, dialog } = useIncomingProfile();

  const copyPrompt = async (): Promise<void> => {
    if (await copyText(await api.copyPrompt(draft))) toast.success('Prompt copied', { description: 'Paste into Claude, then paste the JSON below.' });
  };

  const applyDraft = async (): Promise<void> => {
    const built = await api.profileFromDraft(draft);
    setErrors(built.ok ? [] : built.errors);
    if (built.ok) await offer(built.value);
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
          <strong className="font-medium text-foreground">Use without Claude</strong> saves a profile from your picks right away; you choose whether it replaces your active profile or becomes a new one.
        </p>
        <ValidationErrors errors={errors} title="Not saved — fix these fields" />
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Paste Claude's JSON</h3>
        <ImportPanel onImported={onImported} />
      </div>
      {dialog}
    </div>
  );
}
