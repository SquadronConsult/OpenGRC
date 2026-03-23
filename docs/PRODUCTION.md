# On-prem single-user deployment (minimal hosting)

1. Copy `docker-compose.prod.yml` and set in `.env`:
   - `PUBLIC_API_URL` — full URL of the API as reached by users’ browsers (e.g. `https://grc-api.example.com`)
   - `INTEGRATION_API_KEY` for CI/scanner hooks
   - optional `INTEGRATION_PROJECT_KEYS` for project-scoped v1 evidence linkage endpoints

2. **TLS:** Put Caddy, nginx, or Traefik in front of API and web.

This deployment model is local-trust:
- no authentication step in the web app,
- guarded API endpoints resolve to the local operator context.

3. **Persistence:** SQLite database and evidence files are persisted to Docker volumes:
   - `localdata` (database + local FRMR cache)
   - `evidence` (uploaded evidence files)

4. **Air-gapped:** Put `FRMR.documentation.json` in the mounted `localdata` volume (same directory as `LOCAL_DATA_DIR`, e.g. `/app/local-data/`). The API looks for `$LOCAL_DATA_DIR/FRMR.documentation.json` by default when `FRMR_OFFLINE_PATH` is unset. Then set:
   - `FRMR_PREFER_LOCAL=true`
   - optional explicit path: `FRMR_OFFLINE_PATH=/app/local-data/FRMR.documentation.json`
   - optional `FRMR_AUTO_INGEST=false` and trigger `POST /frmr/ingest` as admin after updates.

5. **Readiness:** `GET /health` and `GET /health/ready` include `frmrLoaded` so you can tell when FRMR ingest has completed before relying on checklist generation.
