'use client';

import { useState } from 'react';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { StatusBadge, type ComplianceStatus } from './StatusBadge';
import { DeadlineChip } from './DeadlineChip';

interface ControlRowProps {
  controlRef: string;
  name: string;
  status: ComplianceStatus;
  owner?: string;
  dueDate?: string;
  evidenceCount?: number;
  children?: React.ReactNode;
  onOpenDetail?: () => void;
  className?: string;
}

export function ControlRow({
  controlRef,
  name,
  status,
  owner,
  dueDate,
  evidenceCount = 0,
  children,
  onOpenDetail,
  className,
}: ControlRowProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className={cn('group', className)}>
      <CollapsibleTrigger asChild>
        <div
          className={cn(
            'flex cursor-pointer items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-accent',
            open && 'bg-accent/50',
          )}
        >
          <ChevronRight
            size={14}
            className={cn(
              'shrink-0 text-muted-foreground transition-transform duration-150',
              open && 'rotate-90',
            )}
          />
          <StatusBadge status={status} />
          <span className="min-w-[4.5rem] shrink-0 text-xs font-mono text-muted-foreground">
            {controlRef}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm text-foreground">{name}</span>
          {owner && (
            <span className="hidden text-xs text-muted-foreground md:inline">{owner}</span>
          )}
          {dueDate && <DeadlineChip dueDate={dueDate} />}
          <span className="shrink-0 text-[0.65rem] tabular-nums text-muted-foreground">
            {evidenceCount} files
          </span>
          {onOpenDetail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenDetail();
              }}
              className="ml-1 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              aria-label="Open detail"
            >
              <ExternalLink size={13} />
            </button>
          )}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden transition-all duration-150 ease-out data-[state=closed]:animate-out data-[state=open]:animate-in data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
        <div className="border-b border-border bg-card/50 px-8 py-4">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
