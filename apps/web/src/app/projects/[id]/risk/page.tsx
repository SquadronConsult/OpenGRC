'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ChevronLeft, Plus, Pencil, Shield, Link2, Stamp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, listItems, type PaginatedList } from '@/lib/api';

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';

type RiskSummary = {
  id: string;
  title: string;
  category: string | null;
  likelihood: number;
  impact: number;
  inherentScore: number;
  inherentBand: string;
  residualScore: number | null;
  residualBand: string | null;
  status: string;
  ownerUserId: string | null;
};

type RiskDetail = RiskSummary & {
  description: string | null;
  residualLikelihood: number | null;
  residualImpact: number | null;
  residualOverrideReason: string | null;
  appetiteDecision: string | null;
  acceptanceExpiresAt: string | null;
  checklistMitigations: {
    id: string;
    checklistItemId: string;
    notes: string | null;
    checklistItem: { id: string; status: string } | null;
  }[];
  internalControlMitigations: {
    id: string;
    internalControlId: string;
    notes: string | null;
    internalControl: { id: string; code: string; title: string } | null;
  }[];
  acceptanceRequests: {
    id: string;
    status: string;
    submittedAt: string | null;
    notes: string | null;
    steps: {
      id: string;
      orderIndex: number;
      approverUserId: string;
      status: string;
      notes: string | null;
      actedAt: string | null;
    }[];
  }[];
};

type HeatmapResponse = {
  projectId: string;
  cells: Record<string, number>;
  total: number;
};

type ChecklistRow = { id: string; status: string };
type InternalControlRow = { id: string; code: string; title: string };

function bandBadgeClass(band: string) {
  if (band === 'critical' || band === 'high')
    return 'bg-destructive text-destructive-foreground';
  if (band === 'moderate') return 'bg-warning text-foreground';
  return 'bg-success text-white';
}

function heatCellClass(band: string) {
  if (band === 'critical' || band === 'high') return 'bg-destructive/90 text-destructive-foreground';
  if (band === 'moderate') return 'bg-warning/90 text-foreground';
  return 'bg-success/90 text-white';
}

function scoreBand(score: number) {
  if (score <= 5) return 'low';
  if (score <= 12) return 'moderate';
  if (score <= 20) return 'high';
  return 'critical';
}

export default function ProjectRiskPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [list, setList] = useState<RiskSummary[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapResponse | null>(null);
  const [checklist, setChecklist] = useState<ChecklistRow[]>([]);
  const [internals, setInternals] = useState<InternalControlRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<RiskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterBucket, setFilterBucket] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    likelihood: 3,
    impact: 3,
    residualLikelihood: '' as number | '',
    residualImpact: '' as number | '',
    residualOverrideReason: '',
    status: 'open',
    appetiteDecision: '',
  });

  const loadList = useCallback(async () => {
    const [risks, hm, cl, ic] = await Promise.all([
      api<RiskSummary[] | PaginatedList<RiskSummary>>(
        `/projects/${id}/risks?limit=200`,
      ).then((r) => listItems(r)),
      api<HeatmapResponse>(`/projects/${id}/risks/heatmap`),
      api<ChecklistRow[] | PaginatedList<ChecklistRow>>(
        `/projects/${id}/checklist?limit=200`,
      )
        .then((r) => listItems(r))
        .catch((e: unknown) => {
          toast.error(
            e instanceof Error ? e.message : 'Could not load checklist items for linking',
          );
          return [] as ChecklistRow[];
        }),
      api<InternalControlRow[] | PaginatedList<InternalControlRow>>(
        `/catalog/internal-controls?limit=200`,
      )
        .then((r) => listItems(r))
        .catch((e: unknown) => {
          toast.error(
            e instanceof Error ? e.message : 'Could not load internal controls for linking',
          );
          return [] as InternalControlRow[];
        }),
    ]);
    setList(risks);
    setHeatmap(hm);
    setChecklist(cl);
    setInternals(ic);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    loadList()
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load risks');
      })
      .finally(() => setLoading(false));
  }, [loadList]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    api<RiskDetail>(`/projects/${id}/risks/${selectedId}`)
      .then(setDetail)
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Could not load risk details');
        setDetail(null);
      });
  }, [id, selectedId]);

  const filteredList = useMemo(() => {
    if (!filterBucket) return list;
    const [l, i] = filterBucket.split('x').map(Number);
    return list.filter((r) => r.likelihood === l && r.impact === i);
  }, [list, filterBucket]);

  async function saveRisk() {
    try {
      const body = {
        title: form.title,
        description: form.description || undefined,
        category: form.category || undefined,
        likelihood: form.likelihood,
        impact: form.impact,
        residualLikelihood:
          form.residualLikelihood === '' ? null : Number(form.residualLikelihood),
        residualImpact: form.residualImpact === '' ? null : Number(form.residualImpact),
        residualOverrideReason: form.residualOverrideReason || undefined,
        status: form.status,
        appetiteDecision: form.appetiteDecision || undefined,
      };
      if (editMode && selectedId) {
        await api(`/projects/${id}/risks/${selectedId}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
        toast.success('Risk updated');
      } else {
        const created = await api<RiskSummary>(`/projects/${id}/risks`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        setSelectedId(created.id);
        toast.success('Risk created');
      }
      setFormOpen(false);
      await loadList();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Save failed');
    }
  }

  function openCreate() {
    setEditMode(false);
    setForm({
      title: '',
      description: '',
      category: '',
      likelihood: 3,
      impact: 3,
      residualLikelihood: '',
      residualImpact: '',
      residualOverrideReason: '',
      status: 'open',
      appetiteDecision: '',
    });
    setFormOpen(true);
  }

  function openEdit() {
    if (!detail) return;
    setEditMode(true);
    setForm({
      title: detail.title,
      description: detail.description || '',
      category: detail.category || '',
      likelihood: detail.likelihood,
      impact: detail.impact,
      residualLikelihood:
        detail.residualLikelihood != null ? detail.residualLikelihood : '',
      residualImpact: detail.residualImpact != null ? detail.residualImpact : '',
      residualOverrideReason: detail.residualOverrideReason || '',
      status: detail.status,
      appetiteDecision: detail.appetiteDecision || '',
    });
    setFormOpen(true);
  }

  async function addChecklistMitigation(checklistItemId: string) {
    if (!selectedId) return;
    try {
      await api(`/projects/${id}/risks/${selectedId}/mitigations/checklist-items`, {
        method: 'POST',
        body: JSON.stringify({ checklistItemId }),
      });
      const d = await api<RiskDetail>(`/projects/${id}/risks/${selectedId}`);
      setDetail(d);
      toast.success('Linked checklist item');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    }
  }

  async function addIcMitigation(internalControlId: string) {
    if (!selectedId) return;
    try {
      await api(`/projects/${id}/risks/${selectedId}/mitigations/internal-controls`, {
        method: 'POST',
        body: JSON.stringify({ internalControlId }),
      });
      const d = await api<RiskDetail>(`/projects/${id}/risks/${selectedId}`);
      setDetail(d);
      toast.success('Linked internal control');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Link failed');
    }
  }

  async function submitAcceptance() {
    if (!selectedId) return;
    try {
      await api(`/projects/${id}/risks/${selectedId}/acceptance/submit`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Risk acceptance requested' }),
      });
      const d = await api<RiskDetail>(`/projects/${id}/risks/${selectedId}`);
      setDetail(d);
      await loadList();
      toast.success('Acceptance submitted');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Submit failed');
    }
  }

  async function approveStep(stepId: string) {
    if (!selectedId) return;
    try {
      await api(`/projects/${id}/risks/${selectedId}/acceptance/${stepId}/approve`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const d = await api<RiskDetail>(`/projects/${id}/risks/${selectedId}`);
      setDetail(d);
      await loadList();
      toast.success('Step approved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Approve failed');
    }
  }

  async function rejectStep(stepId: string) {
    if (!selectedId) return;
    try {
      await api(`/projects/${id}/risks/${selectedId}/acceptance/${stepId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ notes: 'Rejected' }),
      });
      const d = await api<RiskDetail>(`/projects/${id}/risks/${selectedId}`);
      setDetail(d);
      await loadList();
      toast.success('Step rejected');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Reject failed');
    }
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Back link */}
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="size-4" />
        Checklist
      </Link>

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Risk register</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Likelihood × impact scoring, mitigations, and acceptance workflow.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" />
          Add risk
        </Button>
      </div>

      {/* Tab bar */}
      <Tabs value="risk">
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

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          <Skeleton className="h-40 w-full max-w-md" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      )}

      {/* Heatmap */}
      {heatmap && !loading && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Shield className="size-4" />
                Inherent risk heatmap
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterBucket(null)}
              >
                Clear filter
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Impact → · Likelihood ↓ · Click a cell to filter the register ({heatmap.total} risks).
            </p>
            <div className="grid max-w-md gap-1" style={{ gridTemplateColumns: 'auto repeat(5, 1fr)' }}>
              <div />
              {[1, 2, 3, 4, 5].map((imp) => (
                <div
                  key={`h-${imp}`}
                  className="text-center text-xs font-semibold text-muted-foreground"
                >
                  I{imp}
                </div>
              ))}
              {[5, 4, 3, 2, 1].map((like) => (
                <div key={`row-${like}`} className="contents">
                  <div className="flex items-center text-xs font-semibold text-muted-foreground">
                    L{like}
                  </div>
                  {[1, 2, 3, 4, 5].map((imp) => {
                    const key = `${like}x${imp}`;
                    const n = heatmap.cells[key] ?? 0;
                    const band = scoreBand(like * imp);
                    const active = filterBucket === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setFilterBucket(active ? null : key)}
                        className={cn(
                          'min-h-9 rounded-md text-xs font-bold transition-all',
                          heatCellClass(band),
                          n === 0 && 'opacity-25',
                          active
                            ? 'ring-2 ring-ring ring-offset-2'
                            : 'border border-border',
                        )}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Risk register table */}
      {!loading && (
        <Card>
          <CardHeader>
            <CardTitle>Register</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>L×I</TableHead>
                  <TableHead>Inherent</TableHead>
                  <TableHead>Residual</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredList.map((r) => (
                  <TableRow
                    key={r.id}
                    tabIndex={0}
                    role="button"
                    onClick={() => setSelectedId(r.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedId(r.id);
                      }
                    }}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50',
                      selectedId === r.id && 'bg-primary/5',
                    )}
                  >
                    <TableCell className="font-semibold">{r.title}</TableCell>
                    <TableCell>{r.category || '—'}</TableCell>
                    <TableCell>
                      {r.likelihood}×{r.impact}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn(bandBadgeClass(r.inherentBand))}>
                        {r.inherentScore} {r.inherentBand}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.residualScore != null ? (
                        <Badge className={cn(bandBadgeClass(r.residualBand || 'low'))}>
                          {r.residualScore} {r.residualBand}
                        </Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell>{r.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {filteredList.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No risks yet. Add one or adjust the heatmap filter.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detail panel */}
      {selectedId && detail && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Detail</CardTitle>
              <Button variant="outline" size="sm" onClick={openEdit}>
                <Pencil className="size-3.5" />
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Description & badges */}
            <p className="text-sm">
              {detail.description || 'No description.'}
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                Appetite: {detail.appetiteDecision || '—'}
              </Badge>
              {detail.residualOverrideReason && (
                <Badge variant="outline">
                  Override: {detail.residualOverrideReason}
                </Badge>
              )}
            </div>

            <Separator />

            {/* Checklist mitigations */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Link2 className="size-4" />
                Checklist mitigations
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.checklistMitigations.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{m.checklistItemId.slice(0, 8)}…</TableCell>
                      <TableCell>{m.checklistItem?.status || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {detail.checklistMitigations.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={2} className="text-center text-muted-foreground">
                        None linked
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <select
                className="h-9 max-w-xs rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue=""
                aria-label="Link checklist item"
                onChange={(e) => {
                  if (e.target.value) addChecklistMitigation(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Link checklist item…</option>
                {checklist.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id.slice(0, 8)}… ({c.status})
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            {/* Internal control mitigations */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Shield className="size-4" />
                Internal control mitigations
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {detail.internalControlMitigations.map((m) => (
                  <li key={m.id} className="flex items-start gap-1.5">
                    <span className="mt-0.5 block size-1.5 shrink-0 rounded-full bg-foreground/30" />
                    {m.internalControl?.code}: {m.internalControl?.title}
                  </li>
                ))}
                {detail.internalControlMitigations.length === 0 && <li>None linked</li>}
              </ul>
              <select
                className="h-9 max-w-sm rounded-md border border-input bg-background px-3 text-sm text-foreground"
                defaultValue=""
                aria-label="Link internal control"
                onChange={(e) => {
                  if (e.target.value) addIcMitigation(e.target.value);
                  e.target.value = '';
                }}
              >
                <option value="">Link internal control…</option>
                {internals.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
            </div>

            <Separator />

            {/* Risk acceptance */}
            <div className="space-y-3">
              <h4 className="flex items-center gap-2 text-sm font-semibold">
                <Stamp className="size-4" />
                Risk acceptance
              </h4>
              {detail.acceptanceRequests?.length ? (
                detail.acceptanceRequests.map((req) => (
                  <Card key={req.id} className="bg-muted/30">
                    <CardContent className="space-y-2 pt-4">
                      <p className="text-xs text-muted-foreground">
                        Request {req.status} · {req.submittedAt || '—'}
                      </p>
                      {req.steps.map((s) => (
                        <div key={s.id} className="flex items-center gap-3">
                          <span className="text-xs">
                            Step {s.orderIndex + 1}: {s.status} (approver{' '}
                            {s.approverUserId.slice(0, 8)}…)
                          </span>
                          {s.status === 'pending' && (
                            <span className="flex gap-1.5">
                              <Button
                                size="xs"
                                variant="secondary"
                                onClick={() => approveStep(s.id)}
                              >
                                Approve
                              </Button>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => rejectStep(s.id)}
                              >
                                Reject
                              </Button>
                            </span>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No acceptance requests.</p>
              )}
              <Button variant="secondary" onClick={submitAcceptance}>
                <Stamp className="size-4" />
                Submit acceptance (2-step chain)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit risk' : 'New risk'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="risk-title">Title</Label>
              <Input
                id="risk-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-description">Description</Label>
              <textarea
                id="risk-description"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-category">Category</Label>
              <Input
                id="risk-category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="risk-likelihood">Likelihood (1–5)</Label>
                <Input
                  id="risk-likelihood"
                  type="number"
                  min={1}
                  max={5}
                  value={form.likelihood}
                  onChange={(e) => setForm({ ...form, likelihood: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-impact">Impact (1–5)</Label>
                <Input
                  id="risk-impact"
                  type="number"
                  min={1}
                  max={5}
                  value={form.impact}
                  onChange={(e) => setForm({ ...form, impact: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="risk-res-likelihood">Residual L (optional)</Label>
                <Input
                  id="risk-res-likelihood"
                  type="number"
                  min={1}
                  max={5}
                  value={form.residualLikelihood === '' ? '' : form.residualLikelihood}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      residualLikelihood: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="risk-res-impact">Residual I (optional)</Label>
                <Input
                  id="risk-res-impact"
                  type="number"
                  min={1}
                  max={5}
                  value={form.residualImpact === '' ? '' : form.residualImpact}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      residualImpact: e.target.value === '' ? '' : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-override-reason">Residual override reason (if residual &gt; inherent)</Label>
              <Input
                id="risk-override-reason"
                value={form.residualOverrideReason}
                onChange={(e) => setForm({ ...form, residualOverrideReason: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-status">Status</Label>
              <select
                id="risk-status"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
              >
                <option value="draft">draft</option>
                <option value="open">open</option>
                <option value="treating">treating</option>
                <option value="accepted">accepted</option>
                <option value="closed">closed</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRisk}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
