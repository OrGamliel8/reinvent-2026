import { useRef, useState, type ReactNode } from 'react';
import { CalendarArrowDown, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import type { Result } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { downloadText } from '../download';

export function ExportControls(): ReactNode {
  const { api, mutate } = usePlanner();
  const [includePersonal, setIncludePersonal] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const exportIcs = async (): Promise<void> => {
    downloadText('reinvent-2026.ics', await api.exportIcs({ includePersonal }), 'text/calendar');
  };

  const exportState = async (): Promise<void> => {
    downloadText(`reinvent-planner-state-${new Date().toISOString().slice(0, 10)}.json`, await api.exportState(), 'application/json');
  };

  const importState = async (file: File): Promise<void> => {
    const text = await file.text();
    const result = await mutate<Result<null>>((planner) => planner.importState(text));
    if (!result) return;
    if (result.ok) toast.success('Planner state imported');
    else toast.error(`Import failed: ${result.errors.map((e) => `${e.path}: ${e.message}`).join('; ')}`);
  };

  return (
    <div className="flex items-center gap-2">
      <label className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground">
        <Checkbox checked={includePersonal} onCheckedChange={(c) => setIncludePersonal(c === true)} />
        Include personal blocks
      </label>
      <Button size="sm" variant="outline" onClick={() => void exportIcs()}>
        <CalendarArrowDown /> Export .ics
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost">
            State
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => void exportState()}>
            <Download /> Export state JSON
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileInput.current?.click()}>
            <Upload /> Import state JSON…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void importState(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}
