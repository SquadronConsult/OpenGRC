'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { API, api, getToken } from '@/lib/api';

type PoamRow = {
  poamId: string;
  weaknessName: string;
  weaknessDescription: string;
  weaknessDetectorSource: string;
  weaknessSourceIdentifier: string;
  resourcesAffected: string;
  originalRiskRating: 'Low' | 'Moderate' | 'High';
  adjustedRiskRating: 'Low' | 'Moderate' | 'High';
  riskAdjustment: 'No' | 'Pending' | 'Yes';
  falsePositive: 'No' | 'Pending' | 'Yes';
  operationalRequirement: 'No' | 'Pending' | 'Yes';
  vendorDependency: 'No' | 'Yes';
  lastVendorCheckinDate: string | null;
  vendorDependentProductName: string | null;
  status: string;
  discoveryDate: string;
  statusDate: string;
  plannedMilestone: string;
  plannedMilestoneDate: string | null;
  scheduledCompletionDate: string | null;
  comments: string;
  evidenceReferences: string[];
  source: string;
};

type PoamResponse = {
  project: {
    id: string;
    name: string;
    pathType: string;
    impactLevel: string;
  };
  generatedAt: string;
  totalRows: number;
  rows: PoamRow[];
};

export default function ProjectPoamPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [data, setData] = useState<PoamResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info');

  async function load() {
    setLoading(true);
    try {
      const res = await api<PoamResponse>(`/projects/${id}/poam`);
      setData(res);
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to load POA&M');
      setMsgType('error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const summary = useMemo(() => {
    const rows = data?.rows || [];
    return {
      total: rows.length,
      high: rows.filter((r) => r.adjustedRiskRating === 'High').length,
      moderate: rows.filter((r) => r.adjustedRiskRating === 'Moderate').length,
      low: rows.filter((r) => r.adjustedRiskRating === 'Low').length,
    };
  }, [data]);

  const gantt = useMemo(() => {
    const rows = (data?.rows || [])
      .map((row) => {
        const completion = row.scheduledCompletionDate
          ? new Date(`${row.scheduledCompletionDate}T00:00:00`)
          : null;
        const milestone = row.plannedMilestoneDate
          ? new Date(`${row.plannedMilestoneDate}T00:00:00`)
          : completion
          ? new Date(completion.getTime() - 14 * 24 * 60 * 60 * 1000)
          : null;
        if (!milestone && !completion) return null;
        const start = milestone || completion;
        const end = completion || milestone;
        if (!start || !end) return null;
        return { ...row, start, end };
      })
      .filter((r): r is NonNullable<typeof r> => Boolean(r))
      .sort((a, b) => a.end.getTime() - b.end.getTime());

    const visibleRows = rows.slice(0, 40);
    if (!visibleRows.length) return null;

    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const min = new Date(Math.min(...visibleRows.map((r) => r.start.getTime()), now.getTime()));
    const max = new Date(Math.max(...visibleRows.map((r) => r.end.getTime()), now.getTime()));
    const totalDays = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / (24 * 60 * 60 * 1000)));

    function pct(date: Date) {
      return ((date.getTime() - min.getTime()) / (24 * 60 * 60 * 1000) / totalDays) * 100;
    }

    return {
      min,
      max,
      totalDays,
      rows: visibleRows.map((r) => ({
        ...r,
        leftPct: pct(r.start),
        widthPct: Math.max(1.5, pct(r.end) - pct(r.start)),
      })),
      nowPct: pct(now),
      hiddenCount: Math.max(0, rows.length - visibleRows.length),
    };
  }, [data]);

  async function exportPoam(format: 'csv' | 'md' | 'json') {
    try {
      const token = getToken();
      const res = await fetch(`${API}/projects/${id}/poam?format=${format}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(await res.text() || 'Export failed');

      const extension = format === 'md' ? 'md' : format;
      const content = await res.text();
      const blob = new Blob([content], { type: 'text/plain' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `poam-${id}.${extension}`;
      a.click();
      setMsg(`Exported as ${extension.toUpperCase()}`);
      setMsgType('success');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Export failed');
      setMsgType('error');
    }
  }

  const sevColor = (s: string) => s === 'High' ? 'var(--danger)' : s === 'Moderate' ? 'var(--warn)' : 'var(--success)';

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1rem' }}>
        <Link href={`/projects/${id}`} className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Projects
          </span>
        </Link>
      </div>

      <div className="page-header">
        <div>
          <h1>Plan of Action &amp; Milestones</h1>
          <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
            Auto-generated from open checklist weaknesses. Export for government handoff.
          </p>
        </div>
        <div className="btn-group">
          <button className="btn btn-secondary" onClick={() => exportPoam('csv')}>CSV</button>
          <button className="btn btn-secondary" onClick={() => exportPoam('md')}>Markdown</button>
          <button className="btn btn-secondary" onClick={() => exportPoam('json')}>JSON</button>
        </div>
      </div>

      <div className="tab-bar">
        <Link href={`/projects/${id}`} className="tab-item" style={{ textDecoration: 'none' }}>Checklist</Link>
        <Link href={`/projects/${id}/auto-scope`} className="tab-item" style={{ textDecoration: 'none' }}>Auto-Scope</Link>
        <Link href={`/projects/${id}/poam`} className="tab-item active" style={{ textDecoration: 'none' }}>POA&amp;M</Link>
      </div>

      {msg && <div className={`alert alert-${msgType}`}>{msg}</div>}

      {data && (
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-value">{summary.total}</div>
            <div className="stat-label">Total Items</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{summary.high}</div>
            <div className="stat-label">High</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--warn)' }}>{summary.moderate}</div>
            <div className="stat-label">Moderate</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--success)' }}>{summary.low}</div>
            <div className="stat-label">Low</div>
          </div>
        </div>
      )}

      {gantt && (
        <div className="card" style={{ marginBottom: '1.25rem' }}>
          <div className="card-header">
            <h3 style={{ marginBottom: 0 }}>Timeline</h3>
            <div className="gap-row" style={{ gap: '0.4rem' }}>
              <span className="badge badge-red">High</span>
              <span className="badge badge-yellow">Moderate</span>
              <span className="badge badge-green">Low</span>
            </div>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--bg)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', padding: '0.55rem 0.75rem', background: 'var(--surface-raised)', borderBottom: '1px solid var(--border)', fontSize: '0.68rem', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>
              <div>Weakness</div>
              <div style={{ position: 'relative' }}>
                <span>{gantt.min.toISOString().slice(0, 10)}</span>
                <span style={{ position: 'absolute', right: 0, top: 0 }}>{gantt.max.toISOString().slice(0, 10)}</span>
              </div>
            </div>

            {gantt.rows.map((row) => (
              <div key={row.poamId} style={{ display: 'grid', gridTemplateColumns: '220px 1fr', alignItems: 'center', padding: '0.4rem 0.75rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ minWidth: 0 }}>
                  <div className="truncate" style={{ fontWeight: 600, fontSize: '0.76rem', color: 'var(--text)' }}>
                    {row.poamId} &middot; {row.weaknessSourceIdentifier}
                  </div>
                  <div className="truncate text-xs text-muted">{row.weaknessName}</div>
                </div>
                <div style={{ position: 'relative', height: 18, borderRadius: 999, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: `${row.leftPct}%`,
                      width: `${row.widthPct}%`,
                      top: 3,
                      bottom: 3,
                      borderRadius: 999,
                      background: sevColor(row.adjustedRiskRating),
                      opacity: 0.85,
                    }}
                    title={`${row.plannedMilestoneDate || '?'} → ${row.scheduledCompletionDate || '?'}`}
                  />
                  <div style={{ position: 'absolute', left: `${gantt.nowPct}%`, top: 0, bottom: 0, width: 2, background: 'var(--accent)', opacity: 0.9 }} />
                </div>
              </div>
            ))}
          </div>

          {gantt.hiddenCount > 0 && (
            <div className="text-xs text-dim mt-1">
              Showing top 40 by nearest completion ({gantt.hiddenCount} more below).
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Loading POA&amp;M...</p></div>
      ) : !data || data.rows.length === 0 ? (
        <div className="empty-state"><p>No POA&amp;M items. Items appear for non-compliant or incomplete controls.</p></div>
      ) : (
        <>
          <div className="text-xs text-dim" style={{ marginBottom: '0.5rem' }}>
            FedRAMP-style Open POA&amp;M view (RA/FP/OR/VD columns included for reviewer workflow).
          </div>
          <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 100 }}>ID</th>
                <th style={{ width: 165 }}>Weakness Source ID</th>
                <th style={{ width: 200 }}>Weakness Name</th>
                <th style={{ width: 160 }}>Detector Source</th>
                <th style={{ width: 105 }}>Orig Risk</th>
                <th style={{ width: 105 }}>Adj Risk</th>
                <th style={{ width: 70 }}>RA</th>
                <th style={{ width: 70 }}>FP</th>
                <th style={{ width: 70 }}>OR</th>
                <th style={{ width: 70 }}>VD</th>
                <th style={{ width: 110 }}>Status</th>
                <th style={{ width: 120 }}>Discovery</th>
                <th style={{ width: 120 }}>Milestone</th>
                <th style={{ width: 120 }}>Completion</th>
                <th style={{ width: 160 }}>Evidence References</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.poamId}>
                  <td style={{ fontWeight: 600, color: 'var(--text)' }}>{row.poamId}</td>
                  <td><span className="badge badge-blue">{row.weaknessSourceIdentifier}</span></td>
                  <td>
                    <div style={{ fontWeight: 500, color: 'var(--text)', marginBottom: '0.15rem', fontSize: '0.82rem' }}>{row.weaknessName}</div>
                  </td>
                  <td className="text-xs text-dim">{row.weaknessDetectorSource}</td>
                  <td><span className={`badge ${row.originalRiskRating === 'High' ? 'badge-red' : row.originalRiskRating === 'Moderate' ? 'badge-yellow' : 'badge-green'}`}>{row.originalRiskRating}</span></td>
                  <td><span className={`badge ${row.adjustedRiskRating === 'High' ? 'badge-red' : row.adjustedRiskRating === 'Moderate' ? 'badge-yellow' : 'badge-green'}`}>{row.adjustedRiskRating}</span></td>
                  <td className="text-sm">{row.riskAdjustment}</td>
                  <td className="text-sm">{row.falsePositive}</td>
                  <td className="text-sm">{row.operationalRequirement}</td>
                  <td className="text-sm">{row.vendorDependency}</td>
                  <td className="text-sm">{row.status}</td>
                  <td className="text-sm text-dim">{row.discoveryDate || '\u2014'}</td>
                  <td className="text-sm text-dim">{row.plannedMilestoneDate || '\u2014'}</td>
                  <td className="text-sm text-dim">{row.scheduledCompletionDate || '\u2014'}</td>
                  <td className="text-xs text-dim">
                    {row.evidenceReferences?.length ? row.evidenceReferences.join(', ') : '\u2014'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </div>
  );
}
