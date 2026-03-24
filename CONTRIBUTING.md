# Contributing

1. Fork and branch from `main`.
2. Run the stack locally for development (see below).
3. Keep FRMR ingestion tolerant of schema tweaks—add tests or fixtures under `apps/api` when changing the parser.
4. Open a PR with a clear description; follow existing TypeScript style.

Code of conduct: be respectful and professional.

## Local development (no Docker)

Use **Node.js 20+**. From the **repo root**:

```bash
npm run dev:api
```

In another terminal:

```bash
npm run dev:web
```

These run `apps/api` (`start:dev`) and `apps/web` (`next dev -p 3001`).

- **API:** [http://localhost:3000](http://localhost:3000)
- **Web:** [http://localhost:3001](http://localhost:3001)

Set `NEXT_PUBLIC_API_URL` if the web app must call a different API origin (for Docker-style same-origin testing, use `proxy` and rewrites as in `apps/web/next.config.mjs`).

**MCP server** (optional, third terminal): `npm run dev:mcp` from the repo root (runs `apps/mcp-server`). Set `OPEN_GRC_API_URL` to your API (e.g. `http://127.0.0.1:3000` for local API, or `http://127.0.0.1:8080/api` when the stack runs in Docker).

## Docker (single Compose file)

The supported all-in-one stack is [docker-compose.yml](docker-compose.yml) (Postgres + API + Next.js):

```bash
docker compose up --build
```

**UI:** [http://localhost:8080](http://localhost:8080). The API is reached at same-origin `/api/*`.

For MCP against Docker, set `OPEN_GRC_API_URL=http://127.0.0.1:8080/api` when running the host MCP daemon (`npm run mcp:daemon:start`).

## Tests

Smoke and e2e scripts default to `API_URL=http://localhost:3000`. When testing against Docker, use:

```bash
set API_URL=http://localhost:8080/api
npm run test:parity
```

On Unix-like shells: `export API_URL=http://localhost:8080/api`.

Other useful scripts from the repo root include `test:mcp`, `test:catalog`, `test:connectors`, and `test:autoscope`. See [package.json](package.json) for the full list.

See [README.md](README.md) for the recommended MCP agent flow and documentation links.
