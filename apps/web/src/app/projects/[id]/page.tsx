'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import {
  ChevronLeft,
  Search,
  Download,
  Upload,
  AlertTriangle,
  PlugZap,
  FileText,
  Lightbulb,
} from 'lucide-react';
import { api, getApiBase, getToken, listItems, type PaginatedList } from '@/lib/api';
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
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ProgressRing } from '@/components/compliance/ProgressRing';
import { EmptyState } from '@/components/compliance/EmptyState';

type Item = {
  id: string;
  status: string;
  dueDate: string | null;
  reviewState: string | null;
  frrRequirement?: {
    processId: string;
    reqKey: string;
    statement: string;
    primaryKeyWord: string;
  };
  ksiIndicator?: {
    indicatorId: string;
    statement: string;
    controls: string[];
  };
  catalogRequirement?: {
    requirementCode: string;
    kind: string;
    frameworkRelease?: {
      releaseCode: string;
      framework?: { code: string; name: string };
    };
  } | null;
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  compliant: 'Compliant',
  non_compliant: 'Non-Compliant',
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [items, setItems] = useState<Item[] | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [connBanner, setConnBanner] = useState<{
    failedConnectors: boolean;
    staleAutomatedEvidence: boolean;
  } | null>(null);
  const [connInstances, setConnInstances] = useState<
    { id: string; label: string; connectorId: string; lastError: string | null }[]
  >([]);

  function load() {
    api<Item[] | PaginatedList<Item>>(`/projects/${id}/checklist?limit=200`)
      .then((r) => setItems(listItems(r)))
      .catch(() => setItems([]));
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    api<{
      banner: { failedConnectors: boolean; staleAutomatedEvidence: boolean };
      instances: { id: string; label: string; connectorId: string; lastError: string | null }[];
    }>(`/projects/${id}/connectors/status/summary`)
      .then((r) => {
        setConnBanner(r.banner);
        setConnInstances(r.instances || []);
      })
      .catch(() => {
        setConnBanner(null);
        setConnInstances([]);
      });
  }, [id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const w = sessionStorage.getItem('checklistInitWarning');
      if (w) {
        sessionStorage.removeItem('checklistInitWarning');
        toast.info(w);
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  const stats = useMemo(() => {
    const list = items ?? [];
    const total = list.length;
    const compliant = list.filter((i) => i.status === 'compliant').length;
    const inProgress = list.filter((i) => i.status === 'in_progress').length;
    const notStarted = list.filter((i) => i.status === 'not_started').length;
    const nonCompliant = list.filter((i) => i.status === 'non_compliant').length;
    const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;
    return { total, compliant, inProgress, notStarted, nonCompliant, pct };
  }, [items]);

  const filtered = useMemo(() => {
    let result = items ?? [];
    if (filter !== 'all') {
      result = result.filter((i) => i.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => {
        const text = i.frrRequirement?.statement || i.ksiIndicator?.statement || '';
        const ref = i.frrRequirement
          ? `${i.frrRequirement.processId} ${i.frrRequirement.reqKey}`
          : i.ksiIndicator?.indicatorId || '';
        const cat = i.catalogRequirement?.requirementCode || '';
        return (
          text.toLowerCase().includes(q) ||
          ref.toLowerCase().includes(q) ||
          cat.toLowerCase().includes(q)
        );
      });
    }
    return result;
  }, [items, filter, search]);

  async function generate() {
    try {
      const r = await api<{ created: number }>(
        `/projects/${id}/checklist/generate`,
        { method: 'POST', body: JSON.stringify({ includeKsi: true }) },
      );
      toast.success(`Generated ${r.created} checklist items`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Error generating checklist');
    }
  }

  async function setStatus(itemId: string, status: string) {
    await api(`/checklist-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    toast.success('Status updated');
    load();
  }

  async function setDueDate(itemId: string, dueDate: string) {
    try {
      await api(`/checklist-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueDate: dueDate || null }),
      });
      toast.success('Due date updated');
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to update due date');
    }
  }

  async function uploadEvidence(itemId: string, file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    await fetch(`${getApiBase()}/checklist-items/${itemId}/evidence`, {
      method: 'POST',
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    load();
    toast.success(`Evidence "${file.name}" uploaded`);
  }

  async function exportMd() {
    const token = getToken();
    const res = await fetch(`${getApiBase()}/projects/${id}/export?format=md`, {
      credentials: 'include',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ssp-draft-${id}.md`;
    a.click();
  }

  const loaded = items !== null;
  const list = items ?? [];

  return (
    <div className="animate-in fade-in duration-300">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft size={14} />
        Projects
      </Link>

      <div className="flex justify-between items-start gap-4 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Project Checklist
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track compliance status, upload evidence, and export SSP drafts.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={exportMd}>
            <Download size={14} />
            Export Markdown
          </Button>
        </div>
      </div>

      <Tabs value="checklist" className="mb-6">
        <TabsList>
          <TabsTrigger value="checklist" asChild>
            <Link href={`/projects/${id}`}>Checklist</Link>
          </TabsTrigger>
          <TabsTrigger value="auto-scope" asChild>
            <Link href={`/projects/${id}/auto-scope`}>Auto-Scope</Link>
          </TabsTrigger>
          <TabsTrigger value="poam" asChild>
            <Link href={`/projects/${id}/poam`}>POA&amp;M</Link>
          </TabsTrigger>
          <TabsTrigger value="risk" asChild>
            <Link href={`/projects/${id}/risk`}>Risk</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {connBanner && (connBanner.failedConnectors || connBanner.staleAutomatedEvidence) && (
        <Alert
          variant={connBanner.failedConnectors ? 'destructive' : 'default'}
          className="mb-4"
        >
          <AlertTriangle className="size-4" />
          <AlertDescription>
            {connBanner.failedConnectors && (
              <span>One or more evidence connectors reported an error on last run. </span>
            )}
            {connBanner.staleAutomatedEvidence && (
              <span>
                Some automated evidence may be older than 30 days; review connector schedules.
              </span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {connInstances.length > 0 && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex items-center gap-2">
              <PlugZap size={16} className="text-muted-foreground" />
              <CardTitle className="text-sm">Evidence connectors</CardTitle>
              <Badge variant="secondary" className="ml-auto text-[0.65rem]">
                Automation
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1 text-sm text-muted-foreground pl-4 list-disc">
              {connInstances.map((c) => (
                <li key={c.id}>
                  <span className="font-semibold text-foreground">{c.label}</span>{' '}
                  ({c.connectorId})
                  {c.lastError && (
                    <span className="text-destructive"> — last error</span>
                  )}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Connector runs and schedules are managed via the API{' '}
              <code className="text-[0.65rem]">/projects/:id/connectors</code>.
            </p>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm">Evidence guidance</CardTitle>
            <Badge variant="secondary" className="ml-auto text-[0.65rem]">
              What to upload
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Evidence is proof that a control is implemented and operating. Upload artifacts
            that an auditor can review.
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">Policy / SOP PDFs</Badge>
            <Badge variant="outline">Screenshots</Badge>
            <Badge variant="outline">Config exports</Badge>
            <Badge variant="outline">Scan results</Badge>
            <Badge variant="outline">Logs / reports</Badge>
            <Badge variant="outline">Ticket history</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Tip: include date range and system scope in filenames for easier audits.
          </p>
        </CardContent>
      </Card>

      {loaded && list.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-5">
            <Card className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center py-4">
              <ProgressRing value={stats.pct} size={64} />
              <span className="mt-2 text-xs text-muted-foreground">Overall</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-4">
              <span className="text-2xl font-bold tabular-nums">{stats.total}</span>
              <span className="text-xs text-muted-foreground">Total</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-4">
              <span className="text-2xl font-bold tabular-nums text-success">
                {stats.compliant}
              </span>
              <span className="text-xs text-muted-foreground">Compliant</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-4">
              <span className="text-2xl font-bold tabular-nums text-primary">
                {stats.inProgress}
              </span>
              <span className="text-xs text-muted-foreground">In Progress</span>
            </Card>
            <Card className="flex flex-col items-center justify-center py-4">
              <span className="text-2xl font-bold tabular-nums text-destructive">
                {stats.nonCompliant}
              </span>
              <span className="text-xs text-muted-foreground">Non-Compliant</span>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="relative w-full max-w-[280px]">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder="Search requirements..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
                aria-label="Search requirements"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'not_started', 'in_progress', 'compliant', 'non_compliant'] as const).map(
                (s) => (
                  <Button
                    key={s}
                    variant={filter === s ? 'default' : 'secondary'}
                    size="sm"
                    className="text-xs"
                    onClick={() => setFilter(s)}
                  >
                    {s === 'all'
                      ? `All (${stats.total})`
                      : `${statusLabels[s]} (${list.filter((i) => i.status === s).length})`}
                  </Button>
                ),
              )}
            </div>
          </div>
        </>
      )}

      {!loaded ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Reference</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[170px]">Due Date</TableHead>
              <TableHead className="min-w-[11rem] w-[11rem]">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 8 }).map((_, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <Skeleton className="h-4 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-full max-w-[300px]" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-36" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-8 w-20" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : filtered.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Reference</TableHead>
              <TableHead>Requirement</TableHead>
              <TableHead className="w-[140px]">Status</TableHead>
              <TableHead className="w-[170px]">Due Date</TableHead>
              <TableHead className="min-w-[11rem] w-[11rem]">Evidence</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((i) => (
              <TableRow key={i.id}>
                <TableCell className="align-top">
                  <div className="font-semibold text-sm text-foreground">
                    {i.frrRequirement
                      ? i.frrRequirement.processId
                      : i.ksiIndicator?.indicatorId}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {i.frrRequirement?.reqKey || ''}
                  </div>
                  <Badge
                    variant={i.frrRequirement ? 'default' : 'secondary'}
                    className="mt-1"
                  >
                    {i.frrRequirement?.primaryKeyWord || 'KSI'}
                  </Badge>
                  {i.catalogRequirement && (
                    <div className="text-xs text-muted-foreground mt-1.5 leading-snug">
                      Catalog:{' '}
                      <code className="text-[0.65rem]">
                        {i.catalogRequirement.frameworkRelease?.framework?.code || '—'} ·{' '}
                        {i.catalogRequirement.requirementCode}
                      </code>
                    </div>
                  )}
                </TableCell>
                <TableCell className="align-top whitespace-normal">
                  <div className="text-sm leading-relaxed text-muted-foreground">
                    {i.frrRequirement?.statement || i.ksiIndicator?.statement}
                  </div>
                </TableCell>
                <TableCell className="align-top">
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    value={i.status}
                    onChange={(e) => setStatus(i.id, e.target.value)}
                    aria-label="Compliance status"
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="compliant">Compliant</option>
                    <option value="non_compliant">Non-Compliant</option>
                  </select>
                </TableCell>
                <TableCell className="align-top">
                  <Input
                    type="date"
                    className="h-8 w-40"
                    aria-label="Due date"
                    value={
                      i.dueDate
                        ? new Date(i.dueDate).toISOString().slice(0, 10)
                        : ''
                    }
                    onChange={(e) => setDueDate(i.id, e.target.value)}
                  />
                </TableCell>
                <TableCell className="align-top whitespace-normal min-w-[11rem]">
                  <EvidenceUploadButton
                    onUpload={(file) => uploadEvidence(i.id, file)}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No checklist items yet"
          description='Ensure FRMR data is loaded, then click "Generate Checklist".'
          actionLabel="Generate Checklist"
          onAction={generate}
        />
      ) : (
        <EmptyState
          icon={Search}
          title="No items match your current filter"
          description="Try adjusting your search or filter criteria."
        />
      )}
    </div>
  );
}

function EvidenceUploadButton({
  onUpload,
}: {
  onUpload: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto shrink-0 gap-1.5 whitespace-nowrap px-2 py-1.5"
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={14} className="shrink-0" aria-hidden />
        <span>Upload</span>
      </Button>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        aria-label="Upload evidence file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = '';
        }}
      />
    </>
  );
}
