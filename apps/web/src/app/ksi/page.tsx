'use client';

import { useEffect, useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { api } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/compliance/EmptyState';

type K = {
  id: string;
  domainCode: string;
  indicatorId: string;
  name: string;
  statement: string;
  controls: string[];
};

export default function KsiPage() {
  const [domain, setDomain] = useState('');
  const [items, setItems] = useState<K[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const q = domain ? `&domain=${encodeURIComponent(domain)}` : '';
    api<{ items: K[] }>(`/frmr/ksi?limit=150${q}`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [domain]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-start gap-4 flex-wrap mb-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Key Security Indicators</h1>
          <p className="text-sm text-muted-foreground mt-1">
            FedRAMP KSIs organized by security domain, with mapped NIST 800-53 controls.
          </p>
        </div>
        <Badge variant="secondary">{items.length} indicators</Badge>
      </div>

      <div className="relative mb-5 max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <Input
          placeholder="Filter by domain (AFR, IAM, VPM...)"
          value={domain}
          onChange={(e) => setDomain(e.target.value.toUpperCase())}
          className="pl-8"
          aria-label="Filter KSIs by domain"
        />
      </div>

      {loading ? (
        <div className="grid gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShieldCheck}
          title="No KSIs found"
          description="Ingest FRMR data or adjust your filter."
        />
      ) : (
        <div className="grid gap-2">
          {items.map((k) => (
            <Card key={k.id} className="gap-0 py-4">
              <CardContent className="px-5 py-0">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="default">{k.domainCode}</Badge>
                  <span className="font-semibold text-sm text-foreground">{k.indicatorId}</span>
                  {k.name && <span className="text-muted-foreground text-sm">&mdash; {k.name}</span>}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                  {k.statement}
                </p>
                {k.controls?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {k.controls.map((c, i) => (
                      <Badge key={i} variant="outline" className="text-[0.65rem]">{c}</Badge>
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
