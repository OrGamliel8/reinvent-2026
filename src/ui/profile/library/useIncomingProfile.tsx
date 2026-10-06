import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { uniqueName } from '@/core/profile/uniqueName';
import type { Profile, ProfileEntrySummary, Result } from '@/core/types';
import { usePlanner } from '../../PlannerProvider';
import { IncomingChoice, type IncomingProfile } from './dialogs';

// An incoming profile (import or "Use without Claude") never silently overwrites the active one: with an active profile,
// the user picks "Save as a new profile" or "Replace current profile" (the old version stays in the library).
export function useIncomingProfile(onSaved?: () => void): { offer: (profile: Profile) => Promise<void>; dialog: ReactNode } {
  const { api, mutate } = usePlanner();
  const [pending, setPending] = useState<IncomingProfile | null>(null);

  const save = async (profile: Profile, options: { mode: 'new' | 'replace'; name?: string }): Promise<void> => {
    const result = await mutate<Result<ProfileEntrySummary>>((planner) => planner.importProfileAs(profile, options));
    if (!result) return;
    if (!result.ok) return void toast.error(result.errors.map((e) => `${e.path}: ${e.message}`).join('; '));
    setPending(null);
    toast.success(`"${result.value.name}" is now your active profile`, { description: 'Your agenda is unchanged.' });
    onSaved?.();
  };

  const offer = async (profile: Profile): Promise<void> => {
    const [current, entries] = await Promise.all([api.getProfile(), api.profiles()]);
    if (!current) return save(profile, { mode: 'new' });
    const activeEntry = entries.find((e) => e.active && e.kind === 'mine');
    setPending({ profile, currentName: activeEntry?.name ?? current.name, suggestedName: uniqueName(profile.name, entries.map((e) => e.name)) });
  };

  const dialog = (
    <Dialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <DialogContent className="sm:max-w-md">{pending && <IncomingChoice key={pending.suggestedName} incoming={pending} onSave={save} />}</DialogContent>
    </Dialog>
  );
  return { offer, dialog };
}
