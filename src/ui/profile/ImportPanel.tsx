import { useRef, useState, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Profile, Result, ValidationError } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { ValidationErrors } from './ValidationErrors';

export function ImportPanel({ onImported }: { onImported?: () => void } = {}): ReactNode {
  const { mutate } = usePlanner();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);

  const importJson = async (json: string): Promise<void> => {
    const result = await mutate<Result<Profile>>((api) => api.importProfile(json));
    if (!result) return;
    if (result.ok) {
      setErrors([]);
      setText('');
      toast.success(`Imported profile "${result.value.name}"`);
      onImported?.();
    } else {
      setErrors(result.errors);
    }
  };

  return (
    <div className="space-y-2">
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder='{ "version": 1, "name": "…", … }'
        aria-label="Profile JSON"
        className="max-h-48 font-mono text-xs"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={!text.trim()} onClick={() => void importJson(text)}>
          Import profile
        </Button>
        <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
          <FileUp /> Import JSON file…
        </Button>
      </div>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) await importJson(await file.text());
        }}
      />
      <ValidationErrors errors={errors} title="The profile is invalid" />
    </div>
  );
}
