import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Profile } from '@/core/types';

export interface NameRequest {
  title: string;
  description?: string;
  label: string;
  initial: string;
  confirmLabel: string;
  onSubmit: (name: string) => Promise<unknown>;
}

export interface ConfirmRequest {
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}

// Keeps showing the last request while the dialog animates closed.
function useLastRequest<T>(request: T | null): T | null {
  const [last, setLast] = useState(request);
  if (request !== null && request !== last) setLast(request);
  return request ?? last;
}

// Asks for a name (Save as, Rename, Share). Pass `request = null` to close it.
export function NameDialog({ request, onClose }: { request: NameRequest | null; onClose: () => void }): ReactNode {
  const shown = useLastRequest(request);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>{shown && <NameForm key={shown.title + shown.initial} request={shown} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}

function NameForm({ request, onClose }: { request: NameRequest; onClose: () => void }): ReactNode {
  const [name, setName] = useState(request.initial);
  const submit = async (): Promise<void> => {
    if (!name.trim()) return;
    await request.onSubmit(name.trim());
    onClose();
  };
  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <DialogHeader>
        <DialogTitle>{request.title}</DialogTitle>
        {request.description && <DialogDescription>{request.description}</DialogDescription>}
      </DialogHeader>
      <div className="space-y-1.5">
        <Label htmlFor="name-dialog-input" className="text-xs">
          {request.label}
        </Label>
        <Input id="name-dialog-input" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
      </div>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!name.trim()}>
          {request.confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }): ReactNode {
  const shown = useLastRequest(request);
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{shown?.title}</DialogTitle>
          <DialogDescription>{shown?.description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              shown?.onConfirm();
              onClose();
            }}
          >
            {shown?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// An incoming profile (import or builder) waiting for "Save as a new profile" or "Replace current profile".
export interface IncomingProfile {
  profile: Profile;
  currentName: string;
  suggestedName: string;
}

export function IncomingChoice({ incoming, onSave }: { incoming: IncomingProfile; onSave: (profile: Profile, options: { mode: 'new' | 'replace'; name?: string }) => Promise<void> }): ReactNode {
  const [name, setName] = useState(incoming.suggestedName);
  const { profile, currentName } = incoming;
  return (
    <>
      <DialogHeader>
        <DialogTitle>Use "{profile.name}"?</DialogTitle>
        <DialogDescription>
          Your active profile is "{currentName}". Either way the new profile becomes active and your agenda stays as it is.
        </DialogDescription>
      </DialogHeader>
      <form
        className="space-y-2 rounded-lg border p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) void onSave(profile, { mode: 'new', name });
        }}
      >
        <Label htmlFor="incoming-profile-name" className="text-sm font-medium">
          Save as a new profile
        </Label>
        <div className="flex gap-2">
          <Input id="incoming-profile-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus className="h-8" />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            Save as new
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">"{currentName}" stays in your library.</p>
      </form>
      <div className="space-y-2 rounded-lg border border-destructive/30 p-3">
        <div className="text-sm font-medium">Replace current profile</div>
        <p className="text-xs text-muted-foreground">
          "{currentName}" gets the new content. The old version is kept in your library as "{currentName} (previous)".
        </p>
        <Button size="sm" variant="destructive" onClick={() => void onSave(profile, { mode: 'replace' })}>
          Replace "{currentName}"
        </Button>
      </div>
    </>
  );
}
