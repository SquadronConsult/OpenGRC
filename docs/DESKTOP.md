# Desktop runtime

## Overview

`apps/desktop` launches the platform in single-user local mode:
- local API (`apps/api`) on `http://localhost:3000`
- local web UI (`apps/web`) on `http://localhost:3001`
- Electron shell wrapping the web UI

No external services are required.

## Build and run

```bash
cd apps/api && npm install && npm run build
cd ../web && npm install && npm run build
cd ../desktop && npm install && npm run start
```

## Local data paths

The desktop app uses the OS app user-data directory:
- `local-data/grc.sqlite` for SQLite
- `evidence/` for uploaded evidence files
- `data/FRMR.documentation.json` optional offline FRMR source

## Packaging

Build Windows installer artifacts:

```bash
cd apps/desktop
npm run dist
```
