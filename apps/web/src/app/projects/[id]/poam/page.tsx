'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Download,
  AlertTriangle,
  Clock,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, getApiBase, getToken } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { DeadlineChip } from '@/components/compliance/DeadlineChip';
import { EmptyState } from '@/components/compliance/EmptyState';

type PoamRow = {
  poamId: string;
  weaknessName: string;
  weaknessDescription: string;
  weaknessDetectorSource: string;
  weaknessSourceIdentifier: string;
  resourcesAffected: string;
  originalRiskRating: 'Low' | 'Moderate' | 'High';
  adjustedRiskRating: 'Low' | 'Moderate' | 'High';
  riskAdjustment: 'No' | 'Pending' | 'Yes';
  falsePositive: 'No' | 'Pending' | 'Yes';
  operationalRequirement: 'No' | 'Pending' | 'Yes';
  vendorDependency: 'No' | 'Yes';
  lastVendorCheckinDate: string | null;
  vendorDependentProductName: string | null;
  status: string;
  discoveryDate: string;
  statusDate: string;
  plannedMilestone: string;
  plannedMilestoneDate: string | null;
  scheduledCompletionDate: string | null;
  comments: string;
  evidenceReferences: string[];
  source: string;
};

type PoamResponse = {
  project: {
    id: string;
    name: string;
    pathType: string;
    impactLevel: string;
  };
  generatedAt: string;
  totalRows: number;
  rows: PoamRow[];
};

function riskBadge(rating: string) {
  if (rating === 'High') return <Badge variant="destructive">{rating}</Badge>;
  if (rating === 'Moderate') return <Badge variant="secondary">{rating}</Badge>;
  return <Badge variant="outline">{rating}</Badge>;
}

const sevBarClass = (s: string) =>
  s === 'High'
    ? 'bg-destructive'
    : s === 'Moderate'
      ? 'bg-warning'
      : 'bg-success';

export default function ProjectPoamPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const router = useRouter();
  const [data, setData] = useState<PoamResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const res = await api<PoamResponse>(`/projects/${id}/poam`);
      setData(res);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load POA&M');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const summary = useMemo(() => {
    const rows = data?.rows || [];
    return {
      total: rows.length,
      high: rows.filter((r) => r.adjustedRiskRating === 'High').length,
      moderate: rows.filter((r) => r.adjustedRiskRating === 'Moderate').length,
      low: rows.filter((r) => r.adjustedRiskRating === 'Low').length,
    };
  }, [data]);

  const gantt = useMemo(() => {
    const rows = (data?.rows || [])
      .map((row) => {
        const completion = row.scheduledCompletionDate
          ? new Date(`${row.scheduledCompletionDate}T00:00:00`)
          : null;
        const milestone = row.plannedMilestoneDate
          ? new Date(`${row.plannedMilestoneDate}T00:00:00`)
          : completion
            ? new Date(completion.getTime() - 14 * 24 * 60 * 60 * 1000)
            : null;
        if (!milestone && !completion) return null;
        const start = milestone || completion;
        const end = completion || milestone;
        if (!start || !end) return null;
        return { ...row, start, end };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    const visibleRows = rows.slice(0, 40);
    if (!visibleRows.length) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const min = new Date(
      Math.min(...visibleRows.map((r) => r.start.getTime()), now.getTime()),
    );
    const max = new Date(
      Math.max(...visibleRows.map((r) => r.end.getTime()), now.getTime()),
    );
    const totalDays = Math.max(
      1,
      Math.ceil((max.getTime() - min.getTime()) / (24 * 60 * 60 * 1000)),
    );

    function pct(date: Date) {
      return (
        ((date.getTime() - min.getTime()) / (24 * 60 * 60 * 1000) / totalDays) *
        100
      );
    }

    return {
      min,
      max,
      totalDays,
      rows: visibleRows.map((r) => ({
        ...r,
        leftPct: pct(r.start),
        widthPct: Math.max(1.5, pct(r.end) - pct(r.start)),
      })),
      nowPct: pct(now),
      hiddenCount: Math.max(0, rows.length - visibleRows.length),
    };
  }, [data]);

  async function exportPoam(format: 'csv' | 'md' | 'json') {
    try {
      const token = getToken();
      const res = await fetch(
        `${getApiBase()}/projects/${id}/poam?format=${format}`,
        {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        },
      );
      if (!res.ok) throw new Error((await res.text()) || 'Export failed');

      const extension = format === 'md' ? 'md' : format;
      const content = await res.text();
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `poam-${id}.${extension}`;
      a.click();
      toast.success(`Exported as ${extension.toUpperCase()}`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Export failed');
    }
  }

  const tabRoutes: Record<string, string> = {
    checklist: `/projects/${id}`,
    'auto-scope': `/projects/${id}/auto-scope`,
    poam: `/projects/${id}/poam`,
    risk: `/projects/${id}/risk`,
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="size-4" />
        Projects
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Plan of Action &amp; Milestones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Auto-generated from open checklist weaknesses. Export for government
            handoff.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => exportPoam('csv')}>
            <Download className="size-3.5" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportPoam('md')}>
            <FileText className="size-3.5" />
            Markdown
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportPoam('json')}
          >
            <Download className="size-3.5" />
            JSON
          </Button>
        </div>
      </div>

      {/* Tab bar */}
      <Tabs
        value="poam"
        onValueChange={(val) => {
          const dest = tabRoutes[val];
          if (dest) router.push(dest);
        }}
      >
        <TabsList>
          <TabsTrigger value="checklist">Checklist</TabsTrigger>
          <TabsTrigger value="auto-scope">Auto-Scope</TabsTrigger>
          <TabsTrigger value="poam">POA&amp;M</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Loading skeletons */}
      {loading && (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="py-0">
                <CardContent className="flex flex-col items-center gap-1 py-4">
                  <Skeleton className="h-8 w-12" />
                  <Skeleton className="mt-1 h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="py-0">
            <CardContent className="space-y-3 py-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </CardContent>
          </Card>
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </>
      )}

      {/* Summary stats */}
      {!loading && data && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Card className="py-0">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold">{summary.total}</span>
              <span className="text-xs text-muted-foreground">Total Items</span>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold text-destructive">
                {summary.high}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <AlertTriangle className="size-3" aria-hidden="true" />
                High
              </span>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold text-warning">
                {summary.moderate}
              </span>
              <span className="text-xs text-muted-foreground">Moderate</span>
            </CardContent>
          </Card>
          <Card className="py-0">
            <CardContent className="flex flex-col items-center gap-1 py-4">
              <span className="text-2xl font-bold text-success">
                {summary.low}
              </span>
              <span className="text-xs text-muted-foreground">Low</span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gantt timeline */}
      {!loading && gantt && (
        <Card className="py-0">
          <CardHeader className="flex-row items-center justify-between border-b py-3">
            <CardTitle className="inline-flex items-center gap-2 text-base">
              <Clock className="size-4 text-muted-foreground" />
              Timeline
            </CardTitle>
            <div className="flex items-center gap-1.5">
              <Badge variant="destructive">High</Badge>
              <Badge variant="secondary">Moderate</Badge>
              <Badge variant="outline">Low</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-b-xl bg-background" role="img" aria-label="POA&amp;M timeline showing weakness remediation schedule">
              {/* Header row */}
              <div className="grid grid-cols-[220px_1fr] border-b bg-muted/50 px-3 py-2 text-[0.68rem] font-bold uppercase tracking-wider text-muted-foreground">
                <div>Weakness</div>
                <div className="relative">
                  <span>{gantt.min.toISOString().slice(0, 10)}</span>
                  <span className="absolute right-0 top-0">
                    {gantt.max.toISOString().slice(0, 10)}
                  </span>
                </div>
              </div>

              {/* Data rows */}
              {gantt.rows.map((row) => (
                <div
                  key={row.poamId}
                  className="grid grid-cols-[220px_1fr] items-center border-b px-3 py-1.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-foreground">
                      {row.poamId} &middot; {row.weaknessSourceIdentifier}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {row.weaknessName}
                    </div>
                  </div>
                  <div className="relative h-[18px] overflow-hidden rounded-full bg-muted/30">
                    <div
                      className={cn(
                        'absolute top-[3px] bottom-[3px] rounded-full opacity-85',
                        sevBarClass(row.adjustedRiskRating),
                      )}
                      style={{
                        left: `${row.leftPct}%`,
                        width: `${row.widthPct}%`,
                      }}
                      title={`${row.plannedMilestoneDate || '?'} → ${row.scheduledCompletionDate || '?'}`}
                    />
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-primary opacity-90"
                      style={{ left: `${gantt.nowPct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {gantt.hiddenCount > 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                Showing top 40 by nearest completion ({gantt.hiddenCount} more
                below).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!loading && (!data || data.rows.length === 0) && (
        <EmptyState
          icon={FileText}
          title="No POA&M items"
          description="Items appear for non-compliant or incomplete controls."
        />
      )}

      {/* POA&M table */}
      {!loading && data && data.rows.length > 0 && (
        <>
          <p className="text-xs text-muted-foreground">
            FedRAMP-style Open POA&amp;M view (RA/FP/OR/VD columns included for
            reviewer workflow).
          </p>
          <ScrollArea className="w-full">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">ID</TableHead>
                  <TableHead className="w-[165px]">
                    Weakness Source ID
                  </TableHead>
                  <TableHead className="w-[200px]">Weakness Name</TableHead>
                  <TableHead className="w-[160px]">Detector Source</TableHead>
                  <TableHead className="w-[105px]">Orig Risk</TableHead>
                  <TableHead className="w-[105px]">Adj Risk</TableHead>
                  <TableHead className="w-[70px]">RA</TableHead>
                  <TableHead className="w-[70px]">FP</TableHead>
                  <TableHead className="w-[70px]">OR</TableHead>
                  <TableHead className="w-[70px]">VD</TableHead>
                  <TableHead className="w-[110px]">Status</TableHead>
                  <TableHead className="w-[120px]">Discovery</TableHead>
                  <TableHead className="w-[120px]">Milestone</TableHead>
                  <TableHead className="w-[120px]">Completion</TableHead>
                  <TableHead className="w-[160px]">
                    Evidence References
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rows.map((row) => (
                  <TableRow key={row.poamId}>
                    <TableCell className="font-semibold">
                      {row.poamId}
                    </TableCell>
                    <TableCell>
                      <Badge>{row.weaknessSourceIdentifier}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm font-medium">
                        {row.weaknessName}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.weaknessDetectorSource}
                    </TableCell>
                    <TableCell>{riskBadge(row.originalRiskRating)}</TableCell>
                    <TableCell>{riskBadge(row.adjustedRiskRating)}</TableCell>
                    <TableCell className="text-sm">
                      {row.riskAdjustment}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.falsePositive}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.operationalRequirement}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.vendorDependency}
                    </TableCell>
                    <TableCell className="text-sm">{row.status}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.discoveryDate || '\u2014'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.plannedMilestoneDate || '\u2014'}
                    </TableCell>
                    <TableCell>
                      {row.scheduledCompletionDate ? (
                        <DeadlineChip dueDate={row.scheduledCompletionDate} />
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {'\u2014'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.evidenceReferences?.length
                        ? row.evidenceReferences.join(', ')
                        : '\u2014'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </>
      )}
    </div>
  );
}
