'use client';

import { useEffect, useState } from 'react';
import { Search, BookOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/compliance/EmptyState';

type Term = {
  id: string;
  stableId: string;
  term: string;
  definition: string;
  alts?: string[];
};

export default function GlossaryPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Term[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => {
      api<{ items: Term[]; total: number }>(
        `/frmr/terms?limit=50&q=${encodeURIComponent(q)}`,
      )
        .then((d) => { setItems(d.items); setTotal(d.total); })
        .catch(() => { setItems([]); setTotal(0); })
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">FedRAMP Glossary</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Browse FedRAMP Requirements Definitions (FRD) terminology.
          </p>
        </div>
        <Badge variant="secondary">{total} terms</Badge>
      </div>

      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Search terms..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-8"
          aria-label="Search glossary terms"
        />
      </div>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No terms found"
          description="Try a different search or ingest FRMR data first."
        />
      ) : (
        <div className="grid gap-2">
          {items.map((t) => (
            <Card key={t.id} className="gap-0 py-4">
              <CardContent className="px-5 py-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm text-foreground">{t.term}</span>
                  <Badge variant="default">{t.stableId}</Badge>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {t.definition}
                </p>
                {t.alts && t.alts.length > 0 && (
                  <div className="mt-1.5 flex gap-1 flex-wrap">
                    {t.alts.map((a, i) => (
                      <Badge key={i} variant="outline" className="text-[0.65rem]">{a}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
