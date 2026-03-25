# OpenGRC

OpenGRC helps you move from compliance chaos to audit-ready outputs fast.

**Status:** This project is still in development. Features, APIs, and defaults may change between releases.

It is a **local-first GRC workspace** built around a **generic control catalog** (frameworks, releases, controls, and requirements). The deepest packaged program today is **FedRAMP** via **FRMR** (Requirements Management Repository): machine-readable baselines, evidence mapping, gap closure, POA&M, OSCAL exports, and **AI-agent automation through MCP**.

If you need a practical FedRAMP-oriented program without a heavyweight platform—and room to grow into other frameworks—this is built for you.

## Why OpenGRC

- **Start fast:** one Docker image with Postgres, API, and web UI.
- **Stay in control:** your data stays on your machine or self-hosted environment.
- **Work like auditors think:** checklist, evidence, POA&M, and SSP flow in one place.
- **Automate smartly:** MCP tools let AI agents discover gaps, recommend fixes, and produce machine-readable outputs.

## What You Can Do

- Ingest FRMR data (local file or remote source) and drive **FedRAMP 20x / Rev 5**-style projects
- Register additional framework packages over time via the **generic catalog** (`GET /catalog/frameworks` in the API)
- Generate project baselines by path type and impact
- Track checklist status and due dates
- Attach evidence directly to controls; run **connector** automation where configured
- Run recommendation-first **auto-scoping**
- Manage **risks**, **policies**, and related GRC entities in-app
- Drive the same workflows through MCP: dashboard stats, ConMon, risks, policies, pipeline checks, checklist updates, auto-scope approvals, cross-framework mapping, findings, audits, incidents, and vendors
- Generate POA&M with timeline view
- Export OSCAL SSP + OSCAL POA&M JSON (FedRAMP-oriented tooling)
- Use MCP (**capabilities_v1**, autopilot, taxonomy, etc.) for end-to-end agent workflows

## Get Started

### Prerequisites

- **Docker Desktop** (or Docker Engine + Compose v2) for the recommended install
- **Node.js 20+** if you run the API and web locally without Docker (see [CONTRIBUTING.md](CONTRIBUTING.md))

### Run with Docker (recommended)

Single container: **PostgreSQL + Nest API + Next.js** on one port.

From the repo root:

```bash
docker compose up --build
```

- **Web UI:** [http://localhost:8080](http://localhost:8080) — the UI talks to the API via same-origin `/api/*` rewrites.
- **API (via browser / same origin):** `http://localhost:8080/api/...`
- **Direct API inside the container** is not exposed on the host; use the UI or call through `/api` as above.

Set `AUTH_JWT_SECRET` (required for production) and `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (≥8 chars) so the first admin is created when the database is empty; that account must set a new password on first login. The all-in-one image uses embedded Postgres with a migration-driven bootstrap for fresh installs and upgrades. See [docs/PRODUCTION.md](docs/PRODUCTION.md) for TLS and hardening.

Persistence: Postgres data lives in the `pgdata` Docker volume.

### Run without Docker (developers)

From the repo root, use two terminals: `npm run dev:api` and `npm run dev:web` (see [CONTRIBUTING.md](CONTRIBUTING.md)). Default URLs are API `http://localhost:3000` and web `http://localhost:3001`.

## First Success Path

1. Create a new project in **Projects**
2. Let OpenGRC generate the checklist baseline
3. Update a few checklist items and attach evidence
4. Run **Auto-Scope** to generate applicability recommendations
5. Open **POA&M** and review generated milestones
6. Export artifacts for handoff (CSV/Markdown/JSON/OSCAL)

## AI Agent Mode (MCP)

OpenGRC ships an MCP HTTP server and a **MCP Connect** page in the web UI (**sidebar → MCP Connect**, or `/mcp`) with copy/paste install steps for Cursor. The host daemon listens on:

- `http://127.0.0.1:3334/mcp`

### One-command MCP setup

```bash
npm run cursor:deploy
```

This builds and starts the **Docker** stack, waits for API health (via `/api` on port 8080), then starts the host MCP HTTP daemon.

Point `OPEN_GRC_API_URL` at the API through the web proxy, e.g. `http://127.0.0.1:8080/api` (see [docs/MCP_SERVER.md](docs/MCP_SERVER.md)).

The MCP server is now organized into modular handlers behind a shared tool registry, so repo analysis, remediation, evidence linkage, reporting, risks, policies, checklist, pipeline, and GRC workflow tools can evolve independently while keeping one MCP endpoint.

MCP highlights:

- **Start here:** `capabilities_v1`
- **Repo + remediation:** `repo_inventory_v1`, `control_gap_map_v1`, `remediation_plan_v1`, `gap_closure_execution_brief_v1`, `compliance_agent_autopilot_v1`
- **Reporting + operations:** `dashboard_stats_v1`, `dashboard_conmon_v1`, `executive_briefing_v1`, `pipeline_check_v1`
- **Program workflows:** `risks_*_v1`, `policies_*_v1`, `checklist_*_v1`, `auto_scope_*_v1`, `catalog_cross_map_v1`, `findings_*_v1`, `audits_create_v1`, `incidents_create_v1`, `vendors_list_v1`
- **Evidence + connectors:** `evidence_link_*_v1`, `connectors_*_v1`, `fedramp_oscal_report_v1`

Recommended agent flow:

1. `capabilities_v1`
2. `frmr_taxonomy_v1` (`pathType: "20x"`)
3. `gap_closure_execution_brief_v1`
4. `compliance_agent_autopilot_v1` (`executionMode: "apply"`)
5. `fedramp_oscal_report_v1`

Full MCP details: [docs/MCP_SERVER.md](docs/MCP_SERVER.md)

## Deployment

- **Self-hosted:** use `docker compose up --build` and optionally put Caddy, nginx, or Traefik in front for TLS. See [docs/PRODUCTION.md](docs/PRODUCTION.md).
- **Optional desktop shell:** [docs/DESKTOP.md](docs/DESKTOP.md)

## Useful Commands

```bash
npm run build
npm run test:parity
npm run test:e2e
npm run test:autoscope
npm run test:mcp
```

`test:e2e` expects the API at `API_URL` (default `http://localhost:3000` for local Node dev). If you only use Docker, set `API_URL=http://localhost:8080/api` before running smoke tests.

Agent-oriented notes (API conventions, MCP, migrations): [AGENTS.md](AGENTS.md). **Operations** diagnostics (API version, DB mode, paths, FRMR): sidebar **Ops** (`/ops`). With Postgres, ops shows connection metadata—not a SQLite file path.

## Notes

- OpenGRC supports compliance workflows; it does not grant authorization by itself.
- FedRAMP authorization decisions remain with assessors and authorizing officials.
- Keep secrets out of source control; use environment variables.

## Docs

- [AGENTS.md](AGENTS.md) — AI coding agents and API conventions
- [ARCHITECTURE.md](ARCHITECTURE.md) — system layout
- [CONTRIBUTING.md](CONTRIBUTING.md) — how to develop
- [docs/PRODUCTION.md](docs/PRODUCTION.md) — TLS, env, operations
- [docs/AUTO_SCOPING.md](docs/AUTO_SCOPING.md)
- [docs/MCP_SERVER.md](docs/MCP_SERVER.md) — MCP tool inventory, workflows, integration routes
- [docs/CONTROLS_PROGRAM.md](docs/CONTROLS_PROGRAM.md) — controls program implementation guide (best practices across NIST, FedRAMP, ISO 27001, SOC 2, CMMC)
- [docs/BACKUP.md](docs/BACKUP.md)
- [docs/DESKTOP.md](docs/DESKTOP.md)

## License

Apache-2.0 — see [LICENSE](LICENSE).
