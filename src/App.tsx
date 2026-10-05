import type { ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { PlannerProvider } from '@/ui/PlannerProvider';
import { UiProvider } from '@/ui/UiState';
import { AppShell } from '@/ui/AppShell';
import { ThemeProvider } from '@/ui/ThemeToggle';

export default function App(): ReactNode {
  return (
    <TooltipProvider delayDuration={300}>
      <PlannerProvider>
        <ThemeProvider>
          <UiProvider>
            <AppShell />
          </UiProvider>
        </ThemeProvider>
      </PlannerProvider>
      <Toaster position="bottom-right" />
    </TooltipProvider>
  );
}
