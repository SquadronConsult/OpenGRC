'use client';

import { CheckCircle2, AlertTriangle, XCircle, Circle, Clock, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ComplianceStatus =
  | 'compliant'
  | 'in_progress'
  | 'non_compliant'
  | 'not_started'
  | 'overdue'
  | 'not_applicable';

const config: Record<
  ComplianceStatus,
  { icon: typeof CheckCircle2; label: string; className: string }
> = {
  compliant: {
    icon: CheckCircle2,
    label: 'Compliant',
    className: 'bg-success/10 text-success border-success/20',
  },
  in_progress: {
    icon: Clock,
    label: 'In Progress',
    className: 'bg-primary/10 text-primary border-primary/20',
  },
  non_compliant: {
    icon: XCircle,
    label: 'Non-Compliant',
    className: 'bg-destructive/10 text-destructive border-destructive/20',
  },
  not_started: {
    icon: Circle,
    label: 'Not Started',
    className: 'bg-muted text-muted-foreground border-border',
  },
  overdue: {
    icon: AlertTriangle,
    label: 'Overdue',
    className: 'bg-warning/10 text-warning border-warning/20',
  },
  not_applicable: {
    icon: Minus,
    label: 'N/A',
    className: 'bg-muted text-muted-foreground border-border',
  },
};

interface StatusBadgeProps {
  status: ComplianceStatus;
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusBadge({ status, size = 'sm', className }: StatusBadgeProps) {
  const { icon: Icon, label, className: statusClass } = config[status] ?? config.not_started;
  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-wide',
        size === 'sm' ? 'px-2 py-0.5 text-[0.625rem]' : 'px-2.5 py-1 text-xs',
        statusClass,
        className,
      )}
    >
      <Icon size={iconSize} aria-hidden="true" />
      {label}
    </span>
  );
}
