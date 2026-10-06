import { useCallback, useEffect, useState } from 'react';
import type { ProfileDraft } from '@/core/types';
import { usePlanner } from '../../PlannerProvider';

const STORAGE_KEY = 'reinvent-planner.profile-draft.v1';

function readSaved(): Partial<ProfileDraft> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Partial<ProfileDraft>) : {};
  } catch {
    return {};
  }
}

function writeSaved(draft: ProfileDraft | null): void {
  try {
    if (draft) localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage unavailable (private window, blocked site data): the draft just won't survive a reload.
  }
}

interface DraftState {
  draft: ProfileDraft | null;
  update: (patch: Partial<ProfileDraft>) => void;
  resetFromProfile: () => Promise<void>;
}

// The builder draft: pre-filled from the active profile, overlaid with the auto-saved local draft.
export function useProfileDraft(): DraftState {
  const { api } = usePlanner();
  const [draft, setDraft] = useState<ProfileDraft | null>(null);

  useEffect(() => {
    let cancelled = false;
    void api.profileDraft().then((fresh) => !cancelled && setDraft({ ...fresh, ...readSaved() }));
    return () => {
      cancelled = true;
    };
  }, [api]);

  useEffect(() => {
    if (draft) writeSaved(draft);
  }, [draft]);

  const update = useCallback((patch: Partial<ProfileDraft>) => setDraft((d) => d && { ...d, ...patch }), []);

  const resetFromProfile = useCallback(async () => {
    writeSaved(null);
    setDraft(await api.profileDraft());
  }, [api]);

  return { draft, update, resetFromProfile };
}
