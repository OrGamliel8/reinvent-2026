import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAYS, type DayId } from '@/core/types';

export function DayPicker({ value, onChange }: { value: DayId; onChange: (day: DayId) => void }): ReactNode {
  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(day: string) => day && onChange(day as DayId)}>
      {DAYS.map((d) => (
        <ToggleGroupItem key={d.id} value={d.id} className="px-2.5 text-xs">
          {d.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
