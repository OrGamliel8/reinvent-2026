import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import type { ValidationError } from '@/core/types';

export function ValidationErrors({ errors, title }: { errors: ValidationError[]; title: string }): ReactNode {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <div className="flex items-center gap-2 font-medium text-destructive">
        <CircleAlert className="size-4" /> {title}
      </div>
      <ul className="mt-2 space-y-1">
        {errors.map((e, i) => (
          <li key={i} className="text-xs">
            <code className="rounded bg-destructive/10 px-1 font-mono text-destructive">{e.path || '(root)'}</code> <span>{e.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
