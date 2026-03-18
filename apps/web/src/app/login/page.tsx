'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { API, IS_LOCAL_AUTH_MODE } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('admin@localhost');
  const [password, setPassword] = useState('changeme');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  if (IS_LOCAL_AUTH_MODE) {
    return (
      <div className="animate-in" style={{ display: 'flex', justifyContent: 'center', marginTop: '5rem' }}>
        <div className="card" style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius)', background: 'var(--accent-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.75rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2>Local mode is active</h2>
          <p className="text-sm text-muted" style={{ marginTop: '0.5rem' }}>
            Login is disabled in local mode. You can jump directly into projects.
          </p>
          <div className="btn-group mt-2" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => router.push('/projects')}>
              Open Projects
            </button>
          </div>
          <p className="text-xs text-dim" style={{ marginTop: '1rem' }}>
            Set <code>AUTH_MODE=multiuser</code> to enable login.
          </p>
        </div>
      </div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Login failed');
      localStorage.setItem('grc_token', data.access_token);
      router.push('/projects');
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', justifyContent: 'center', marginTop: '5rem' }}>
      <div className="card" style={{ maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: 48, height: 48, borderRadius: 'var(--radius)', background: 'var(--accent-subtle)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '0.5rem' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h2>Sign in to OpenGRC</h2>
          <p className="text-sm text-muted" style={{ marginTop: '0.35rem' }}>
            Multi-user mode &middot; enter your credentials
          </p>
        </div>

        <form onSubmit={submit}>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={{ maxWidth: '100%' }} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={{ maxWidth: '100%' }} />
          </div>
          {err && <div className="alert alert-error">{err}</div>}
          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="text-xs text-dim" style={{ marginTop: '1.25rem', textAlign: 'center' }}>
          Default: admin@localhost / changeme
        </p>
      </div>
    </div>
  );
}
