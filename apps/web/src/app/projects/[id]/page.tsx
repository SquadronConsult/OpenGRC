'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { api, API, getToken } from '@/lib/api';

type Item = {
  id: string;
  status: string;
  dueDate: string | null;
  reviewState: string | null;
  frrRequirement?: {
    processId: string;
    reqKey: string;
    statement: string;
    primaryKeyWord: string;
  };
  ksiIndicator?: {
    indicatorId: string;
    statement: string;
    controls: string[];
  };
};

const statusLabels: Record<string, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  compliant: 'Compliant',
  non_compliant: 'Non-Compliant',
};

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const [items, setItems] = useState<Item[]>([]);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'info' | 'success' | 'error'>('info');
  const [generating, setGenerating] = useState(false);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  function load() {
    api<Item[]>(`/projects/${id}/checklist`)
      .then(setItems)
      .catch(() => setItems([]));
  }

  useEffect(() => {
    load();
  }, [id]);

  const stats = useMemo(() => {
    const total = items.length;
    const compliant = items.filter((i) => i.status === 'compliant').length;
    const inProgress = items.filter((i) => i.status === 'in_progress').length;
    const notStarted = items.filter((i) => i.status === 'not_started').length;
    const nonCompliant = items.filter((i) => i.status === 'non_compliant').length;
    const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;
    return { total, compliant, inProgress, notStarted, nonCompliant, pct };
  }, [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (filter !== 'all') {
      result = result.filter((i) => i.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((i) => {
        const text = i.frrRequirement?.statement || i.ksiIndicator?.statement || '';
        const ref = i.frrRequirement ? `${i.frrRequirement.processId} ${i.frrRequirement.reqKey}` : i.ksiIndicator?.indicatorId || '';
        return text.toLowerCase().includes(q) || ref.toLowerCase().includes(q);
      });
    }
    return result;
  }, [items, filter, search]);

  async function generate() {
    setMsg('');
    setGenerating(true);
    try {
      const r = await api<{ created: number }>(
        `/projects/${id}/checklist/generate`,
        { method: 'POST', body: JSON.stringify({ includeKsi: true }) },
      );
      setMsg(`Generated ${r.created} checklist items`);
      setMsgType('success');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Error generating checklist');
      setMsgType('error');
    } finally {
      setGenerating(false);
    }
  }

  async function setStatus(itemId: string, status: string) {
    await api(`/checklist-items/${itemId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function setDueDate(itemId: string, dueDate: string) {
    try {
      await api(`/checklist-items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify({ dueDate: dueDate || null }),
      });
      setMsg('Due date updated');
      setMsgType('success');
      load();
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Failed to update due date');
      setMsgType('error');
    }
  }

  async function uploadEvidence(itemId: string, file: File | null) {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    const token = getToken();
    await fetch(`${API}/checklist-items/${itemId}/evidence`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: fd,
    });
    load();
    setMsg(`Evidence "${file.name}" uploaded`);
    setMsgType('success');
  }

  async function exportMd() {
    const token = getToken();
    const res = await fetch(`${API}/projects/${id}/export?format=md`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const text = await res.text();
    const blob = new Blob([text], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ssp-draft-${id}.md`;
    a.click();
  }

  return (
    <div className="animate-in">
      <div style={{ marginBottom: '1rem' }}>
        <Link href="/projects" className="btn-ghost" style={{ textDecoration: 'none', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
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
          <h1>Project Checklist</h1>
          <p className="text-sm text-muted" style={{ marginTop: '0.25rem' }}>
            Track compliance status, upload evidence, and export SSP drafts.
          </p>
        </div>
        <div className="btn-group">
          <button className="btn btn-primary" onClick={generate} disabled={generating}>
            {generating ? 'Generating...' : 'Generate Checklist'}
          </button>
          <button className="btn btn-secondary" onClick={exportMd}>Export Markdown</button>
        </div>
      </div>

      <div className="tab-bar">
        <Link href={`/projects/${id}`} className="tab-item active" style={{ textDecoration: 'none' }}>Checklist</Link>
        <Link href={`/projects/${id}/auto-scope`} className="tab-item" style={{ textDecoration: 'none' }}>Auto-Scope</Link>
        <Link href={`/projects/${id}/poam`} className="tab-item" style={{ textDecoration: 'none' }}>POA&amp;M</Link>
      </div>

      {msg && <div className={`alert alert-${msgType}`}>{msg}</div>}

      <div className="card" style={{ marginBottom: '1rem' }}>
        <div className="card-header" style={{ marginBottom: '0.6rem' }}>
          <h3 style={{ marginBottom: 0 }}>Evidence guidance</h3>
          <span className="badge badge-blue">What to upload</span>
        </div>
        <p className="text-sm text-muted" style={{ marginBottom: '0.45rem' }}>
          Evidence is proof that a control is implemented and operating. Upload artifacts that an auditor can review.
        </p>
        <div className="gap-row">
          <span className="badge">Policy / SOP PDFs</span>
          <span className="badge">Screenshots</span>
          <span className="badge">Config exports</span>
          <span className="badge">Scan results</span>
          <span className="badge">Logs / reports</span>
          <span className="badge">Ticket history</span>
        </div>
        <p className="text-xs text-dim mt-1">
          Tip: include date range and system scope in filenames for easier audits.
        </p>
      </div>

      {items.length > 0 && (
        <>
          <div style={{ marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <span className="text-sm text-muted">Overall compliance</span>
              <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--success)' }}>{stats.pct}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-bar-fill" style={{ width: `${stats.pct}%` }} />
            </div>
          </div>

          <div className="stats-row">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{stats.compliant}</div>
              <div className="stat-label">Compliant</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--accent)' }}>{stats.inProgress}</div>
              <div className="stat-label">In Progress</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--danger)' }}>{stats.nonCompliant}</div>
              <div className="stat-label">Non-Compliant</div>
            </div>
          </div>
        </>
      )}

      {items.length > 0 && (
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <input
            className="form-input"
            style={{ maxWidth: 280, fontSize: '0.82rem' }}
            placeholder="Search requirements..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="btn-group">
            {['all', 'not_started', 'in_progress', 'compliant', 'non_compliant'].map((s) => (
              <button
                key={s}
                className={filter === s ? 'btn btn-primary' : 'btn btn-secondary'}
                onClick={() => setFilter(s)}
                style={{ fontSize: '0.7rem', padding: '0.3rem 0.6rem' }}
              >
                {s === 'all' ? `All (${stats.total})` : `${statusLabels[s]} (${items.filter((i) => i.status === s).length})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Reference</th>
                <th>Requirement</th>
                <th style={{ width: 140 }}>Status</th>
                <th style={{ width: 170 }}>Due Date</th>
                <th style={{ width: 120 }}>Evidence</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text)' }}>
                      {i.frrRequirement
                        ? `${i.frrRequirement.processId}`
                        : i.ksiIndicator?.indicatorId}
                    </div>
                    <div className="text-xs text-dim" style={{ marginTop: '0.1rem' }}>
                      {i.frrRequirement?.reqKey || ''}
                    </div>
                    <span className={`badge ${i.frrRequirement ? 'badge-blue' : 'badge-yellow'}`} style={{ marginTop: '0.25rem' }}>
                      {i.frrRequirement?.primaryKeyWord || 'KSI'}
                    </span>
                  </td>
                  <td>
                    <div style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text-secondary)' }}>
                      {i.frrRequirement?.statement || i.ksiIndicator?.statement}
                    </div>
                  </td>
                  <td>
                    <select
                      className="status-select"
                      value={i.status}
                      onChange={(e) => setStatus(i.id, e.target.value)}
                    >
                      <option value="not_started">Not Started</option>
                      <option value="in_progress">In Progress</option>
                      <option value="compliant">Compliant</option>
                      <option value="non_compliant">Non-Compliant</option>
                    </select>
                  </td>
                  <td>
                    <input
                      className="form-input"
                      type="date"
                      value={i.dueDate ? new Date(i.dueDate).toISOString().slice(0, 10) : ''}
                      onChange={(e) => setDueDate(i.id, e.target.value)}
                      style={{ maxWidth: '155px', fontSize: '0.78rem', padding: '0.35rem 0.5rem' }}
                    />
                  </td>
                  <td>
                    <label className="file-upload-label">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                      Upload
                      <input type="file" onChange={(e) => uploadEvidence(i.id, e.target.files?.[0] || null)} />
                    </label>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p>No checklist items yet. Click &quot;Generate Checklist&quot; to create them from FRMR data.</p>
        </div>
      ) : (
        <div className="empty-state">
          <p>No items match your current filter.</p>
        </div>
      )}
    </div>
  );
}
