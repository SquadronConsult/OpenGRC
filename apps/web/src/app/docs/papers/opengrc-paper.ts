import type { DocPaper } from './types';

export const openGrcPaper: DocPaper = {
  slug: 'opengrc',
  title: 'OpenGRC — Product guide',
  subtitle:
    'A linear reference for the application: how to move through the UI, how auth and APIs behave, and where to plug in automation.',
  preamble: `This guide is written like a short technical white paper. Read top to bottom, or jump using the outline. Every **Copy** control exports Markdown you can paste into Confluence, Notion, or a git repo.`,

  sections: [
    {
      id: 'what-this-tool-is',
      title: 'What this tool is',
      body: `OpenGRC is a browser workspace for **FedRAMP-style** compliance work: projects hold checklists tied to catalog requirements, evidence, POA&M-style tracking, policies, risks, and exports (including OSCAL-oriented flows where the API supports them). It is not a cloud scanner by itself—it organizes *your* program and connects to automation (including MCP) where you configure it.

**Typical first session**

1. Sign in (or complete forced password change if your admin seeded the first user).
2. Open **Projects** and create or select a project for the system you are assessing.
3. Use **Requirements** / **Glossary** from the sidebar for shared language while you map work.
4. Attach evidence to checklist rows and use gap views before an assessment.

> **Tip:** Keep one authoritative project per authorization boundary. Spin secondary projects for experiments or sandboxes so evidence does not get mixed.`,
    },

    {
      id: 'workspace-map',
      title: 'How the workspace is organized',
      body: `The left sidebar groups capabilities:

| Area | Purpose |
|------|---------|
| **Projects** | Your day-to-day container: checklist, evidence, POA&M sync, snapshots, imports. |
| **MCP Connect** | Generate or paste config to wire Cursor (or other MCP clients) to this API. |
| **Ops** | API/schema versions, paths, backup hooks (when enabled), DB mode. |
| **FedRAMP data** | Glossary, Requirements, KSIs — reference material shared across projects. |
| **GRC** | Policies, framework builder, registers that span projects. |

### Example: deep-linking mental model

If you are documenting runbooks for your team, use paths like:

\`\`\`text
/projects          → pick or create a project
/projects/[id]     → checklist & evidence for that boundary
/requirements      → browse catalog / controls
/mcp               → MCP configuration
/ops               → health & operations
\`\`\`

Replace \`[id]\` with the project UUID from the URL bar after you open it.`,
    },

    {
      id: 'authentication',
      title: 'Authentication & sessions',
      body: `The API accepts either a **Bearer JWT** in \`Authorization\` or an **httpOnly session cookie** (name configured via \`AUTH_COOKIE_NAME\`, default \`grc_session\`). The web UI may keep a token in \`sessionStorage\` during cross-origin development; in production prefer same-origin \`/api\` rewrites so cookies flow naturally.

### Example: obtain a token (curl)

\`\`\`bash
# Adjust host/port to your API (direct or via Next proxy).
curl -sS -X POST "http://localhost:3000/auth/login" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@localhost","password":"YOUR_PASSWORD"}'
\`\`\`

A successful response includes \`token\` and \`user\` (including \`mustChangePassword\` when you must rotate the seeded password). Use **Change password** in the UI or \`POST /auth/change-password\` with the bearer token.

### Example: call an authenticated endpoint

\`\`\`bash
curl -sS "http://localhost:3000/health" \\
  -H "Authorization: Bearer YOUR_JWT_HERE"
\`\`\`

Empty database + \`SEED_ADMIN_PASSWORD\` (≥ 8 characters) creates the first admin once; set strong secrets (\`AUTH_JWT_SECRET\`, etc.) before any real deployment.`,
    },

    {
      id: 'api-conventions',
      title: 'API conventions',
      body: `All REST routes live on the API base URL. Mutating requests should carry a **correlation ID** so audits and support traces line up.

### Example: correlation header

\`\`\`bash
curl -sS -X POST "http://localhost:3000/projects" \\
  -H "Authorization: Bearer YOUR_JWT_HERE" \\
  -H "Content-Type: application/json" \\
  -H "x-correlation-id: $(uuidgen || python -c 'import uuid; print(uuid.uuid4())')" \\
  -d '{"name":"Example system","description":"Demo project"}'
\`\`\`

Version and schema information appear on \`GET /health\`; operational detail (paths, DB mode, FRMR) is on \`GET /health/ops\` (see **Ops** in the app).

> For a full list of workflow hooks (POA&M sync, snapshots, OSCAL import, gaps), read \`AGENTS.md\` in the repository—that file tracks the evolving API surface.`,
    },

    {
      id: 'grc-modules',
      title: 'GRC modules',
      body: `Beyond the checklist, OpenGRC ships several in-app modules that cover the full GRC lifecycle. Each is scoped to a project (authorization boundary).

### Risks

A full risk register with likelihood/impact scoring, inherent and residual risk calculation, and treatment tracking.

- Create risks, link them to checklist items or internal controls as mitigations.
- Risk acceptance workflow: submit for approval, step-by-step review, documented approval or rejection.
- Risk heatmap visualization at \`GET /reports/risk-posture?projectId=...\`.

### Policies

Policy lifecycle management: draft → in review → approved → published → retired.

- **Versioning:** each publish creates a snapshot. View history at \`GET /policies/:id/versions\`.
- **Attestation:** request sign-offs from personnel via \`POST /policies/:id/attest/request\`, then collect responses. Tracks who attested and when.
- **Control mappings:** link policies to catalog requirements or internal controls via \`POST /policies/:id/control-mappings\`.
- The policy cron schedules attestation reminders automatically.

### Audits

Track internal audits, external assessments, and 3PAO engagements.

- Audit types: \`internal\`, \`external\`, \`3pao\`.
- Statuses: \`planned\` → \`fieldwork\` → \`draft_report\` → \`final_report\` → \`closed\`.
- Record **findings** (severity P1–P4, status open/remediation/closed/risk_accepted) and **evidence requests** against each audit.

### Vendors

Third-party vendor inventory and assessment tracking — critical for supply chain and inherited controls.

- Register vendors with category and criticality.
- Record periodic assessments with results and notes.
- Vendor-control mappings link vendors to the internal controls they support.

### Incidents

Incident tracking scoped to the authorization boundary.

- Severity levels: P1 (critical) through P4 (informational).
- Link incidents to affected controls for root-cause feedback into your gap analysis.

### Assets

Asset inventory for the authorization boundary.

- Track assets scoped to projects.
- Asset-control mappings link inventory items to the controls that protect them.

### Internal controls & cross-framework mapping

**Internal controls** are your organization's control implementations — the "how we do it" mapped to the "what the framework requires."

- Create internal controls with code, title, and description.
- Map them to catalog requirements from any framework (FedRAMP, NIST CSF 2.0, SOC 2, ISO 27001, CMMC 2.0, HIPAA).
- **Cross-framework mapping** at \`GET /catalog/cross-map?sourceFramework=...&targetFramework=...\` shows which internal controls satisfy requirements across multiple frameworks — build evidence once, map it everywhere.

### Reports & exports

| Report | Endpoint | Output |
|--------|---------|--------|
| Compliance summary | \`GET /reports/compliance-summary\` | KPIs: readiness %, control counts, status breakdown |
| Risk posture | \`GET /reports/risk-posture\` | Risk heatmap with scoring |
| Executive briefing | \`GET /reports/executive-briefing\` | Combined summary + heatmap for leadership |
| OSCAL SSP | \`GET /projects/:id/export?format=oscal-ssp\` | Machine-readable system security plan |
| OSCAL POA&M | \`GET /projects/:id/poam?format=oscal-poam\` | Machine-readable plan of action |
| OSCAL Assessment Plan | \`GET /projects/:id/export?format=oscal-ap\` | Assessment methodology and scope |
| OSCAL Assessment Results | \`GET /projects/:id/export?format=oscal-ar\` | Findings and determinations |
| JSON/Markdown/CSV | \`GET /projects/:id/export\` or \`/poam\` | Flexible formats for sharing |

### Search

Unified search across checklist items, evidence, risks, and policies: \`GET /search?q=...&types=checklist,evidence,risk,policy\`.

### Dashboard

Project dashboards show readiness %, compliance trends (from snapshots), upcoming deadlines, evidence freshness heatmap, and continuous monitoring summary. Compliance snapshot cron captures posture metrics on a schedule for trend analysis.`,
    },

    {
      id: 'mcp-and-automation',
      title: 'MCP & automation',
      body: `The **MCP server** exposes tools that call the same API the UI uses. Configure base URL, token, and tool allowlists from **MCP Connect** (\`/mcp\`).

### Example: env block for local MCP (conceptual)

\`\`\`bash
OPENGRC_API_URL=http://localhost:3000
OPENGRC_API_TOKEN=eyJhbGciOi...
# Optional: paths from docs/MCP_SERVER.md for your client
\`\`\`

After changes, restart your MCP host (Cursor, Claude Desktop, etc.). Prefer least-privilege tokens and rotate them on the same schedule as interactive users.`,
    },

    {
      id: 'operations',
      title: 'Operations, backups, and databases',
      body: `**SQLite** is common in local dev with schema sync enabled. **Postgres** backs production-style and Docker deployments; set \`DB_SYNC=false\` and run migrations for real environments.

### Example: check ops JSON

\`\`\`bash
curl -sS "http://localhost:3000/health/ops" \\
  -H "Authorization: Bearer YOUR_JWT_HERE" | jq .
\`\`\`

Backups via \`POST /health/backup\` apply to SQLite deployments (see \`AGENTS.md\`). Review \`docs/PRODUCTION.md\` and \`README.md\` for Docker and secret management.`,
    },

    {
      id: 'repository-map',
      title: 'Repository map (offline reading)',
      body: `When you need depth beyond this page:

| File | Contents |
|------|----------|
| \`README.md\` | Quick start, Docker, ports |
| \`AGENTS.md\` | Auth, API hooks, MCP, testing |
| \`docs/MCP_SERVER.md\` | Tool names and environment variables |
| \`ARCHITECTURE.md\` | Nest API, Next.js UI, MCP layout |
| \`docs/PRODUCTION.md\` | Hardening and deployment notes |
| \`docs/CONTROLS_PROGRAM.md\` | Controls program playbook (FedRAMP 20x best practices, automation) |
| \`docs/AUTO_SCOPING.md\` | Auto-scoping endpoints and review workflow |

Copy sections of *this* guide into your SSP appendices or onboarding wiki—the Markdown is yours.`,
    },
  ],
};
