import Link from 'next/link';
import McpConnectCard from '@/components/McpConnectCard';

export default function Home() {
  return (
    <div className="animate-in" style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <div style={{ width: 44, height: 44, borderRadius: 'var(--radius)', background: 'var(--accent-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 style={{ fontSize: '2rem', margin: 0, lineHeight: 1.2 }}>OpenGRC</h1>
        </div>
        <p className="page-desc" style={{ marginBottom: 0, maxWidth: 540 }}>
          Open-source FedRAMP compliance workspace. Ingest machine-readable
          documentation, auto-scope controls, track evidence, and export
          government-ready POA&amp;M and SSP drafts.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--accent)', fontSize: '1.3rem' }}>FRMR</div>
          <div className="stat-label">Machine-readable source</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)', fontSize: '1.3rem' }}>Local-first</div>
          <div className="stat-label">Self-hosted &middot; no cloud required</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warn)', fontSize: '1.3rem' }}>POA&amp;M</div>
          <div className="stat-label">Auto-generated milestones</div>
        </div>
      </div>

      <div className="btn-group" style={{ marginBottom: '2.5rem' }}>
        <Link href="/projects" className="btn btn-primary">
          Open Projects
        </Link>
      </div>

      <div className="divider" />

      <McpConnectCard />
    </div>
  );
}
