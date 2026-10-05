import { useRef, useState, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Profile, Result, ValidationError } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { ValidationErrors } from './ValidationErrors';

export function ImportPanel(): ReactNode {
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
    } else {
      setErrors(result.errors);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
          <FileUp /> Import JSON file…
        </Button>
        <span className="text-xs text-muted-foreground">or paste it below</span>
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
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder='{ "version": 1, "name": "…", … }' className="max-h-48 font-mono text-xs" />
      <Button size="sm" disabled={!text.trim()} onClick={() => void importJson(text)}>
        Import pasted profile
      </Button>
      <ValidationErrors errors={errors} title="The profile is invalid" />
    </div>
  );
}
