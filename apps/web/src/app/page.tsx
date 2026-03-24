'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Upload,
  Search,
  FileDown,
  Radar,
  Activity,
  CheckCircle2,
  Clock,
  XCircle,
  Circle,
  ArrowRight,
} from 'lucide-react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReadinessGauge } from '@/components/compliance/ReadinessGauge';
import { DeadlineChip } from '@/components/compliance/DeadlineChip';
import McpConnectCard from '@/components/McpConnectCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface DashboardStats {
  projects: number;
  totalControls: number;
  compliant: number;
  inProgress: number;
  nonCompliant: number;
  notStarted: number;
  readinessPct: number;
  upcomingDeadlines: {
    itemId: string;
    controlRef: string;
    controlName: string;
    dueDate: string;
    daysRemaining: number;
    status: string;
  }[];
}

interface ActivityEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  summary: string;
  createdAt: string;
  userId: string;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const statCards = [
  { key: 'compliant', label: 'Compliant', icon: CheckCircle2, color: 'text-success' },
  { key: 'inProgress', label: 'In Progress', icon: Clock, color: 'text-primary' },
  { key: 'nonCompliant', label: 'Gaps', icon: XCircle, color: 'text-destructive' },
  { key: 'notStarted', label: 'Not Started', icon: Circle, color: 'text-muted-foreground' },
] as const;

export default function Home() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mcpOpen, setMcpOpen] = useState(false);

  useEffect(() => {
    Promise.all([
      api<DashboardStats>('/dashboard/stats').catch(() => null),
      api<ActivityEntry[]>('/activity/recent?limit=8').catch(() => []),
    ]).then(([s, a]) => {
      setStats(s);
      setActivity(a);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-6">
          <Skeleton className="h-40 w-40 rounded-full" />
          <div className="flex-1 space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-96" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      {/* Top row: Readiness gauge + Quick actions */}
      <div className="flex flex-col items-start gap-6 md:flex-row">
        <Card className="flex flex-col items-center px-8 py-6">
          <ReadinessGauge value={stats?.readinessPct ?? 0} size={140} />
          <p className="mt-2 text-xs text-muted-foreground">
            {stats?.totalControls ?? 0} controls across {stats?.projects ?? 0} project(s)
          </p>
        </Card>

        <Card className="flex-1 transition-transform duration-150 hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects"><Upload size={14} className="mr-1.5" />Upload Evidence</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects"><Search size={14} className="mr-1.5" />Review Findings</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects"><FileDown size={14} className="mr-1.5" />Export POA&amp;M</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects"><Radar size={14} className="mr-1.5" />Run Auto-Scope</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((sc) => (
          <Card key={sc.key} className="transition-colors hover:border-primary/30">
            <CardContent className="flex items-center gap-3 p-4">
              <sc.icon size={20} className={sc.color} aria-hidden="true" />
              <div>
                <div className="text-2xl font-bold tabular-nums">
                  {stats?.[sc.key] ?? 0}
                </div>
                <div className="text-[0.68rem] uppercase tracking-wide text-muted-foreground">
                  {sc.label}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Two-column: Deadlines + Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Upcoming deadlines */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Upcoming Deadlines</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {stats?.upcomingDeadlines.length ? (
              stats.upcomingDeadlines.slice(0, 5).map((d) => (
                <div
                  key={d.itemId}
                  className="flex items-center gap-3 rounded-lg border border-border p-2.5 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {d.controlRef}
                    </span>
                    <span className="truncate text-foreground">{d.controlName}</span>
                  </div>
                  <DeadlineChip dueDate={d.dueDate} />
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No upcoming deadlines
              </p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Activity size={14} aria-hidden="true" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activity.length ? (
              activity.map((a) => (
                <div key={a.id} className="flex items-center gap-3 py-1.5 text-xs">
                  <span className="shrink-0 text-muted-foreground">{relativeTime(a.createdAt)}</span>
                  <span className="min-w-0 flex-1 truncate text-foreground">{a.summary}</span>
                </div>
              ))
            ) : (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No recent activity
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Open Projects CTA */}
      <div className="flex justify-center">
        <Button asChild>
          <Link href="/projects">
            Open Projects <ArrowRight size={14} className="ml-1.5" />
          </Link>
        </Button>
      </div>

      {/* MCP Connect - collapsed by default */}
      <Collapsible open={mcpOpen} onOpenChange={setMcpOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full rounded-lg border border-border px-4 py-2.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent">
            {mcpOpen ? 'Hide' : 'Show'} MCP Connection Settings
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-2">
          <McpConnectCard />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
