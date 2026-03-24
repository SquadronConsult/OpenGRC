'use client';

import { useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
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
  version?: number;
};

export default function PoliciesPage() {
  const [list, setList] = useState<PolicyRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('Information Security Policy');
  const [category, setCategory] = useState('security');
  const [content, setContent] = useState('# Policy\n\n');
  const [projectId, setProjectId] = useState('');
  const [saving, setSaving] = useState(false);

  function load() {
    const q = projectId ? `?projectId=${encodeURIComponent(projectId)}` : '';
    api<PolicyRow[]>(`/policies${q}`)
      .then(setList)
      .catch(() => {
        toast.error('Failed to load policies');
        setList([]);
      });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api<PolicyRow>('/policies', {
        method: 'POST',
        body: JSON.stringify({
          title,
          category,
          content,
          projectId: projectId || undefined,
        }),
      });
      toast.success('Policy created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Policies</h1>
          <p className="text-sm text-muted-foreground">
            Document governance, versioning, and attestations (API-backed).
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base font-medium">Filter by project</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input
            className="max-w-md"
            placeholder="Project UUID (optional)"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
          <Button type="button" variant="secondary" onClick={load}>
            Apply
          </Button>
        </CardContent>
      </Card>

      {list === null ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No policies yet"
          description="Create a policy to start your governance library."
        />
      ) : (
        <div className="space-y-2">
          {list.map((p) => (
            <div
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="truncate font-medium">{p.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.category || '—'} · v{p.version ?? 1}
                  </div>
                </div>
              </div>
              <Badge variant="outline">{p.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
