import { useRef, useState, type ReactNode } from 'react';
import { FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { ValidationError } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { errorMessage } from '../plannerClient';
import { useIncomingProfile } from './library/useIncomingProfile';
import { ValidationErrors } from './ValidationErrors';

export function ImportPanel({ onImported }: { onImported?: () => void } = {}): ReactNode {
  const { api } = usePlanner();
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const { offer, dialog } = useIncomingProfile(() => {
    setText('');
    onImported?.();
  });

  const importJson = async (json: string): Promise<void> => {
    const result = await api.parseProfile(json).catch((error: unknown) => ({ ok: false as const, errors: [{ path: '', message: errorMessage(error) }] }));
    setErrors(result.ok ? [] : result.errors);
    if (result.ok) await offer(result.value);
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
      {dialog}
    </div>
  );
}
