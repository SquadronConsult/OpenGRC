# OpenGRC — agent and developer guide

This repo is a **FedRAMP workspace** (API + web + MCP) with **multi-user JWT authentication** (email/password), optional **one-shot bootstrap** for the first admin, and an optional **single-container** image (Postgres + API + Next.js).

## Quick orientation

| Area | Path |
|------|------|
| Nest API | `apps/api` |
| Next.js UI | `apps/web` |
| MCP server | `apps/mcp-server` |
| Cursor / MCP scripts | `scripts/cursor-*.mjs`, `scripts/mcp-daemon.mjs` |
| MCP tool reference | `docs/MCP_SERVER.md` |
| All-in-one Docker | root `Dockerfile`, `docker-compose.all-in-one.yml` |

## Authentication

- **Login:** `POST /auth/login` with `{ email, password }` returns `{ token, user }` and sets an **httpOnly** cookie (`AUTH_COOKIE_NAME`, default `grc_session`). `POST /auth/logout` clears the cookie.
- **Bootstrap (empty DB):** set `BOOTSTRAP_TOKEN` on the API, then `POST /auth/bootstrap` with `{ email, password, bootstrapToken, name? }` once.
- **Dev seed:** if there are no users and `SEED_ADMIN_PASSWORD` (≥8 chars) is set, startup creates `SEED_ADMIN_EMAIL` (default `admin@localhost`).
- **JWT:** set `AUTH_JWT_SECRET` in production. API validates `Authorization: Bearer` or the session cookie.
- **Web client:** stores the login `token` in `sessionStorage` for cross-origin dev; with `NEXT_PUBLIC_API_URL=proxy`, the UI uses same-origin `/api/*` (see `apps/web/next.config.mjs` + `INTERNAL_API_URL`).

## API conventions

- **Base URL:** `http://localhost:3000` (or `NEXT_PUBLIC_API_URL` when calling the API directly).
- **Correlation ID:** Send `x-correlation-id` on mutating requests; the API echoes it and merges it into audit payloads.
- **Versions:** `GET /health` returns `apiVersion`, `schemaVersion`, and FRMR status.
- **Ops / backup:** `GET /health/ops` (paths, DB mode, FRMR). `POST /health/backup` copies SQLite to `LOCAL_DATA_DIR/backups/` (SQLite only; requires JWT like other mutating routes).

## GRC workflow hooks

- **Persisted POA&M:** `POST /projects/:id/poam/sync-from-checklist` saves derived POA&M rows; exports then use stored rows. `DELETE /projects/:id/poam/stored` falls back to live derivation.
- **Project snapshots:** `POST /projects/:id/snapshots` with `{ title, kind?, payload }`; `GET /projects/:id/snapshots`.
- **OSCAL import (traceability):** `POST /projects/:id/oscal/import-ssp` with SSP JSON (or `{ system-security-plan: ... }`).
- **Evidence gaps:** `GET /projects/:id/gaps/evidence` lists checklist items with no evidence.
- **FRMR version diff:** `GET /frmr/diff/:fromVersionId/:toVersionId` (requirement keys added/removed).

## MCP

- Prefer **`mcp_capabilities_v1`** first; responses include `mcpProtocolVersion` and `opengrcApiVersion` when available.
- **`validate_remediation`** runs allowlisted commands via **cmd.exe on Windows** and **bash** on Unix-like systems.
- Full tool list and env vars: `docs/MCP_SERVER.md`.

## Database

- Default dev: **SQLite** with `synchronize` on.
- **Single-container image:** Postgres embedded; set `DB_TYPE=postgres`, `DB_SYNC=false`, `DB_MIGRATIONS_RUN=true` (see `apps/api/src/data-source.ts` and root `Dockerfile`).
- For migration-driven upgrades on SQLite/Postgres: set `DB_SYNC=false`, `DB_MIGRATIONS_RUN=true`, run `npm run migration:run` in `apps/api`.

## Testing

- `npm run test:parity` — API smoke (requires API up, `SEED_ADMIN_PASSWORD` or `API_TOKEN`).
- `npm run test:e2e` — longer workflow including POA&M sync and health (requires API up).
- Smoke scripts use `scripts/login-bearer.mjs` for JWT.

## One-container deploy

```bash
docker compose -f docker-compose.all-in-one.yml up --build
```

UI on port **8080** (Next.js); API is reached internally; browser uses `/api` rewrites. Persist Postgres data via the `pgdata` volume.
