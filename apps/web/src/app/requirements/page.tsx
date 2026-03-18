'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

type Req = {
  id: string;
  processId: string;
  layer: string;
  actorLabel: string;
  reqKey: string;
  statement: string;
  primaryKeyWord: string;
};

const keywordColors: Record<string, string> = {
  SHALL: 'badge-red',
  SHOULD: 'badge-yellow',
  MAY: 'badge-blue',
};

export default function RequirementsPage() {
  const [process, setProcess] = useState('');
  const [items, setItems] = useState<Req[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const q = process ? `&process=${encodeURIComponent(process)}` : '';
    api<{ items: Req[]; total: number }>(`/frmr/requirements?limit=100${q}`)
      .then((d) => { setItems(d.items); setTotal(d.total ?? d.items.length); })
      .catch(() => { setItems([]); setTotal(0); });
  }, [process]);

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>FRR Requirements</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            FedRAMP Requirements &amp; Recommendations. Filter by process area to narrow results.
          </p>
        </div>
        <span className="badge" style={{ fontSize: '0.72rem', padding: '0.3rem 0.7rem' }}>{total} requirements</span>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <input
          className="form-input"
          value={process}
          onChange={(e) => setProcess(e.target.value.toUpperCase())}
          placeholder="Filter by process (ADS, PVA, VDR...)"
          style={{ maxWidth: 320 }}
        />
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p>No requirements found. Ingest FRMR data or adjust your filter.</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 85 }}>Process</th>
                <th style={{ width: 75 }}>Layer</th>
                <th style={{ width: 100 }}>Actor</th>
                <th style={{ width: 90 }}>ID</th>
                <th style={{ width: 85 }}>Keyword</th>
                <th>Statement</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td><span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.processId}</span></td>
                  <td className="text-sm">{r.layer}</td>
                  <td className="text-sm">{r.actorLabel}</td>
                  <td><span className="text-xs text-dim">{r.reqKey}</span></td>
                  <td>
                    <span className={`badge ${keywordColors[r.primaryKeyWord?.toUpperCase()] || ''}`}>
                      {r.primaryKeyWord}
                    </span>
                  </td>
                  <td>
                    <div style={{ maxWidth: 420, fontSize: '0.82rem', lineHeight: 1.55 }}>
                      {r.statement.length > 240 ? r.statement.slice(0, 240) + '...' : r.statement}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
