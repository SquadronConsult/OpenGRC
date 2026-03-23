'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

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

const impactColors: Record<string, string> = {
  low: 'badge-green',
  moderate: 'badge-yellow',
  high: 'badge-red',
};

export default function ProjectsPage() {
  const router = useRouter();
  const [list, setList] = useState<Project[]>([]);
  const [name, setName] = useState('My CSP');
  const [pathType, setPathType] = useState<'20x' | 'rev5'>('20x');
  const [impact, setImpact] = useState<'low' | 'moderate' | 'high'>('moderate');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [showForm, setShowForm] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [creating, setCreating] = useState(false);

  function load() {
    api<Project[]>('/projects')
      .then(setList)
      .catch(() => setList([]));
  }

  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setInfo('');
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
      setShowForm(false);
      setName('My CSP');
      load();
      if (created.checklistInitWarning) {
        try {
          sessionStorage.setItem(CHECKLIST_INIT_WARNING_KEY, created.checklistInitWarning);
          router.push(`/projects/${created.id}`);
        } catch {
          setInfo(created.checklistInitWarning);
        }
        return;
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  async function removeProject(id: string, projectName: string) {
    const ok = window.confirm(`Delete "${projectName}"? This removes all associated data.`);
    if (!ok) return;
    setErr('');
    setDeletingId(id);
    try {
      await api(`/projects/${id}`, { method: 'DELETE' });
      setList((prev) => prev.filter((p) => p.id !== id));
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed to delete project');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="animate-in">
      <div className="page-header">
        <div>
          <h1>Projects</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            Manage FedRAMP compliance projects with auto-generated checklists, due dates, and POA&amp;M tracking.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {showForm && (
        <div className="card animate-in" style={{ marginBottom: '1.5rem' }}>
          <h3>Create new project</h3>
          <p className="text-sm text-muted mb-2">
            A checklist with suggested due dates will be auto-generated based on the impact level and compliance start date.
          </p>
          <form onSubmit={create}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Project name</label>
                <input
                  className="form-input"
                  style={{ maxWidth: '100%' }}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. My Cloud System"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">FedRAMP Path</label>
                <select
                  className="form-select"
                  style={{ maxWidth: '100%' }}
                  value={pathType}
                  onChange={(e) => setPathType(e.target.value as '20x' | 'rev5')}
                >
                  <option value="20x">FedRAMP 20x</option>
                  <option value="rev5">Rev 5</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Impact Level</label>
                <select
                  className="form-select"
                  style={{ maxWidth: '100%' }}
                  value={impact}
                  onChange={(e) => setImpact(e.target.value as 'low' | 'moderate' | 'high')}
                >
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Compliance Start Date</label>
                <input
                  className="form-input"
                  type="date"
                  style={{ maxWidth: '100%' }}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={creating}>
              {creating ? 'Creating...' : 'Create Project'}
            </button>
          </form>
        </div>
      )}

      {info && <div className="alert alert-info">{info}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      {list.length === 0 ? (
        <div className="empty-state">
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <p>No projects yet. Create one to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {list.map((p) => (
            <div
              key={p.id}
              className="card card-interactive"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0, padding: '1rem 1.25rem' }}
            >
              <Link
                href={`/projects/${p.id}`}
                style={{ textDecoration: 'none', color: 'inherit', flex: 1, minWidth: 0 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: 40, height: 40, borderRadius: 'var(--radius)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>{p.name}</div>
                    <div className="gap-row" style={{ marginTop: '0.3rem', gap: '0.4rem' }}>
                      <span className="badge badge-blue">{p.pathType}</span>
                      <span className={`badge ${impactColors[p.impactLevel] || ''}`}>{p.impactLevel}</span>
                    </div>
                  </div>
                </div>
              </Link>
              <button
                type="button"
                className="btn btn-danger"
                style={{ marginLeft: '1rem', fontSize: '0.74rem', padding: '0.35rem 0.7rem' }}
                disabled={deletingId === p.id}
                onClick={() => removeProject(p.id, p.name)}
              >
                {deletingId === p.id ? '...' : 'Delete'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
