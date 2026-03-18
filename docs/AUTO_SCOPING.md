# Auto-Scoping V1

Auto-Scoping V1 adds recommendation-first scope analysis for FedRAMP checklist items.

It does **not** automatically mutate checklist scope by default. Instead, it:

1. Collects evidence from configured connectors.
2. Derives normalized system facts.
3. Produces explainable applicability recommendations.
4. Requires reviewer approval before checklist applicability fields are updated.

## Endpoints

- `POST /projects/:projectId/auto-scope/run`
- `POST /projects/:projectId/auto-scope/preflight`
- `GET /projects/:projectId/auto-scope/recommendations`
- `POST /projects/:projectId/auto-scope/recommendations/:recommendationId/approve`
- `POST /projects/:projectId/auto-scope/recommendations/:recommendationId/reject`
- `POST /projects/:projectId/auto-scope/recommendations/bulk-approve`

## Run Request Example

```json
{
  "repoPath": "D:/my-system",
  "inventoryMode": "live",
  "connectors": {
    "repo": true,
    "iac": true,
    "aws": true,
    "azure": true,
    "gcp": true
  },
  "cloud": {
    "aws": { "accountId": "123456789012", "regions": ["us-east-1"] },
    "azure": { "subscriptionId": "sub-id", "tenantId": "tenant-id" },
    "gcp": { "projectId": "my-project" }
  }
}
```

## Connector Behavior (V1)

- **Repo**: local file scan with limits (`MAX_SCAN_FILES`, max file size, timeout).
- **IaC**: Terraform/CloudFormation/Kubernetes signatures from scanned files.
- **AWS/Azure/GCP**: metadata-only ingestion from request payload and/or environment variables.

## Live Cloud Inventory (V1.1, SDK-based)

Set `inventoryMode` to `live` to attempt real inventory using cloud SDKs.

- AWS: AWS SDK (STS identity + EC2/Lambda/S3/RDS listing)
- Azure: Azure SDK (`DefaultAzureCredential` + resource/vm listing)
- GCP: Google SDK (`GoogleAuth` + enabled services + compute listing)

If credentials are unavailable or permissions are insufficient, auto-scoping does not fail the entire run.
It records connector warnings and continues with available evidence.

No connector stores raw credentials in the database.
When provided in the wizard, cloud credentials are used in-memory for that run/preflight request.

## Review Workflow

Recommendation statuses:

- `pending_review`
- `approved`
- `rejected`
- `stale` (superseded by newer run)

Approval writes scoped fields to checklist item:

- `applicabilityDecision`
- `applicabilityRationale`
- `applicabilityConfidence`
- `applicabilitySource`
- `reviewState=scoped_approved`

## Security Notes

- Connector execution is bounded by timeout.
- Repository scanning skips common heavy/sensitive directories.
- Secrets are expected via environment injection or transient request payloads; DB stores identifiers/metadata only.
- Live mode depends on credentials being available to the API runtime (env vars, mounted credential files, workload identity, etc.).

## Testing

Run:

```bash
npm run test:autoscope
```

This smoke test validates: run -> recommendations -> approval -> checklist state update.
