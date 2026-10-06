import type { ReactNode } from 'react';
import { DatabaseBackup } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { usePlanner, usePlannerQuery } from './PlannerProvider';
import { BACKUP_STALE_MS, fmtAgo, saveBackup, useLastBackup } from './backup';

export function BackupButton(): ReactNode {
  const { api } = usePlanner();
  const lastBackup = useLastBackup();
  const { data: hasPlan } = usePlannerQuery(async (planner) => {
    const [agenda, starred, scores] = await Promise.all([planner.agenda(), planner.starred(), planner.manualScores()]);
    return agenda.length > 0 || starred.length > 0 || Object.keys(scores).length > 0;
  }, []);
  const due = !!hasPlan && (lastBackup === null || Date.now() - lastBackup > BACKUP_STALE_MS);
  const label = `Back up profile, agenda, stars and scores · ${lastBackup === null ? 'never backed up' : `last backup ${fmtAgo(lastBackup)}`}`;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" onClick={() => void saveBackup(api)} aria-label={label}>
          <DatabaseBackup />
          {due && <span className="absolute top-0.5 right-0.5 size-2 rounded-full bg-warning ring-2 ring-sidebar" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
