import { useState, type ReactNode } from 'react';
import { MonitorSmartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Covers the app while another tab owns the saved plan; "Use here" takes it back.
export function InactiveTabOverlay({ onUseHere }: { onUseHere: () => Promise<void> }): ReactNode {
  const [pending, setPending] = useState(false);

  const useHere = async (): Promise<void> => {
    setPending(true);
    try {
      await onUseHere();
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div role="alertdialog" aria-modal="true" aria-labelledby="inactive-tab-title" className="w-full max-w-sm rounded-lg border bg-card p-6 text-center shadow-lg">
        <MonitorSmartphone className="mx-auto size-8 text-muted-foreground" />
        <h2 id="inactive-tab-title" className="mt-3 text-base font-semibold">
          The planner is open in another tab.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Changes are saved there.</p>
        <Button className="mt-5" autoFocus disabled={pending} onClick={() => void useHere()}>
          {pending ? 'Switching…' : 'Use here'}
        </Button>
      </div>
    </div>
  );
}
