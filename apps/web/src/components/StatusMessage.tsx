import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatusMessageProps {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

/** Shared layout for empty, error, offline and not-found states. */
export function StatusMessage({ icon, title, description, actions, className }: StatusMessageProps) {
  return (
    <div className={cn('mx-auto flex max-w-md flex-col items-center gap-3 py-16 text-center', className)}>
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-6" aria-hidden>
        {icon}
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {description && <div className="text-sm text-muted-foreground">{description}</div>}
      {actions && <div className="mt-2 flex flex-wrap justify-center gap-2">{actions}</div>}
    </div>
  );
}
