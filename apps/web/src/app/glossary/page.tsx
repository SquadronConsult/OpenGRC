'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

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

  useEffect(() => {
    const t = setTimeout(() => {
      api<{ items: Term[]; total: number }>(
        `/frmr/terms?limit=50&q=${encodeURIComponent(q)}`,
      )
        .then((d) => { setItems(d.items); setTotal(d.total); })
        .catch(() => { setItems([]); setTotal(0); });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>FedRAMP Glossary</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            Browse FedRAMP Requirements Definitions (FRD) terminology.
          </p>
        </div>
        <span className="badge" style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}>{total} terms</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <input
          className="form-input"
          placeholder="Search terms..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 340 }}
        />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No terms found. Try a different search or ingest FRMR data first.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {items.map((t) => (
            <div key={t.id} className="card" style={{ marginBottom: 0, padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)' }}>{t.term}</span>
                <span className="badge badge-blue">{t.stableId}</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{t.definition}</p>
              {t.alts && t.alts.length > 0 && (
                <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {t.alts.map((a, i) => (
                    <span key={i} className="badge" style={{ fontSize: '0.58rem' }}>{a}</span>
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
