import { useRef, useState, type ReactNode } from 'react';
import { ArrowRight, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import type { AgendaImportOptions, AgendaImportReport, Result, ValidationError } from '@/core/types';
import { usePlanner } from '../PlannerProvider';
import { ValidationErrors } from '../profile/ValidationErrors';

const MODES: { value: AgendaImportOptions['mode']; label: string; hint: string }[] = [
  { value: 'merge', label: 'Merge', hint: 'Keep your agenda; an imported session replaces the same session already on it.' },
  { value: 'replace', label: 'Replace', hint: 'Clear your agenda and stars first.' },
];

export function AgendaImportDialog({ open, onOpenChange, agendaSize }: { open: boolean; onOpenChange: (open: boolean) => void; agendaSize: number }): ReactNode {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">{open && <ImportBody agendaSize={agendaSize} onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  );
}

function ImportBody({ agendaSize, onDone }: { agendaSize: number; onDone: () => void }): ReactNode {
  const { mutate } = usePlanner();
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [mode, setMode] = useState<AgendaImportOptions['mode']>(agendaSize > 0 ? 'merge' : 'replace');
  const [includeBlocks, setIncludeBlocks] = useState(true);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [report, setReport] = useState<AgendaImportReport | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const importAgenda = async (): Promise<void> => {
    setImporting(true);
    const result = await mutate<Result<AgendaImportReport>>((api) => api.importAgenda(text, { mode, includeBlocks }));
    setImporting(false);
    if (!result) return;
    if (result.ok) setReport(result.value);
    else setErrors(result.errors);
  };

  if (report) {
    return (
      <>
        <DialogHeader>
          <DialogTitle>Agenda imported</DialogTitle>
          <DialogDescription>{summary(report)}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] space-y-4 overflow-y-auto text-sm">
          {report.movedToOtherSlot.length > 0 && (
            <section>
              <h3 className="mb-1 font-medium">Moved to another slot ({report.movedToOtherSlot.length})</h3>
              <ul className="space-y-1.5">
                {report.movedToOtherSlot.map((m, i) => (
                  <li key={i} className="text-xs">
                    <div className="font-medium">{m.title}</div>
                    <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                      {m.from} <ArrowRight className="size-3" /> <span className="text-foreground">{m.to}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.skipped.length > 0 && (
            <section>
              <h3 className="mb-1 font-medium">Skipped ({report.skipped.length})</h3>
              <ul className="space-y-1">
                {report.skipped.map((s, i) => (
                  <li key={i} className="text-xs">
                    <span className="font-mono">{s.code}</span> {s.title && <span>{s.title}</span>} <span className="text-muted-foreground">— {s.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {report.movedToOtherSlot.length + report.skipped.length === 0 && <p className="text-muted-foreground">Everything was restored as exported.</p>}
          <p className="text-xs text-muted-foreground">Sessions whose time or room changed since the export show up as alerts.</p>
        </div>
        <DialogFooter>
          <Button onClick={onDone}>Done</Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Import agenda</DialogTitle>
        <DialogDescription>Load an agenda exported from this planner. Your profile and settings are not changed.</DialogDescription>
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
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
              setErrors([]);
            }}
            rows={5}
            placeholder='{ "kind": "reinvent-planner-agenda", … }'
            aria-label="Agenda JSON"
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
              if (!file) return;
              setText(await file.text());
              setFileName(file.name);
              setErrors([]);
            }}
          />
        </div>
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium">Mode</legend>
          {MODES.map((m) => (
            <label key={m.value} className="flex cursor-pointer items-start gap-2 text-sm">
              <input type="radio" name="agenda-import-mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 accent-primary" />
              <span>
                <span className="font-medium">{m.label}</span> <span className="text-xs text-muted-foreground">{m.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={includeBlocks} onCheckedChange={(c) => setIncludeBlocks(c === true)} />
          Include personal blocks
        </label>
        <ValidationErrors errors={errors} title="The agenda file is invalid" />
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!text.trim() || importing} onClick={() => void importAgenda()}>
          {importing ? 'Importing…' : 'Import'}
        </Button>
      </DialogFooter>
    </>
  );
}

function summary(report: AgendaImportReport): string {
  const parts = [`${report.added} added`];
  if (report.replaced) parts.push(`${report.replaced} replaced`);
  if (report.movedToOtherSlot.length) parts.push(`${report.movedToOtherSlot.length} moved to another slot`);
  if (report.skipped.length) parts.push(`${report.skipped.length} skipped`);
  parts.push(`${report.starred} starred`, `${report.blocks} blocks`);
  if (report.scores) parts.push(`${report.scores} scores`);
  return parts.join(' · ');
}
