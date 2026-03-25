'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookTemplate, FileText, Loader2, Plus, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/compliance/EmptyState';

type PolicyRow = {
  id: string;
  title: string;
  status: string;
  category?: string | null;
  projectId?: string | null;
  version?: string;
  updatedAt?: string;
};

type TemplateInfo = {
  slug: string;
  title: string;
  category: string;
  controlFamilies: string[];
};

function statusColor(s: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (s) {
    case 'published':
      return 'default';
    case 'approved':
      return 'secondary';
    case 'retired':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function PoliciesPage() {
  const router = useRouter();
  const [list, setList] = useState<PolicyRow[] | null>(null);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  // Generate dialog
  const [genOpen, setGenOpen] = useState(false);
  const [genProjectId, setGenProjectId] = useState('');
  const [genOrgName, setGenOrgName] = useState('');
  const [genSysName, setGenSysName] = useState('');
  const [generating, setGenerating] = useState(false);

  // Filter
  const [filterProject, setFilterProject] = useState('');

  function load() {
    const q = filterProject ? `?projectId=${encodeURIComponent(filterProject)}` : '';
    api<PolicyRow[]>(`/policies${q}`)
      .then(setList)
      .catch(() => {
        toast.error('Failed to load policies');
        setList([]);
      });
  }

  useEffect(() => {
    load();
    api<TemplateInfo[]>('/policies/templates')
      .then(setTemplates)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const p = await api<PolicyRow>('/policies', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category: category || undefined,
          content: content || undefined,
          projectId: projectId || undefined,
        }),
      });
      toast.success('Policy created');
      setCreateOpen(false);
      setTitle('');
      setCategory('');
      setContent('');
      router.push(`/policies/${p.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function generateAll(e: React.FormEvent) {
    e.preventDefault();
    if (!genProjectId.trim()) {
      toast.error('Project ID is required');
      return;
    }
    setGenerating(true);
    try {
      const res = await api<{ created: PolicyRow[]; skipped: string[] }>('/policies/generate', {
        method: 'POST',
        body: JSON.stringify({
          projectId: genProjectId.trim(),
          organizationName: genOrgName.trim() || undefined,
          systemName: genSysName.trim() || undefined,
        }),
      });
      toast.success(
        `Generated ${res.created.length} policies${res.skipped.length ? ` (${res.skipped.length} already existed)` : ''}`,
      );
      setGenOpen(false);
      setFilterProject(genProjectId.trim());
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Governance documents with versioning, control mappings, and attestation tracking.
          </p>
        </div>
        <div className="flex gap-2">
          {/* Generate from templates */}
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <Sparkles className="mr-2 h-4 w-4" />
                Generate from templates
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={generateAll}>
                <DialogHeader>
                  <DialogTitle>Generate policy set</DialogTitle>
                  <DialogDescription>
                    Creates all {templates.length || 17} FedRAMP-required policies from templates. Policies that already
                    exist (by title) are skipped.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-3">
                  <div className="grid gap-1">
                    <Label htmlFor="gproj">
                      Project ID <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="gproj"
                      placeholder="UUID of the project to scope these policies to"
                      value={genProjectId}
                      onChange={(e) => setGenProjectId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="gorg">Organization name</Label>
                    <Input
                      id="gorg"
                      placeholder="Replaces [Organization Name] in templates"
                      value={genOrgName}
                      onChange={(e) => setGenOrgName(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="gsys">System name</Label>
                    <Input
                      id="gsys"
                      placeholder="Replaces [System Name] in templates"
                      value={genSysName}
                      onChange={(e) => setGenSysName(e.target.value)}
                    />
                  </div>
                  {templates.length > 0 && (
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Templates that will be generated:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {templates.map((t) => (
                          <Badge key={t.slug} variant="outline" className="text-xs">
                            {t.title}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={generating}>
                    {generating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Generate all policies
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          {/* Create blank */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New policy
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <form onSubmit={create}>
                <DialogHeader>
                  <DialogTitle>Create policy</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 py-2">
                  <div className="grid gap-1">
                    <Label htmlFor="ptitle">Title</Label>
                    <Input
                      id="ptitle"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="pcat">Category</Label>
                    <Input
                      id="pcat"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="pproj">Project ID (optional)</Label>
                    <Input
                      id="pproj"
                      placeholder="UUID to scope this policy"
                      value={projectId}
                      onChange={(e) => setProjectId(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1">
                    <Label htmlFor="pbody">Content (markdown)</Label>
                    <textarea
                      id="pbody"
                      className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-2 pt-4">
          <div className="grid gap-1">
            <Label className="text-xs text-muted-foreground">Filter by project</Label>
            <Input
              className="max-w-sm"
              placeholder="Project UUID (blank = all)"
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
            />
          </div>
          <Button type="button" variant="secondary" onClick={load}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {/* Policy list */}
      {list === null ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No policies yet"
          description="Create a policy manually or generate a full FedRAMP policy set from templates."
        />
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <button
              key={p.id}
              onClick={() => router.push(`/policies/${p.id}`)}
              className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.category || '—'}
                    {' · v'}
                    {p.version ?? '1.0.0'}
                    {p.updatedAt && (
                      <>
                        {' · updated '}
                        {new Date(p.updatedAt).toLocaleDateString()}
                      </>
                    )}
                  </div>
                </div>
              </div>
              <Badge variant={statusColor(p.status)}>{p.status.replace('_', ' ')}</Badge>
            </button>
          ))}
        </div>
      )}

      {/* Templates reference */}
      {templates.length > 0 && (
        <Card className="border-dashed">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <BookTemplate className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm">Available templates</CardTitle>
            </div>
            <CardDescription>
              {templates.length} FedRAMP policy templates ready to generate. Each covers specific NIST 800-53 control
              families.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <div
                  key={t.slug}
                  className="rounded-md border border-border/60 px-3 py-2 text-sm"
                >
                  <div className="font-medium truncate">{t.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {t.controlFamilies.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
