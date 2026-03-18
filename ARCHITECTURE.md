# Open Source GRC Platform — Architecture

## Stack
- **API:** NestJS 10, TypeORM, PostgreSQL, Bull (Redis), AWS SDK S3-compatible (MinIO)
- **Web:** Next.js 14 (App Router), React 18
- **Deploy:** Docker Compose (dev + production profiles)

## Services
| Service | Responsibility |
|---------|----------------|
| `api` | REST API, FRMR ingestion, checklists, tasks, evidence, RBAC |
| `web` | UI: glossary, requirements, KSIs, projects, evidence |
| `postgres` | Primary datastore |
| `redis` | Job queue (ingestion, notifications) |
| `minio` | Evidence object storage (S3 API) |

## Key flows
1. **Ingestion:** Worker fetches `FRMR.documentation.json`, stores version + raw snapshot, normalizes FRD/FRR/KSI.
2. **Checklist:** User selects project path (20x/rev5), actor, impact → flattened requirement list + optional KSI links.
3. **Evidence:** Upload to MinIO; metadata + checksum in PostgreSQL.

## Extensibility
- **Connectors:** Pluggable modules for CI and vulnerability scanners posting evidence via API.
- **Webhooks:** Subscriptions for requirement updates and task events.
