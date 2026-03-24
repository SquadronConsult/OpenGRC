# OpenGRC — agent and developer guide

This repo is a **GRC workspace** (API + web + MCP): **multi-user JWT authentication** (email/password), an **env-based initial admin** when the database is empty, optional **forced password change** on first login, and a **single-container** image (Postgres + API + Next.js). The flagship compliance program in the UI is **FedRAMP / FRMR**; the **database model** supports **multiple frameworks** via the generic catalog.

## Quick orientation

| Area | Path |
|------|------|
| Nest API | `apps/api` |
| Next.js UI | `apps/web` |
| MCP server | `apps/mcp-server` |
| Cursor / MCP scripts | `scripts/cursor-*.mjs`, `scripts/mcp-daemon.mjs` |
| MCP tool reference | `docs/MCP_SERVER.md` |
| Docker (Compose) | root `Dockerfile`, `docker-compose.yml` |

**Web:** **MCP Connect** lives in the sidebar (`/mcp`) with install/copy instructions for Cursor; **Ops** (`/ops`) shows API/schema versions, FRMR state, evidence paths, and **database mode**.

## Authentication

- **Login:** `POST /auth/login` with `{ email, password }` returns `{ token, user }` (including `mustChangePassword` when the user must set a new password) and sets an **httpOnly** cookie (`AUTH_COOKIE_NAME`, default `grc_session`). `POST /auth/logout` clears the cookie.
- **Initial admin (empty DB):** if there are no users and `SEED_ADMIN_PASSWORD` (≥8 chars) is set, startup creates `SEED_ADMIN_EMAIL` (default `admin@localhost`) with `mustChangePassword` true. Sign in with the env password once, then `POST /auth/change-password` with `{ currentPassword, newPassword }` or use the **Change password** UI.
- **JWT:** set `AUTH_JWT_SECRET` in production. API validates `Authorization: Bearer` or the session cookie.
- **Web client:** stores the login `token` in `sessionStorage` for cross-origin dev; with `NEXT_PUBLIC_API_URL=proxy`, the UI uses same-origin `/api/*` (see `apps/web/next.config.mjs` + `INTERNAL_API_URL`).

## API conventions

- **Base URL:** `http://localhost:3000` (or `NEXT_PUBLIC_API_URL` when calling the API directly).
- **Correlation ID:** Send `x-correlation-id` on mutating requests; the API echoes it and merges it into audit payloads.
- **Versions:** `GET /health` returns `apiVersion`, `schemaVersion`, and FRMR status.
- **Ops / backup:** `GET /health/ops` returns paths, **db type**, FRMR state, and (when `DB_TYPE=postgres`) **non-secret** Postgres host/port/database/username from the running DataSource—**not** a SQLite path. For SQLite, it returns the resolved file path and size. `POST /health/backup` copies the SQLite file to `LOCAL_DATA_DIR/backups/` (**SQLite only**; use DB-native tools for Postgres; requires JWT like other mutating routes).

## GRC workflow hooks

- **Persisted POA&M:** `POST /projects/:id/poam/sync-from-checklist` saves derived POA&M rows; exports then use stored rows. `DELETE /projects/:id/poam/stored` falls back to live derivation.
- **Project snapshots:** `POST /projects/:id/snapshots` with `{ title, kind?, payload }`; `GET /projects/:id/snapshots`.
- **OSCAL import (traceability):** `POST /projects/:id/oscal/import-ssp` with SSP JSON (or `{ system-security-plan: ... }`).
- **Evidence gaps:** `GET /projects/:id/gaps/evidence` lists checklist items with no evidence.
- **FRMR version diff:** `GET /frmr/diff/:fromVersionId/:toVersionId` (requirement keys added/removed).
- **Catalog:** `GET /catalog/frameworks` lists registered frameworks (e.g. FedRAMP FRMR adapter).

## MCP

- Prefer **`capabilities_v1`** first; responses include `mcpProtocolVersion` and `opengrcApiVersion` when available.
- **`validate_remediation_v1`** runs allowlisted commands via **cmd.exe on Windows** and **bash** on Unix-like systems.
- Full tool list and env vars: `docs/MCP_SERVER.md`.

## Database

- **Default local dev:** often **SQLite** with `synchronize` on (`DB_TYPE` unset or `sqlite`).
- **Docker / production-style:** **Postgres** with migrations (`DB_TYPE=postgres`, `DB_*` variables—see `apps/api/src/data-source.ts`, root `Dockerfile`, and migrations under `apps/api/src/migrations`).
- For migration-driven upgrades on SQLite or Postgres: set `DB_SYNC=false`, `DB_MIGRATIONS_RUN=true`, run `npm run migration:run` in `apps/api`.

## Testing

- `npm run test:parity` — API smoke (requires API up, `SEED_ADMIN_PASSWORD` or `API_TOKEN`).
- `npm run test:e2e` — longer workflow including POA&M sync and health (requires API up).
- Smoke scripts use `scripts/login-bearer.mjs` for JWT.

## One-container deploy

```bash
docker compose up --build
```

UI on port **8080** (Next.js); API is reached internally; browser uses `/api` rewrites. Persist Postgres data via the `pgdata` volume.
