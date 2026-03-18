# OpenGRC

OpenGRC is an open-source, local-first Governance, Risk, and Compliance platform designed around FedRAMP workflows, FedRAMP 20x intent, and AI-assisted compliance operations.

The platform is built to help teams:
- ingest FedRAMP machine-readable content (FRMR),
- generate project-specific checklist baselines,
- collect and link evidence continuously,
- run auto-scoping and applicability recommendations,
- export machine-readable compliance artifacts,
- and use MCP-enabled AI agents to close gaps, report compliance, and package outputs for FedRAMP review teams.

---

## Core Capabilities

- **Local-first operation** (SQLite + local evidence files)
- **Docker-first deployment** for teams/self-hosting
- **FedRAMP FRMR ingestion** (local file or remote fetch)
- **Checklist generation** by path and impact level
- **Evidence management** at control/checklist-item level
- **Auto-Scoping wizard** (repo/IaC/cloud metadata or live SDK checks)
- **POA&M generation + visual timeline (Gantt)**
- **OSCAL SSP + OSCAL POA&M JSON export**
- **FedRAMP-style POA&M export columns** (RA/FP/OR/VD structure)
- **MCP server integration** for Cursor/Claude workflows
- **20x-aligned autopilot flow** for AI-assisted gap closure and evidence refresh

---

## Architecture

Monorepo apps:
- `apps/api` - NestJS API + TypeORM + SQLite
- `apps/web` - Next.js UI
- `apps/desktop` - Electron wrapper (optional local desktop mode)
- `apps/mcp-server` - MCP runtime/tools

Key runtime storage:
- Database: SQLite (`grc.sqlite`)
- Evidence: local filesystem directory

---

## Prerequisites

- **Node.js 20+**
- **Docker Desktop** (or compatible Docker Engine + Compose)

Windows PowerShell is supported. Use `docker compose` (not legacy `docker-compose` unless your environment uses it).

---

## Quick Start (Recommended)

From repo root:

```bash
copy .env.example .env
docker compose up --build
```

Open:
- Web UI: `http://localhost:3001`
- API: `http://localhost:3000`

Default auth mode is local (no login required):
- `AUTH_MODE=local`
- `NEXT_PUBLIC_AUTH_MODE=local`

### Fast local development launch

If you want the stack plus MCP development tooling available quickly:

```bash
copy .env.example .env
docker compose up --build
npm run mcp:daemon:start
```

This gives you:
- Web UI on `http://localhost:3001`
- API on `http://localhost:3000`
- host MCP endpoint on `http://127.0.0.1:3334/mcp`

---

## First Use Workflow

1. Open **Projects** and create a project.
2. Checklist is generated automatically with suggested due dates.
3. Open the project checklist and:
   - update status,
   - edit due dates inline,
   - upload evidence (policies, screenshots, scan outputs, logs, etc.).
4. (Optional) run **Auto-Scope** wizard to generate applicability recommendations.
5. Open **POA&M** tab to review FedRAMP-style rows and timeline.
6. Export POA&M as CSV/Markdown/JSON.

---

## Launch Modes

### 1) Docker (team/self-hosting)

Dev-style stack:

```bash
docker compose up --build
```

Services:
- `api` on `:3000`
- `web` on `:3001`
- `mcp` container for MCP parity tooling

### 2) Production-style compose

Use `docker-compose.prod.yml` and set secure env values.
See: `docs/PRODUCTION.md`

### 3) Desktop mode (optional)

```bash
cd apps/api && npm install && npm run build
cd ../web && npm install && npm run build
cd ../desktop && npm install && npm run start
```

See: `docs/DESKTOP.md`

---

## Configuration

Primary config lives in `.env` (copy from `.env.example`).

Important variables:
- `JWT_SECRET`
- `AUTH_MODE` (`local` or `multiuser`)
- `NEXT_PUBLIC_AUTH_MODE`
- `NEXT_PUBLIC_API_URL`
- `INTEGRATION_API_KEY`
- FRMR options (`FRMR_*`)
- Auto-scope options (`AUTO_SCOPE_*`, cloud hints if needed)

Reference: `.env.example`

---

## FedRAMP / POA&M Usage Notes

OpenGRC exports a FedRAMP-style POA&M dataset suitable for reviewer workflows, including:
- weakness metadata,
- detector/source identifiers,
- original/adjusted risk,
- RA/FP/OR/VD-style fields,
- discovery/status/milestone/completion dates,
- evidence references.

POA&M endpoints:
- `GET /projects/:id/poam?format=json`
- `GET /projects/:id/poam?format=csv`
- `GET /projects/:id/poam?format=md`
- `GET /projects/:id/export?format=oscal-ssp`
- `GET /projects/:id/poam?format=oscal-poam`

The UI POA&M tab includes:
- structured FedRAMP-style table view,
- visual Gantt timeline for milestone/completion planning.

---

## Auto-Scoping

Auto-scoping is recommendation-first:
- gathers repo/IaC/cloud facts,
- computes applicability recommendations,
- requires review approval before applying scope decisions.

Key API endpoints:
- `POST /projects/:projectId/auto-scope/preflight`
- `POST /projects/:projectId/auto-scope/run`
- `GET /projects/:projectId/auto-scope/recommendations`
- approve/reject/bulk approve endpoints

See: `docs/AUTO_SCOPING.md`

---

## Evidence Upload and Meaning

Evidence is auditable proof that a control is implemented and operating.

Examples:
- policy/SOP documents,
- configuration exports,
- screenshots,
- vulnerability scan results,
- logs/reports,
- change tickets.

Best practice:
- include date range + scope in file names,
- keep evidence mapped to the specific checklist item/control.

---

## MCP / Cursor / Claude Integration

OpenGRC exposes a localhost HTTP MCP endpoint so AI tools can:
- inspect repository state,
- map gaps to FRMR / 20x-oriented targets,
- propose or apply remediations,
- push evidence into OpenGRC,
- rerun auto-scope,
- and export machine-readable FedRAMP review artifacts.

One-click setup:

```bash
npm run cursor:deploy
```

This:
- starts Docker services,
- starts MCP daemon,
- writes Cursor MCP config.

Useful scripts:
- `npm run cursor:connect`
- `npm run mcp:daemon:start`
- `npm run mcp:daemon:stop`
- `npm run mcp:daemon:status`

MCP URL:
- `http://127.0.0.1:3334/mcp`

Full details: `docs/MCP_SERVER.md`

Recommended AI agent workflow:

1. call `mcp_capabilities_v1`
2. call `frmr_taxonomy_v1` with `pathType: "20x"`
3. call `gap_closure_execution_brief_v1`
4. call `compliance_agent_autopilot_v1` with `executionMode: "apply"`
5. call `fedramp_oscal_report_v1`

### MCP development workflow

When developing MCP behavior itself:

1. Start app services:
   - `docker compose up --build`
2. Start or restart the host MCP daemon:
   - `npm run mcp:daemon:start`
   - `npm run mcp:daemon:stop`
3. Run MCP smoke validation:
   - `npm run test:mcp`
4. If Cursor does not show new tools, restart the daemon and reconnect Cursor to:
   - `http://127.0.0.1:3334/mcp`

The MCP runtime is host-run for workspace access, while the application services continue to run in Docker.

---

## Development Commands

Root scripts:

```bash
npm run dev:api
npm run dev:web
npm run dev:mcp
npm run dev:desktop
```

Build:

```bash
npm run build
npm run build:desktop
```

Smoke tests:

```bash
npm run test:parity
npm run test:autoscope
npm run test:mcp
```

---

## Backup and Restore

See: `docs/BACKUP.md`

Quick examples:

```bash
docker compose cp api:/app/local-data/grc.sqlite ./grc.sqlite.backup
docker compose cp api:/app/evidence ./evidence-backup
```

---

## Troubleshooting

### Web/API not reachable
- Check containers: `docker compose ps`
- Rebuild: `docker compose up -d --build`

### PowerShell `curl` behaves oddly
- In PowerShell, `curl` maps to `Invoke-WebRequest`.
- Use `Invoke-RestMethod` or a real curl binary syntax carefully.

### Login page appears but local mode expected
- Ensure:
  - `AUTH_MODE=local`
  - `NEXT_PUBLIC_AUTH_MODE=local`
- Rebuild web container after env changes.

### Auto-scope live mode fails
- Run preflight in UI first.
- Validate cloud credentials/permissions.
- Start with metadata mode to confirm baseline functionality.

### POA&M appears empty
- POA&M rows are generated from non-compliant/incomplete checklist items.
- Mark some checklist items not compliant/in progress and ensure due dates exist.

---

## Security and Compliance Notes

- This tool supports compliance workflows; it does **not** grant authorization by itself.
- FedRAMP requirements and agency decisions remain authoritative.
- Avoid storing secrets in source control; use environment variables/secret managers where possible.

---

## Documentation Index

- `docs/PRODUCTION.md`
- `docs/BACKUP.md`
- `docs/DESKTOP.md`
- `docs/AUTO_SCOPING.md`
- `docs/MCP_SERVER.md`

---

## License

Apache-2.0 - see `LICENSE`.

