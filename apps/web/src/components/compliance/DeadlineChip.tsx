'use client';

import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeadlineChipProps {
  dueDate: string;
  className?: string;
}

export function DeadlineChip({ dueDate, className }: DeadlineChipProps) {
  const now = new Date();
  const due = new Date(dueDate);
  const diffMs = due.getTime() - now.getTime();
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  let label: string;
  let colorClass: string;

  if (days < 0) {
    label = `${Math.abs(days)}d overdue`;
    colorClass = 'bg-destructive/10 text-destructive border-destructive/20';
  } else if (days <= 3) {
    label = days === 0 ? 'Due today' : `${days}d left`;
    colorClass = 'bg-destructive/10 text-destructive border-destructive/20';
  } else if (days <= 14) {
    label = `${days}d left`;
    colorClass = 'bg-warning/10 text-warning border-warning/20';
  } else {
    label = `${days}d left`;
    colorClass = 'bg-muted text-muted-foreground border-border';
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[0.625rem] font-semibold tabular-nums',
        colorClass,
        className,
      )}
    >
      <Clock size={10} aria-hidden="true" />
      {label}
    </span>
  );
}
