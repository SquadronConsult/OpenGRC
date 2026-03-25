'use client';

import { useEffect, useState } from 'react';
import { Target, X } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'grc-micro-goal';
const DEFAULT_TARGET = 3;

interface GoalState {
  date: string;
  completed: number;
  target: number;
  dismissed: boolean;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadGoal(): GoalState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GoalState;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch { /* ignore */ }
  return { date: todayKey(), completed: 0, target: DEFAULT_TARGET, dismissed: false };
}

function saveGoal(state: GoalState) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function incrementMicroGoal() {
  const goal = loadGoal();
  goal.completed = Math.min(goal.completed + 1, goal.target);
  saveGoal(goal);
  window.dispatchEvent(new Event('micro-goal-update'));
}

interface MicroGoalBannerProps {
  className?: string;
}

export function MicroGoalBanner({ className }: MicroGoalBannerProps) {
  const [goal, setGoal] = useState<GoalState | null>(null);

  useEffect(() => {
    setGoal(loadGoal());
    const handler = () => setGoal(loadGoal());
    window.addEventListener('micro-goal-update', handler);
    return () => window.removeEventListener('micro-goal-update', handler);
  }, []);

  if (!goal || goal.dismissed || goal.completed >= goal.target) return null;

  const pct = (goal.completed / goal.target) * 100;

  return (
    <div
      className={cn(
        'flex items-center gap-3 border-b border-border bg-primary/5 px-4 py-2',
        className,
      )}
    >
      <Target size={14} className="shrink-0 text-primary" aria-hidden="true" />
      <span className="text-xs text-foreground">
        Complete <strong>{goal.target - goal.completed}</strong> control validations today
      </span>
      <Progress value={pct} className="h-1.5 max-w-[120px] flex-1" />
      <span className="text-[0.65rem] tabular-nums text-muted-foreground">
        {goal.completed}/{goal.target}
      </span>
      <button
        onClick={() => {
          const updated = { ...goal, dismissed: true };
          saveGoal(updated);
          setGoal(updated);
        }}
        className="ml-auto rounded-[4px] p-1 text-muted-foreground hover:text-foreground"
        aria-label="Dismiss goal banner"
      >
        <X size={12} />
      </button>
    </div>
  );
}
