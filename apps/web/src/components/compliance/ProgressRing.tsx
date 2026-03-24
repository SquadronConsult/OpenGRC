'use client';

import { cn } from '@/lib/utils';

interface ProgressRingProps {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  showLabel?: boolean;
  total?: number;
}

export function ProgressRing({
  value,
  size = 48,
  strokeWidth = 4,
  className,
  showLabel = true,
  total,
}: ProgressRingProps) {
  const pct = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;

  const remaining = total != null ? total - Math.round((pct / 100) * total) : null;
  const useRemaining = pct >= 70 && remaining != null;

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Progress: ${Math.round(pct)}%`}>
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
          className="text-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      {showLabel && (
        <span className="absolute text-xs font-bold tabular-nums text-foreground">
          {useRemaining ? `${remaining}` : `${Math.round(pct)}%`}
        </span>
      )}
    </div>
  );
}
