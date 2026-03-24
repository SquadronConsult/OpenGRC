'use client';

import { useEffect, useState } from 'react';
import { Activity, Database, FolderArchive, HardDrive, Server, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getApiBase } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

type OpsPayload = {
  apiVersion?: string;
  schemaVersion?: string;
  dbType?: string;
  sqlitePath?: string;
  sqliteBytes?: number | null;
  evidenceDir?: string;
  localDataDir?: string;
  frmrLoaded?: boolean;
  frmrRelease?: string | null;
  frmrVersionRows?: number;
  dbSync?: boolean;
  migrationsRun?: boolean;
};

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium">
      <span
        className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-destructive'}`}
        aria-hidden="true"
      />
      {ok ? 'Online' : 'Unavailable'}
    </span>
  );
}

function OpsCard({
  icon: Icon,
  title,
  status,
  children,
}: {
  icon: React.ElementType;
  title: string;
  status?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
            <Icon className="size-4 text-primary" />
          </div>
          <CardTitle className="text-sm">{title}</CardTitle>
        </div>
        {status !== undefined && <StatusDot ok={status} />}
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{children}</CardContent>
    </Card>
  );
}

export default function LocalOpsPage() {
  const [data, setData] = useState<OpsPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${getApiBase()}/health/ops`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then(setData)
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load /health/ops');
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Operations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Diagnostics: API version, data paths, FRMR state, and database mode. Use{' '}
            <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">
              POST /health/backup
            </code>{' '}
            (authenticated) for SQLite snapshots.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="mt-2 h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <OpsCard icon={Server} title="API Version" status={!!data.apiVersion}>
            <p>
              {data.apiVersion ?? '—'} / schema {data.schemaVersion ?? '—'}
            </p>
          </OpsCard>

          <OpsCard icon={Database} title="Database" status={!!data.dbType}>
            <p>
              {data.dbType}
              {data.dbSync ? ' · synchronize on' : ' · synchronize off'}
              {data.migrationsRun ? ' · migrations run' : ''}
            </p>
          </OpsCard>

          <OpsCard icon={HardDrive} title="SQLite Path">
            <p className="break-all">{data.sqlitePath ?? '—'}</p>
            <p className="mt-1">
              Size:{' '}
              {data.sqliteBytes != null
                ? `${(data.sqliteBytes / 1024).toFixed(1)} KB`
                : '—'}
            </p>
          </OpsCard>

          <OpsCard icon={FolderArchive} title="Evidence Dir">
            <p className="break-all">{data.evidenceDir ?? '—'}</p>
          </OpsCard>

          <OpsCard icon={FolderArchive} title="LOCAL_DATA_DIR">
            <p className="break-all">{data.localDataDir ?? '—'}</p>
          </OpsCard>

          <OpsCard
            icon={FileText}
            title="FRMR"
            status={!!data.frmrLoaded}
          >
            <p>
              {data.frmrLoaded
                ? `Loaded (${data.frmrRelease || 'unknown release'})`
                : 'Not loaded'}
              {data.frmrVersionRows != null
                ? ` · ${data.frmrVersionRows} version row(s)`
                : ''}
            </p>
          </OpsCard>
        </div>
      ) : null}
    </div>
  );
}
