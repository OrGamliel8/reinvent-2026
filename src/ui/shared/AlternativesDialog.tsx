import type { ReactNode } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { usePlannerQuery } from '../PlannerProvider';
import { useUi, type AlternativesRequest } from '../UiState';
import { AlternativesList } from './AlternativesList';

export function AlternativesDialog(): ReactNode {
  const { alternatives, openAlternatives } = useUi();
  return (
    <Dialog open={alternatives !== null} onOpenChange={(open) => !open && openAlternatives(null)}>
      <DialogContent className="sm:max-w-2xl">
        {alternatives && <AlternativesBody request={alternatives} onDone={() => openAlternatives(null)} />}
      </DialogContent>
    </Dialog>
  );
}

function AlternativesBody({ request, onDone }: { request: AlternativesRequest; onDone: () => void }): ReactNode {
  const refKey = JSON.stringify(request.ref);
  const { data, loading, error } = usePlannerQuery((api) => api.alternatives(request.ref), [refKey]);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Alternatives</DialogTitle>
        <DialogDescription>{request.title}</DialogDescription>
      </DialogHeader>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {loading && !data ? (
        <p className="text-sm text-muted-foreground">Looking for alternatives…</p>
      ) : (
        <div className="max-h-[60vh] overflow-y-auto">
          <AlternativesList alternatives={data ?? []} replaceItemId={request.replaceItemId} onDone={onDone} />
        </div>
      )}
    </>
  );
}
