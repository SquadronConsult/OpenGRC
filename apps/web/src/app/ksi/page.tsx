'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  useEffect(() => {
    const q = domain ? `&domain=${encodeURIComponent(domain)}` : '';
    api<{ items: K[] }>(`/frmr/ksi?limit=150${q}`)
      .then((d) => setItems(d.items))
      .catch(() => setItems([]));
  }, [domain]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Key Security Indicators</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            FedRAMP KSIs organized by security domain, with mapped NIST 800-53 controls.
          </p>
        </div>
        <span className="badge" style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}>{items.length} indicators</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <input
          className="form-input"
          placeholder="Filter by domain (AFR, IAM, VPM...)"
          value={domain}
          onChange={(e) => setDomain(e.target.value.toUpperCase())}
          style={{ maxWidth: 320 }}
        />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No KSIs found. Ingest FRMR data or adjust your filter.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {items.map((k) => (
            <div key={k.id} className="card" style={{ marginBottom: 0, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span className="badge badge-blue">{k.domainCode}</span>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{k.indicatorId}</span>
                {k.name && <span className="text-dim text-sm">&mdash; {k.name}</span>}
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0.25rem 0 0' }}>{k.statement}</p>
              {k.controls?.length > 0 && (
                <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.2rem' }}>
                  {k.controls.map((c, i) => (
                    <span key={i} className="badge" style={{ fontSize: '0.58rem' }}>{c}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
