'use client';

import { useEffect, useState } from 'react';
import { Search, FileText } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/compliance/EmptyState';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Req = {
  id: string;
  processId: string;
  layer: string;
  actorLabel: string;
  reqKey: string;
  statement: string;
  primaryKeyWord: string;
};

const keywordVariant: Record<string, 'destructive' | 'secondary' | 'default'> = {
  SHALL: 'destructive',
  SHOULD: 'secondary',
  MAY: 'default',
};

export default function RequirementsPage() {
  const [process, setProcess] = useState('');
  const [items, setItems] = useState<Req[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = process ? `&process=${encodeURIComponent(process)}` : '';
    api<{ items: Req[]; total: number }>(`/frmr/requirements?limit=100${q}`)
      .then((d) => { setItems(d.items); setTotal(d.total ?? d.items.length); })
      .catch(() => { setItems([]); setTotal(0); })
      .finally(() => setLoading(false));
  }, [process]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">FRR Requirements</h1>
          <p className="text-sm text-muted-foreground mt-1">
            FedRAMP Requirements &amp; Recommendations. Filter by process area to narrow results.
          </p>
        </div>
        <Badge variant="secondary">{total} requirements</Badge>
      </div>

      <div className="relative mb-5 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          value={process}
          onChange={(e) => setProcess(e.target.value.toUpperCase())}
          placeholder="Filter by process (ADS, PVA, VDR...)"
          className="pl-8"
          aria-label="Filter requirements by process"
        />
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No requirements found"
          description="Ingest FRMR data or adjust your filter."
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20">Process</TableHead>
              <TableHead className="w-[4.5rem]">Layer</TableHead>
              <TableHead className="w-24">Actor</TableHead>
              <TableHead className="w-[5.5rem]">ID</TableHead>
              <TableHead className="w-20">Keyword</TableHead>
              <TableHead>Statement</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-semibold text-foreground">{r.processId}</TableCell>
                <TableCell className="text-sm">{r.layer}</TableCell>
                <TableCell className="text-sm">{r.actorLabel}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.reqKey}</TableCell>
                <TableCell>
                  <Badge variant={keywordVariant[r.primaryKeyWord?.toUpperCase()] ?? 'outline'}>
                    {r.primaryKeyWord}
                  </Badge>
                </TableCell>
                <TableCell className="whitespace-normal">
                  <div className="max-w-md text-[0.82rem] leading-relaxed">
                    {r.statement.length > 240 ? r.statement.slice(0, 240) + '...' : r.statement}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
