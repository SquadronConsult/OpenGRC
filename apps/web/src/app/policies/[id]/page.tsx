'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  Clock,
  FileText,
  History,
  Link2,
  Loader2,
  Save,
  Send,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Policy = {
  id: string;
  title: string;
  status: string;
  version: string;
  category?: string | null;
  content?: string;
  ownerUserId?: string | null;
  approverUserId?: string | null;
  effectiveDate?: string | null;
  nextReviewDate?: string | null;
  projectId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type PolicyVersion = {
  id: string;
  versionNumber: string;
  content: string;
  changeDescription?: string | null;
  authorUserId?: string | null;
  createdAt: string;
};

type Attestation = {
  id: string;
  userId: string;
  status: string;
  attestedAt?: string | null;
  expiresAt?: string | null;
  createdAt: string;
};

const STATUS_OPTIONS = ['draft', 'in_review', 'approved', 'published', 'retired'];

function statusColor(s: string) {
  switch (s) {
    case 'published':
      return 'default';
    case 'approved':
      return 'secondary';
    case 'draft':
      return 'outline';
    case 'retired':
      return 'destructive';
    default:
      return 'outline';
  }
}

export default function PolicyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [policy, setPolicy] = useState<Policy | null>(null);
  const [versions, setVersions] = useState<PolicyVersion[]>([]);
  const [attestations, setAttestations] = useState<Attestation[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [changeDesc, setChangeDesc] = useState('');

  // Editable fields
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [content, setContent] = useState('');
  const [status, setStatus] = useState('');
  const [version, setVersion] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [nextReviewDate, setNextReviewDate] = useState('');

  const loadPolicy = useCallback(async () => {
    try {
      const p = await api<Policy>(`/policies/${id}`);
      setPolicy(p);
      setTitle(p.title);
      setCategory(p.category ?? '');
      setContent(p.content ?? '');
      setStatus(p.status);
      setVersion(p.version ?? '1.0.0');
      setEffectiveDate(p.effectiveDate?.slice(0, 10) ?? '');
      setNextReviewDate(p.nextReviewDate?.slice(0, 10) ?? '');
    } catch {
      toast.error('Failed to load policy');
    }
  }, [id]);

  const loadVersions = useCallback(async () => {
    try {
      setVersions(await api<PolicyVersion[]>(`/policies/${id}/versions`));
    } catch {
      /* ignore if versions fail */
    }
  }, [id]);

  useEffect(() => {
    loadPolicy();
    loadVersions();
  }, [loadPolicy, loadVersions]);

  async function save() {
    setSaving(true);
    try {
      await api(`/policies/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title,
          category: category || null,
          content,
          status,
          version,
          effectiveDate: effectiveDate || null,
          nextReviewDate: nextReviewDate || null,
        }),
      });
      toast.success('Policy saved');
      await loadPolicy();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    setPublishing(true);
    try {
      await api(`/policies/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ changeDescription: changeDesc || undefined }),
      });
      toast.success('Policy published — version snapshot created');
      setChangeDesc('');
      await loadPolicy();
      await loadVersions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Publish failed');
    } finally {
      setPublishing(false);
    }
  }

  if (!policy)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/policies')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{policy.title}</h1>
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
              <Badge variant={statusColor(policy.status) as 'default' | 'secondary' | 'outline' | 'destructive'}>
                {policy.status}
              </Badge>
              <span>v{policy.version}</span>
              {policy.category && <span>· {policy.category}</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save
          </Button>
          <Button variant="secondary" onClick={publish} disabled={publishing}>
            {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
            Publish
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit" className="gap-4">
        <TabsList>
          <TabsTrigger value="edit" className="gap-1.5">
            <FileText className="h-4 w-4" />
            Edit
          </TabsTrigger>
          <TabsTrigger value="versions" className="gap-1.5">
            <History className="h-4 w-4" />
            Versions ({versions.length})
          </TabsTrigger>
          <TabsTrigger value="metadata" className="gap-1.5">
            <Link2 className="h-4 w-4" />
            Metadata
          </TabsTrigger>
        </TabsList>

        {/* ---------- Edit tab ---------- */}
        <TabsContent value="edit" className="space-y-4 mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Policy content</CardTitle>
              <CardDescription>Markdown-formatted policy body. Edit directly.</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="min-h-[500px] w-full rounded-[4px] border border-input bg-background px-3 py-2 font-mono text-sm leading-relaxed"
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Publish</CardTitle>
              <CardDescription>
                Create a versioned snapshot of the current content. Publishing sets status to &quot;published&quot;.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Input
                placeholder="Change description (optional)"
                value={changeDesc}
                onChange={(e) => setChangeDesc(e.target.value)}
                className="max-w-md"
              />
              <Button variant="secondary" onClick={publish} disabled={publishing}>
                {publishing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                Publish v{version}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Versions tab ---------- */}
        <TabsContent value="versions" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Version history</CardTitle>
              <CardDescription>Each publish creates a snapshot.</CardDescription>
            </CardHeader>
            <CardContent>
              {versions.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">
                  No versions published yet. Edit the policy content and click Publish to create the first snapshot.
                </p>
              ) : (
                <div className="space-y-3">
                  {versions.map((v) => (
                    <div key={v.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[4px] border border-border px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div>
                          <div className="font-medium text-sm">v{v.versionNumber}</div>
                          <div className="text-xs text-muted-foreground">
                            {v.changeDescription || 'No description'}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---------- Metadata tab ---------- */}
        <TabsContent value="metadata" className="mt-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Policy metadata</CardTitle>
              <CardDescription>Title, status, version, dates, and ownership.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-1">
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Category</Label>
                  <Input value={category} onChange={(e) => setCategory(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Status</Label>
                  <select
                    className="flex h-8 w-full rounded-[4px] border border-input bg-background px-3 py-1 text-sm"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <Label>Version</Label>
                  <Input value={version} onChange={(e) => setVersion(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Effective date</Label>
                  <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
                </div>
                <div className="grid gap-1">
                  <Label>Next review date</Label>
                  <Input type="date" value={nextReviewDate} onChange={(e) => setNextReviewDate(e.target.value)} />
                </div>
              </div>
              <div className="mt-4">
                <Button onClick={save} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Save metadata
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
