# OpenGRC

OpenGRC helps you move from compliance chaos to audit-ready outputs fast.

**Status:** This project is still in development. Features, APIs, and defaults may change between releases.

It is a local-first FedRAMP workspace that combines:
- machine-readable control baselines,
- continuous evidence mapping,
- guided gap closure,
- and AI-agent automation through MCP.

If you need to stand up a practical FedRAMP program without buying a heavyweight platform, this is built for you.

## Why OpenGRC

- **Start fast:** run locally with Docker in minutes.
- **Stay in control:** your data stays on your machine or self-hosted environment.
- **Work like auditors think:** checklist, evidence, POA&M, and SSP flow in one place.
- **Automate smartly:** MCP tools let AI agents discover gaps, recommend fixes, and produce machine-readable outputs.

## What You Can Do

- Ingest FRMR data (local file or remote source)
- Generate project baselines by path type and impact
- Track checklist status and due dates
- Attach evidence directly to controls
- Run recommendation-first auto-scoping
- Generate POA&M with timeline view
- Export OSCAL SSP + OSCAL POA&M JSON
- Use MCP autopilot to drive end-to-end compliance workflows

## Get Started (5 Minutes)

### 1) Prerequisites

- Node.js 20+
- Docker Desktop (or compatible Docker Engine + Compose)

### 2) Launch (split dev: API + Web)

From repo root:

```bash
copy .env.example .env
# Set SEED_ADMIN_PASSWORD (8+ chars) and AUTH_JWT_SECRET in .env
docker compose up --build
```

Open:
- Web UI: `http://localhost:3001` — sign in with the seeded admin (`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`)
- API: `http://localhost:3000`

### 2b) Single-container (Postgres + API + Web)

```bash
docker compose -f docker-compose.all-in-one.yml up --build
```

- Web UI: `http://localhost:8080` (Next proxies API traffic via `/api/*`)

Set `BOOTSTRAP_TOKEN` (and `AUTH_JWT_SECRET`) in the environment for first-admin bootstrap, or rely on optional `SEED_ADMIN_PASSWORD` for an auto-seeded admin when the database is empty.

### 3) First Success Path

1. Create a new project in **Projects**
2. Let OpenGRC generate the checklist baseline
3. Update a few checklist items and attach evidence
4. Run **Auto-Scope** to generate applicability recommendations
5. Open **POA&M** and review generated milestones
6. Export artifacts for handoff (CSV/Markdown/JSON/OSCAL)

## AI Agent Mode (MCP)

OpenGRC includes a localhost MCP endpoint so Cursor/Claude-style agents can:
- inventory repo and environment context,
- map gaps to FRMR/20x targets,
- propose or apply remediation steps,
- sync evidence,
- and produce OSCAL deliverables.

### One-command MCP setup

```bash
npm run cursor:deploy
```

Key URL:
- `http://127.0.0.1:3334/mcp`

Recommended agent flow:
1. `mcp_capabilities_v1`
2. `frmr_taxonomy_v1` (`pathType: "20x"`)
3. `gap_closure_execution_brief_v1`
4. `compliance_agent_autopilot_v1` (`executionMode: "apply"`)
5. `fedramp_oscal_report_v1`

Full MCP details: `docs/MCP_SERVER.md`

## Deployment Options

- **Local / self-hosted (recommended):** `docker compose up --build`
- **Production-style compose:** see `docker-compose.prod.yml` and `docs/PRODUCTION.md`
- **Desktop mode (optional):** see `docs/DESKTOP.md`

## Useful Commands

```bash
npm run build
npm run test:parity
npm run test:e2e
npm run test:autoscope
npm run test:mcp
```

`test:e2e` expects the API at `API_URL` (default `http://localhost:3000`). It exercises versions, project bootstrap, POA&M sync, and evidence-gap reporting.

Agent-oriented notes (API conventions, MCP, migrations): see `AGENTS.md`. Local diagnostics UI: **Local ops** in the sidebar (`/ops`).

## Notes

- OpenGRC supports compliance workflows; it does not grant authorization by itself.
- FedRAMP decisions remain with assessors and authorizing officials.
- Keep secrets out of source control; use environment variables.

## Docs

- `AGENTS.md` (AI coding agents and API conventions)
- `docs/PRODUCTION.md`
- `docs/AUTO_SCOPING.md`
- `docs/MCP_SERVER.md`
- `docs/BACKUP.md`
- `docs/DESKTOP.md`

## License

Apache-2.0 - see `LICENSE`.

