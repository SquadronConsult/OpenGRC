'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FolderOpen, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, listItems, type PaginatedList } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/compliance/EmptyState';
import { ProgressRing } from '@/components/compliance/ProgressRing';

const CHECKLIST_INIT_WARNING_KEY = 'checklistInitWarning';

type Project = {
  id: string;
  name: string;
  pathType: string;
  impactLevel: string;
  createdAt?: string;
};

type CreateProjectResponse = Project & {
  checklistCreated?: number;
  suggestedDueDates?: number;
  checklistInitWarning?: string | null;
};

const impactVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  low: 'secondary',
  moderate: 'outline',
  high: 'destructive',
};

export default function ProjectsPage() {
  const router = useRouter();
  const [list, setList] = useState<Project[] | null>(null);
  const [name, setName] = useState('My CSP');
  const [pathType, setPathType] = useState<'20x' | 'rev5'>('20x');
  const [impact, setImpact] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  function load() {
    api<Project[] | PaginatedList<Project>>('/projects?limit=200')
      .then((r) => setList(listItems(r)))
      .catch((e: unknown) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load projects');
        setList([]);
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const created = await api<CreateProjectResponse>('/projects', {
        method: 'POST',
        body: JSON.stringify({
          name,
          pathType,
          impactLevel: impact,
          complianceStartDate: startDate || undefined,
        }),
      });
      setDialogOpen(false);
      setName('My CSP');
      load();
      if (created.checklistInitWarning) {
        try {
          sessionStorage.setItem(CHECKLIST_INIT_WARNING_KEY, created.checklistInitWarning);
          router.push(`/projects/${created.id}`);
        } catch {
          toast.info(created.checklistInitWarning);
        }
        return;
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function removeProject(id: string, projectName: string) {
    const ok = window.confirm(`Delete "${projectName}"? This removes all associated data.`);
    if (!ok) return;
    setDeletingId(id);
    try {
      await api(`/projects/${id}`, { method: 'DELETE' });
      setList((prev) => (prev ?? []).filter((p) => p.id !== id));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  const loading = list === null;

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage FedRAMP compliance projects with auto-generated checklists, due dates, and POA&amp;M tracking.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4" />
              New Project
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create new project</DialogTitle>
              <DialogDescription>
                A checklist with suggested due dates will be auto-generated based on the impact level and compliance start date.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="grid gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="proj-name">Project name</Label>
                  <Input
                    id="proj-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. My Cloud System"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-path">FedRAMP Path</Label>
                  <select
                    id="proj-path"
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={pathType}
                    onChange={(e) => setPathType(e.target.value as '20x' | 'rev5')}
                  >
                    <option value="20x">FedRAMP 20x</option>
                    <option value="rev5">Rev 5</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-impact">Impact Level</Label>
                  <select
                    id="proj-impact"
                    className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={impact}
                    onChange={(e) => setImpact(e.target.value as 'low' | 'moderate' | 'high')}
                  >
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proj-start">Compliance Start Date</Label>
                  <Input
                    id="proj-start"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-8 w-8 rounded-full" />
              </div>
            </Card>
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="No projects yet"
          description="Create one to get started with FedRAMP compliance tracking."
          actionLabel="New Project"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <div className="grid gap-3">
          {list.map((p) => (
            <Card
              key={p.id}
              className="group flex flex-row items-center justify-between gap-4 p-4 transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link
                href={`/projects/${p.id}`}
                className="flex flex-1 items-center gap-3 text-inherit no-underline min-w-0"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{p.name}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{p.pathType}</Badge>
                    <Badge variant={impactVariant[p.impactLevel] ?? 'outline'}>
                      {p.impactLevel}
                    </Badge>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-3 shrink-0">
                <ProgressRing value={0} size={32} strokeWidth={3} showLabel={false} />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={deletingId === p.id}
                  onClick={() => removeProject(p.id, p.name)}
                >
                  <Trash2 className="size-4" />
                  <span className="sr-only">Delete</span>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
