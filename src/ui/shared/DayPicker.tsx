import type { ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { DAYS, type DayId } from '@/core/types';
import { dayShort } from '../format';

interface DayPickerProps {
  value: DayId;
  onChange: (day: DayId) => void;
  options?: DayId[]; // defaults to all conference days
  short?: boolean; // "Mon" instead of "Mon Nov 30"
}

export function DayPicker({ value, onChange, options, short = false }: DayPickerProps): ReactNode {
  const days = options ? DAYS.filter((d) => options.includes(d.id)) : DAYS;
  return (
    <ToggleGroup type="single" variant="outline" size="sm" value={value} onValueChange={(day: string) => day && onChange(day as DayId)}>
      {days.map((d) => (
        <ToggleGroupItem key={d.id} value={d.id} className="px-2.5 text-xs" title={d.label}>
          {short ? dayShort(d.id) : d.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
