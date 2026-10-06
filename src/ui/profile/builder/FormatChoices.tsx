import type { ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { FormatChoice } from '@/core/types';

const CHOICES: { value: FormatChoice; label: string }[] = [
  { value: 'prefer', label: 'Prefer' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'avoid', label: 'Avoid' },
];

interface FormatChoicesProps {
  types: string[];
  recorded: Record<string, boolean>;
  value: Record<string, FormatChoice>;
  onChange: (v: Record<string, FormatChoice>) => void;
}

export function FormatChoices({ types, recorded, value, onChange }: FormatChoicesProps): ReactNode {
  return (
    <div className="divide-y rounded-md border">
      {types.map((type) => (
        <div key={type} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-1.5">
          <span className="min-w-36 flex-1 text-sm">
            {type}
            {recorded[type] && (
              <Badge variant="secondary" className="ml-2 align-middle text-[0.65rem]">
                recorded
              </Badge>
            )}
          </span>
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            value={value[type] ?? 'neutral'}
            onValueChange={(choice: string) => choice && onChange({ ...value, [type]: choice as FormatChoice })}
            aria-label={`${type} preference`}
          >
            {CHOICES.map((c) => (
              <ToggleGroupItem key={c.value} value={c.value} className="px-2.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                {c.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ))}
    </div>
  );
}
