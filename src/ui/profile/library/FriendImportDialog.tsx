import { useRef, useState, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ProfileEntrySummary, Result, ValidationError } from '@/core/types';
import { usePlanner } from '../../PlannerProvider';
import { ValidationErrors } from '../ValidationErrors';

export function FriendImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">{open && <ImportBody onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ImportBody({ onDone }: { onDone: () => void }): ReactNode {
  const { mutate } = usePlanner();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const setJson = (json: string, file: string | null): void => {
    setText(json);
    setFileName(file);
    setErrors([]);
  };

  const importPlan = async (): Promise<void> => {
    const result = await mutate<Result<ProfileEntrySummary>>((api) => api.importSharedPlan(text, name));
    if (!result) return;
    if (!result.ok) return setErrors(result.errors);
    toast.success(`Saved ${result.value.name}'s plan (${result.value.agendaCount} sessions)`);
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add a friend's plan</DialogTitle>
        <DialogDescription>
          Load the file a friend made with <strong>Share my plan</strong>, or a plain agenda export. Importing a newer file from the same friend updates their
          entry. Your own profile and agenda are not changed.
        </DialogDescription>
      </DialogHeader>
      <div className="min-w-0 space-y-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
              <FileUp /> Choose file…
            </Button>
            <span className="truncate text-xs text-muted-foreground">{fileName ?? 'or paste the JSON below'}</span>
          </div>
          <Textarea
            value={text}
            onChange={(e) => setJson(e.target.value, null)}
            rows={5}
            placeholder='{ "kind": "reinvent-planner-shared-plan", … }'
            aria-label="Shared plan JSON"
            className="max-h-40 font-mono text-xs"
          />
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) setJson(await file.text(), file.name);
            }}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="friend-name" className="text-xs">
            Name (optional for shared plans, required for agenda files)
          </Label>
          <Input id="friend-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice" className="h-8 max-w-xs" />
        </div>
        <ValidationErrors errors={errors} title="The file could not be imported" />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!text.trim()} onClick={() => void importPlan()}>
          Import
        </Button>
      </DialogFooter>
    </>
  );
}
