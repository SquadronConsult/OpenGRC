# OpenGRC connector SDK (types)

Community-built connectors should implement `EvidenceConnector` from this package and register in the API `ConnectorRegistry` (see `apps/api/src/connectors`).

## Conventions

- `id`: stable string (e.g. `github_repo`, `aws_cloudtrail`).
- `collect(ctx)`: return `items` mapped by the orchestrator into the standard evidence ingest API; set `nextCursor` for incremental APIs.
- Put secrets only in instance `config` on the server; never echo secrets into `EvidenceItem.metadata`.
- Use `metadata.automated` is set by the platform on ingest; you may add non-sensitive fields.
- Map outputs to `controlId` / `checklistItemId` that resolve via control links or FRMR resolution.
