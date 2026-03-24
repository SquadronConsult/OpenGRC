'use client';

import { cn } from '@/lib/utils';

interface ReadinessGaugeProps {
  value: number;
  size?: number;
  className?: string;
}

export function ReadinessGauge({ value, size = 160, className }: ReadinessGaugeProps) {
  const pct = Math.min(100, Math.max(0, value));
  /** Arc fill must match the numeric label: at 0% readiness the ring stays empty (do not force a 10% minimum). */
  const arcPct = pct;
  const strokeWidth = size * 0.07;
  const radius = (size - strokeWidth * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (arcPct / 100) * circumference;

  const remaining = 100 - Math.round(pct);
  const useRemaining = pct >= 70;

  let strokeColor = 'text-primary';
  if (pct >= 80) strokeColor = 'text-success';
  else if (pct >= 50) strokeColor = 'text-primary';
  else if (pct >= 25) strokeColor = 'text-warning';
  else strokeColor = 'text-destructive';

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Readiness: ${Math.round(pct)}%`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn(strokeColor, 'transition-[stroke-dashoffset] duration-1000 ease-out')}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold tabular-nums text-foreground">
          {useRemaining ? `${remaining}%` : `${Math.round(pct)}%`}
        </span>
        <span className="text-[0.65rem] text-muted-foreground">
          {useRemaining ? 'remaining' : 'readiness'}
        </span>
      </div>
    </div>
  );
}
