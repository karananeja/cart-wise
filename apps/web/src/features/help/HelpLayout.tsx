import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { cn } from 'cn';

export const HELP_TOPICS = [
  { to: '/help/delivery', label: 'Delivery' },
  { to: '/help/returns', label: 'Returns & refunds' },
  { to: '/help/payments', label: 'Payments & EMI' },
] as const;

/** Shared frame for the three help pages (F-018 FR-2): a title, a short intro and links between the topics. */
export function HelpLayout({ title, intro, children }: { title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <nav aria-label="Help topics" className="-mx-1 flex flex-wrap gap-1 text-sm">
        {HELP_TOPICS.map((topic) => (
          <NavLink
            key={topic.to}
            to={topic.to}
            className={({ isActive }) =>
              cn('rounded-full px-3 py-1.5 transition-colors hover:bg-muted', isActive ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground')
            }
          >
            {topic.label}
          </NavLink>
        ))}
      </nav>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        <p className="text-muted-foreground">{intro}</p>
      </div>
      <div className="flex flex-col gap-8 text-sm leading-relaxed sm:text-base [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
        {children}
      </div>
    </div>
  );
}
