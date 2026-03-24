'use client';

import { useCallback, useRef, useState } from 'react';
import { Upload, FileText, Image, FileSpreadsheet, File, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';

interface EvidenceDropZoneProps {
  onUpload: (file: File) => Promise<void>;
  className?: string;
  compact?: boolean;
}

function fileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['pdf'].includes(ext)) return FileText;
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return Image;
  if (['csv', 'xlsx', 'xls'].includes(ext)) return FileSpreadsheet;
  return File;
}

export function EvidenceDropZone({ onUpload, className, compact }: EvidenceDropZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setUploading(true);
    setProgress(0);
    setDone(false);

    const tick = setInterval(() => {
      setProgress((p) => Math.min(p + 15, 90));
    }, 120);

    try {
      await onUpload(file);
      clearInterval(tick);
      setProgress(100);
      setDone(true);
      toast.success(`"${file.name}" uploaded`);
      setTimeout(() => {
        setUploading(false);
        setProgress(0);
        setDone(false);
      }, 1800);
    } catch (err) {
      clearInterval(tick);
      setUploading(false);
      setProgress(0);
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    }
  }, [onUpload]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  if (uploading) {
    const Icon = done ? CheckCircle2 : Upload;
    return (
      <div className={cn('rounded-lg border border-border bg-card p-4', className)}>
        <div className="flex items-center gap-3">
          <Icon size={18} className={cn(done ? 'text-success' : 'text-muted-foreground animate-pulse')} />
          <div className="flex-1">
            <Progress value={progress} className="h-2" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{progress}%</span>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <>
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => inputRef.current?.click()}
        >
          <Upload size={14} />
          Upload
        </Button>
        <input ref={inputRef} type="file" className="hidden" onChange={onSelect} aria-label="Upload evidence file" />
      </>
    );
  }

  return (
    <div
      className={cn(
        'group relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors',
        dragOver
          ? 'border-primary bg-primary/5'
          : 'border-border hover:border-primary/40 hover:bg-muted/30',
        className,
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      <Upload size={24} className="text-muted-foreground group-hover:text-primary transition-colors" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">
        Drag &amp; drop evidence file, or{' '}
        <button
          type="button"
          className="font-medium text-primary underline-offset-4 hover:underline"
          onClick={() => inputRef.current?.click()}
        >
          browse
        </button>
      </p>
      <p className="text-xs text-muted-foreground/60">PDF, screenshots, config exports, logs, scan results</p>
      <input ref={inputRef} type="file" className="hidden" onChange={onSelect} aria-label="Upload evidence file" />
    </div>
  );
}
