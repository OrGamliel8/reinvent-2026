import type { ReactNode } from 'react';
import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePlanner } from '../PlannerProvider';

export function StarButton({ sessionKey, starred }: { sessionKey: string; starred: boolean }): ReactNode {
  const { mutate } = usePlanner();
  const toggle = (): void => {
    void mutate((api) => (starred ? api.unstar(sessionKey) : api.star(sessionKey)));
  };
  return (
    <Button variant="ghost" size="icon-xs" onClick={toggle} aria-label={starred ? 'Unstar' : 'Star'} aria-pressed={starred}>
      <Star className={cn(starred ? 'fill-warning text-warning' : 'text-muted-foreground')} />
    </Button>
  );
}
