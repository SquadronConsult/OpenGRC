# Production and self-hosting

OpenGRC ships one Docker deployment path: the **all-in-one** image from the root [Dockerfile](../Dockerfile), started with [docker-compose.yml](../docker-compose.yml).

## Run the container

```bash
docker compose up -d --build
```

- **Web + API (same origin):** `https://your-host:8080` (or map host port 443 → container 3001 in Compose)
- The UI calls the API via **`/api/*`** rewrites; do not expose the internal API port separately unless you know what you are doing.

## Required and recommended environment

Set on the `opengrc` service (Compose `environment:` or `.env`):

| Variable | Purpose |
|----------|---------|
| `AUTH_JWT_SECRET` | **Required** in production — strong random string for JWT signing |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | When the DB is empty, create the initial admin from these values (password ≥8 chars). The user must set a new password on first login. |
| `INTEGRATION_API_KEY` | Shared key for MCP/CI integrations calling secured endpoints (set on API; match MCP `INTEGRATION_API_KEY`) |

The all-in-one image is **Postgres-only** and starts in **migration-driven** mode for fresh installs and upgrades. The internal `DB_*` settings are baked into the image; you do not need to set them in `.env` for normal deployment.

For TLS, put **Caddy**, **nginx**, or **Traefik** in front of port **8080** (or change the published port in `docker-compose.yml`).

## Persistence

PostgreSQL files live in the **`pgdata`** named volume. Back up with `pg_dump` or volume snapshots — see [BACKUP.md](BACKUP.md).

## Air-gapped / offline FRMR

Mount `FRMR.documentation.json` into a path the API can read and set:

- `FRMR_PREFER_LOCAL=true`
- `FRMR_OFFLINE_PATH` to the mounted file path inside the container

See [AGENTS.md](../AGENTS.md) for FRMR and ingest behavior.

## Readiness

`GET /health` and `GET /health/ready` include `frmrLoaded` so automation can wait until ingestion is usable before generating checklists.
