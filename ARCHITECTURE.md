# OpenGRC — Architecture

## Overview

OpenGRC is a **monorepo** with a NestJS API, a Next.js App Router UI, and an MCP server for agent automation. The **supported production-style deployment** is a **single Docker image** that runs **PostgreSQL**, the **API**, and **Next.js** together (see root [Dockerfile](Dockerfile) and [docker-compose.yml](docker-compose.yml)).

The product is **framework-agnostic at the data layer**: catalogs are modeled as **Framework → FrameworkRelease → CatalogControl → CatalogRequirement**, with checklist items and mappings hanging off that graph. **FedRAMP FRMR** is the primary packaged source for controls and requirements today; additional frameworks can be imported or registered as the catalog grows.

## Stack

| Layer | Technology |
|-------|------------|
| API | NestJS 10, TypeORM |
| Database | **PostgreSQL** (Docker / production-style); **SQLite** optional for local dev (`DB_TYPE`, see `apps/api/src/data-source.ts`) |
| Web | Next.js 14 (App Router), React 18, Tailwind CSS 4 |
| Evidence files | Local disk or S3-compatible storage (`STORAGE_BACKEND`, see API storage service) |
| Scheduling | `@nestjs/schedule` (cron), connector scheduler |
| Agents | MCP Streamable HTTP server (`apps/mcp-server`), optional host daemon (`scripts/mcp-daemon.mjs`) |

Background job systems (e.g. Redis/Bull) are **not** part of the core stack today; automation is driven by Nest schedules and connector runs.

## Runtime (Docker)

One container process model (see [docker/entrypoint.sh](docker/entrypoint.sh)):

1. Start PostgreSQL (data under `/var/lib/postgresql/data`, persisted via Compose volume `pgdata`).
2. Start Nest API on `127.0.0.1:3000` inside the container.
3. Start Next.js production server on port **3001**, bound for the host as **8080**.

The browser only sees **port 8080**. Next.js rewrites `/api/*` to the internal API (`INTERNAL_API_URL`), so clients use same-origin `/api/...` and cookies work predictably.

## Key flows

1. **FRMR ingestion:** API loads FRMR documentation, stores versions, normalizes FRD/FRR/KSI for checklist generation (FedRAMP-oriented).
2. **Catalog:** Generic tables support multiple frameworks; FRMR sync registers **fedramp_frmr** and links releases to FRMR versions.
3. **Checklist:** User selects project path (20x/rev5), impact, and actors → flattened requirement list and optional KSI links.
4. **Evidence:** Metadata in the database; files via StorageService (local or S3-compatible). Connectors push evidence through integration and connector pipelines.
5. **Connectors:** Pluggable implementations scheduled via `ConnectorSchedulerService`; runs can emit control-test results and evidence.
6. **GRC expansion:** In-app modules include risks, policies, attestations, audits, vendor mappings, incidents, findings, and related entities (see `apps/api/src/entities`).
7. **MCP integration routing:** `apps/api/src/integrations/integrations.controller.ts` exposes integration-key-authenticated wrappers so the MCP daemon can call the same underlying services used by JWT-authenticated UI/API routes.

## Extensibility

- **Connectors:** Registry under `apps/api/src/connectors` for CI, cloud, and ticketing integrations.
- **Webhooks:** API supports subscription endpoints for selected events.
- **MCP:** Tools in `apps/mcp-server` call the same HTTP API as the UI (see [docs/MCP_SERVER.md](docs/MCP_SERVER.md)). The web app exposes **MCP Connect** at `/mcp` for installing the Cursor MCP client against the local daemon.
- **MCP server composition:** `apps/mcp-server/src/index.mjs` is now thin bootstrap/transport code, `tool-registry.mjs` aggregates tool definitions and dispatch, `helpers.mjs` holds shared execution utilities, `handlers/*` define domain tool groups, and `utils/gap-detectors/*` isolate gap detection logic.

## Repository layout

| Path | Role |
|------|------|
| `apps/api` | Nest API, entities, migrations |
| `apps/web` | Next.js UI |
| `apps/mcp-server` | MCP Streamable HTTP server, tool registry, handlers, repo/gap utilities |
| `scripts/` | Smoke tests, Cursor/MCP helpers |
| `docker-compose.yml` | All-in-one Compose (Postgres + API + web) |

For deeper API and auth conventions, see [AGENTS.md](AGENTS.md).
