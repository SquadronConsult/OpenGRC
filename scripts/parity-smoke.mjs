/* eslint-disable no-console */
const API_URL = process.env.API_URL || 'http://localhost:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@localhost';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';

async function call(path, init = {}) {
  const res = await fetch(`${API_URL}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${path}: ${body}`);
  }
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return res.json();
  return res.text();
}

async function run() {
  const login = await call('/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const token = login.access_token;
  const auth = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };

  const project = await call('/projects', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      name: `Parity Smoke ${Date.now()}`,
      pathType: '20x',
      impactLevel: 'Moderate',
      actorLabels: 'Cloud Service Provider',
      complianceStartDate: '2026-03-18',
    }),
  });

  const generated = await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ includeKsi: true }),
  });

  const checklist = await call(`/projects/${project.id}/checklist`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!Array.isArray(checklist) || checklist.length === 0) {
    throw new Error('Checklist was not generated');
  }

  const firstItemId = checklist[0].id;
  await call(`/checklist-items/${firstItemId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ status: 'in_progress' }),
  });

  const findings = await call('/findings', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      checklistItemId: firstItemId,
      title: 'Smoke finding',
      description: 'Created by parity smoke test',
      severity: 'low',
    }),
  });

  await call('/comments', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      checklistItemId: firstItemId,
      body: 'Smoke comment',
    }),
  });

  const exported = await call(`/projects/${project.id}/export?format=md`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (typeof exported !== 'string' || !exported.includes('# SSP draft')) {
    throw new Error('Export markdown failed validation');
  }

  console.log(
    `OK project=${project.id} generated=${generated.created} checklist=${checklist.length} finding=${findings.id}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
