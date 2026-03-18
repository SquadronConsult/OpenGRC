# Production deployment (minimal hosting)

1. Copy `docker-compose.prod.yml` and set in `.env`:
   - `JWT_SECRET` (long random)
   - `PUBLIC_API_URL` — full URL of the API as reached by users’ browsers (e.g. `https://grc-api.example.com`)
   - `INTEGRATION_API_KEY` for CI/scanner hooks
   - optional `INTEGRATION_PROJECT_KEYS` for project-scoped v1 evidence linkage endpoints
   - `DISABLE_PUBLIC_REGISTER=true`

2. **TLS:** Put Caddy, nginx, or Traefik in front of API and web.

3. **Persistence:** SQLite database and evidence files are persisted to Docker volumes:
   - `localdata` (database + local FRMR cache)
   - `evidence` (uploaded evidence files)

4. **Air-gapped:** Put `FRMR.documentation.json` in the mounted `localdata` volume and set:
   - `FRMR_OFFLINE_PATH=/app/local-data/FRMR.documentation.json`
   - `FRMR_PREFER_LOCAL=true`
   - optional `FRMR_AUTO_INGEST=false` and trigger `POST /frmr/ingest` as admin after updates.
