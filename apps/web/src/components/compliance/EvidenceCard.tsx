'use client';

import { FileText, Image, FileJson, FileSpreadsheet, File, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusBadge, type ComplianceStatus } from './StatusBadge';

const fileIcons: Record<string, typeof FileText> = {
  pdf: FileText,
  png: Image,
  jpg: Image,
  jpeg: Image,
  json: FileJson,
  csv: FileSpreadsheet,
};

interface EvidenceCardProps {
  id: string;
  filename: string;
  artifactType?: string;
  uploadedAt?: string;
  reviewStatus?: ComplianceStatus;
  onDelete?: (id: string) => void;
  className?: string;
}

export function EvidenceCard({
  id,
  filename,
  artifactType,
  uploadedAt,
  reviewStatus,
  onDelete,
  className,
}: EvidenceCardProps) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const Icon = fileIcons[ext] ?? File;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-[4px] border border-border bg-card p-2.5 transition-colors hover:border-primary/30',
        className,
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[4px] bg-muted">
        <Icon size={16} className="text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{filename}</p>
        <div className="flex items-center gap-2 text-[0.7rem] text-muted-foreground">
          {artifactType && <span>{artifactType}</span>}
          {uploadedAt && (
            <span>
              {new Date(uploadedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}
        </div>
      </div>

      {reviewStatus && <StatusBadge status={reviewStatus} size="sm" />}

      {onDelete && (
        <button
          onClick={() => onDelete(id)}
          className="ml-1 rounded-[4px] p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete ${filename}`}
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
