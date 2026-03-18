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
      name: `AutoScope Smoke ${Date.now()}`,
      pathType: '20x',
      impactLevel: 'moderate',
      actorLabels: 'CSO,CSX',
      complianceStartDate: '2026-03-18',
    }),
  });

  await call(`/projects/${project.id}/checklist/generate`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ includeKsi: true }),
  });

  const runResult = await call(`/projects/${project.id}/auto-scope/run`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      connectors: { repo: true, iac: true, aws: true, azure: true, gcp: true },
    }),
  });
  if (!runResult.runId || runResult.generatedRecommendations <= 0) {
    throw new Error('Auto-scope run did not generate recommendations');
  }

  const recs = await call(
    `/projects/${project.id}/auto-scope/recommendations?status=pending_review`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  if (!Array.isArray(recs.items) || recs.items.length === 0) {
    throw new Error('No pending recommendations returned');
  }

  const firstRec = recs.items[0];
  await call(
    `/projects/${project.id}/auto-scope/recommendations/${firstRec.id}/approve`,
    {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({ notes: 'smoke approve' }),
    },
  );

  const checklist = await call(`/projects/${project.id}/checklist`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!checklist.some((x) => x.reviewState === 'scoped_approved')) {
    throw new Error('Checklist item reviewState not updated after approval');
  }

  console.log(
    `OK project=${project.id} runId=${runResult.runId} pending=${recs.items.length}`,
  );
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
