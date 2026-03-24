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

Copy sections of *this* guide into your SSP appendices or onboarding wiki—the Markdown is yours.`,
    },
  ],
};
