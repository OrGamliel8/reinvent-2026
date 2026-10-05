import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { MatchExplanation } from '@/core/types';

interface Chip {
  label: string;
  tone: 'interest' | 'tag' | 'format' | 'avoid' | 'level';
}

// A short "why this matches": strongest interests, then tags, then format and level hints.
export function matchChips(explanation: MatchExplanation, max = 3): Chip[] {
  const chips: Chip[] = [];
  for (const reason of explanation.avoided) chips.push({ label: `avoid: ${reason}`, tone: 'avoid' });
  const interests = [...explanation.interests].filter((i) => i.contribution > 0).sort((a, b) => b.contribution - a.contribution);
  for (const interest of interests) chips.push({ label: interest.label, tone: 'interest' });
  const tags = [...explanation.tags].sort((a, b) => b.weight - a.weight);
  for (const tag of tags) chips.push({ label: tag.name, tone: 'tag' });
  if (!explanation.format.recorded && explanation.format.contribution > 0) chips.push({ label: 'not recorded', tone: 'format' });
  if (explanation.level.fit === 'below' || explanation.level.fit === 'above') chips.push({ label: `level ${explanation.level.fit}`, tone: 'level' });
  return chips.slice(0, max);
}

const TONE: Record<Chip['tone'], string> = {
  interest: 'bg-primary/10 text-primary',
  tag: 'bg-secondary text-secondary-foreground',
  format: 'bg-success/15 text-success',
  avoid: 'bg-destructive/15 text-destructive',
  level: 'bg-warning/20 text-warning',
};

export function MatchChips({ explanation, max = 3, className }: { explanation: MatchExplanation; max?: number; className?: string }): ReactNode {
  const chips = matchChips(explanation, max);
  if (chips.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {chips.map((chip) => (
        <span key={chip.tone + chip.label} className={cn('max-w-40 truncate rounded px-1.5 py-px text-[11px] leading-4', TONE[chip.tone])}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
