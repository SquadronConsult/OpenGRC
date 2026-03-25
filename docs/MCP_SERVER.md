# MCP Server (Localhost HTTP, URL-Based)

This project now runs MCP as a host daemon with Streamable HTTP transport so Cursor can connect via a simple URL entry in `mcp.json`.

## Runtime Model

- **Protocol version:** `MCP_PROTOCOL_VERSION` (default `1.0.0` in `apps/mcp-server/src/config.mjs`). `capabilities_v1` returns `mcpProtocolVersion` and `opengrcApiVersion` for agents to pin expectations.
- **Docker:** the repo has a single Compose stack ([`docker-compose.yml`](../docker-compose.yml)) — one container with Postgres, API, and web. The MCP server itself is usually run **on the host** (this daemon), not inside Docker.
- MCP client traffic goes to host daemon URL:
  - `http://127.0.0.1:3334/mcp`
- The daemon process is started/stopped with:
  - `npm run mcp:daemon:start`
  - `npm run mcp:daemon:stop`
  - `npm run mcp:daemon:status`

## Server Code Layout

- `apps/mcp-server/src/index.mjs` — Express + MCP transport bootstrap and shutdown only
- `apps/mcp-server/src/tool-registry.mjs` — aggregates `tools[]` from handlers and dispatches by tool name
- `apps/mcp-server/src/helpers.mjs` — shared text/error formatting, path resolution, rollback, and validation helpers
- `apps/mcp-server/src/handlers/*` — domain tool groups (repo, gaps, remediation, evidence, connectors, reporting, risks, policies, checklist, pipeline, auto-scope, cross-framework, findings, audits/incidents/vendors, skills)
- `apps/mcp-server/src/utils/gap-detectors/*` — detector registry and detector modules used by `control_gap_map_v1`

## Start OpenGRC (Docker)

```bash
docker compose up --build
```

Web UI: `http://localhost:8080`. Set `OPEN_GRC_API_URL=http://127.0.0.1:8080/api` for this MCP daemon when calling the API from the host.

## One-Click Cursor Deployment

From repository root:

```bash
npm run cursor:deploy
```

Alias:

```bash
npm run cursor:connect
```

This automatically:

1. Starts Docker services (`api`, `web`, `mcp`) in detached mode.
2. Waits for API readiness (`/health`).
3. Starts host MCP HTTP daemon (`scripts/mcp-daemon.mjs start`).
4. Writes/updates global Cursor MCP config at `~/.cursor/mcp.json`.
5. Also writes/updates workspace MCP config at `.cursor/mcp.json`.

Generated config is URL-based (`url` + optional `headers`) and does not use command/bootstrap launchers.

## Manual Cursor MCP JSON (copy/paste)

Print JSON snippet for manual Cursor configuration:

```bash
npm run cursor:mcp-json
```

Print explicit global JSON:

```bash
npm run cursor:mcp-json:global
```

Print explicit workspace JSON:

```bash
npm run cursor:mcp-json:workspace
```

Print server-only JSON (for Cursor "Add MCP Server" dialog):

```bash
npm run cursor:mcp-server-json
```

Attempt to copy JSON snippet to clipboard:

```bash
npm run cursor:mcp-copy
```

Open Cursor MCP install deep link directly:

```bash
npm run cursor:mcp-install
```

## Cursor MCP Connection (URL transport)

Example config snippet:

```json
{
  "mcpServers": {
    "open-grc-mcp": {
      "url": "http://127.0.0.1:3334/mcp",
      "headers": {}
    }
  }
}
```

## Claude MCP Connection (URL transport)

Use the same localhost MCP URL:

`http://127.0.0.1:3334/mcp`

## Verification Flow

1. `capabilities_v1` (returns `categories`, `workflows`, and prerequisites)
2. `list_tools` (client-native) — expect **54** tools in the current registry
3. Optional: call new integration-backed tools with `INTEGRATION_API_KEY` set:
   - `dashboard_stats_v1` → `GET /integrations/v1/dashboard/stats` or project stats
   - `risks_list_v1` / `pipeline_check_v1` / `catalog_cross_map_v1`
4. `dry_run_remediation_v1` with a minimal single-file change (file mutation guardrails)

## Exposed MCP Tools

**Discovery & help**

- `capabilities_v1`

**Repo & gaps**

- `repo_inventory_v1`
- `control_gap_map_v1`
- `remediation_plan_v1`
- `gap_closure_execution_brief_v1`

**Remediation files & validation**

- `apply_remediation_v1`
- `dry_run_remediation_v1`
- `validate_remediation_v1`
- `rollback_run_v1` (paired with remediation runs)

**Evidence linkage**

- `sync_grc_evidence_v1`
- `evidence_link_upsert_v1`
- `evidence_link_bulk_ingest_v1`
- `evidence_link_lookup_control_v1`
- `evidence_link_map_control_v1`
- `evidence_link_ingest_status_v1`
- `evidence_link_trigger_auto_scope_v1`
- `evidence_link_project_bootstrap_verify_v1`

**Connectors**

- `connectors_registry_v1`
- `connectors_list_v1`
- `connectors_status_v1`
- `connectors_run_v1`
- `connectors_runs_v1`
- `connectors_create_v1`

**Framework & search**

- `frmr_taxonomy_v1`
- `catalog_frameworks_v1`
- `opengrc_search_v1`
- `opengrc_policies_list_v1`

**Orchestration**

- `compliance_agent_autopilot_v1`

**Dashboard & reporting**

- `dashboard_stats_v1`
- `dashboard_conmon_v1`
- `executive_briefing_v1`
- `fedramp_oscal_report_v1`

**Risks**

- `risks_list_v1`
- `risks_create_v1`
- `risks_heatmap_v1`
- `risks_update_v1`

**Policies**

- `policies_create_v1`
- `policies_update_v1`
- `policies_publish_v1`
- `policies_generate_v1`

**Pipeline & checklist**

- `pipeline_check_v1`
- `checklist_bulk_update_v1`
- `checklist_patch_item_v1`

**Auto-scope & catalog**

- `auto_scope_recommendations_v1`
- `auto_scope_approve_v1`
- `catalog_cross_map_v1`

**Findings & GRC entities**

- `findings_create_v1`
- `findings_list_v1`
- `audits_create_v1`
- `incidents_create_v1`
- `vendors_list_v1`

**Skills**

- `list_skills_v1`
- `run_skill_agent_v1`

**Run audit**

- `get_run_log_v1`

### Integration API mapping (global `INTEGRATION_API_KEY`)

Tools above that call OpenGRC over HTTP use `Authorization: Bearer $INTEGRATION_API_KEY` against `OPEN_GRC_API_URL`. New **global** integration routes live under `/integrations/v1/…` (see API `IntegrationsController`): dashboard stats, project stats/conmon/briefing, risks, policies, pipeline check, checklist bulk/patch, auto-scope recommendations/approve, catalog cross-map, findings, audits, incidents, vendors — each mirrored by the corresponding `*_v1` MCP tool.

## Full Autofix Guardrails

- allowlisted write roots (`MCP_ALLOWED_PATHS`)
- max files per run (`MCP_MAX_FILES_PER_RUN`)
- max steps per run (`MCP_MAX_STEPS_PER_RUN`)
- command allowlist for validation commands
- sensitive path + extension blocks
- rollback checkpoints and run-level logs

## Environment Variables (daemon)

- `MCP_WORKSPACE_ROOT` (default `/workspace`)
- `MCP_ALLOWED_PATHS` (comma-separated absolute paths)
- `MCP_DATA_DIR` (default `/app/data`)
- `MCP_HTTP_HOST` (default `127.0.0.1`)
- `MCP_HTTP_PORT` (default `3334`)
- `MCP_HTTP_PATH` (default `/mcp`)
- `MCP_ALLOWED_HOSTS` (optional comma-separated host allowlist)
- `MCP_DRY_RUN_DEFAULT`
- `MCP_MAX_FILES_PER_RUN`
- `MCP_MAX_STEPS_PER_RUN`
- `MCP_COMMAND_TIMEOUT_MS`
- `OPEN_GRC_API_URL` — base URL for API requests (include `/api` when using the all-in-one image from the host, e.g. `http://127.0.0.1:8080/api`; local Node dev is often `http://127.0.0.1:3000` with no `/api` prefix)
- `INTEGRATION_API_KEY`

## Evidence Sync

`sync_grc_evidence_v1` posts scanner summaries into OpenGRC integration endpoint:

- `POST /integrations/scanner/summary`

Requires `INTEGRATION_API_KEY` to be set for the MCP service.

**Connectors:** `connectors_*_v1` tools manage **automated evidence-collection integrations** (e.g. GitHub or cloud scanners) that pull artifacts into OpenGRC for checklist mapping. Use registry/list for configuration; status/run/runs for operations; create to add an instance.

## Evidence Linkage Toolset (v1)

The MCP server now includes full evidence-linkage wrappers over project-scoped API endpoints:

- `evidence_link_upsert_v1` -> `POST /integrations/v1/evidence`
- `evidence_link_bulk_ingest_v1` -> `POST /integrations/v1/evidence/bulk`
- `evidence_link_lookup_control_v1` -> `POST /integrations/v1/controls/resolve`
- `evidence_link_map_control_v1` -> `POST /integrations/v1/controls/link`
- `evidence_link_ingest_status_v1` -> `GET /integrations/v1/projects/:projectId/ingest/:requestId`
- `evidence_link_trigger_auto_scope_v1` -> `POST /integrations/v1/auto-scope/trigger`
- `evidence_link_project_bootstrap_verify_v1` -> orchestration chain over:
  - `POST /integrations/v1/projects`
  - `POST /integrations/v1/controls/link`
  - `POST /integrations/v1/controls/resolve`
  - `POST /integrations/v1/evidence`
  - `POST /integrations/v1/auto-scope/trigger`

These wrappers return machine-friendly accepted/rejected/error payloads and support idempotency keys for replay-safe ingest.

## Integration-authenticated Project Creation (v1)

The v1 integration API supports project creation through integration-key authentication:

- `POST /integrations/v1/projects`
- Auth: `Authorization: Bearer $INTEGRATION_API_KEY`
- Request example:

```json
{
  "name": "Automation Demo Project",
  "pathType": "20x",
  "impactLevel": "moderate",
  "includeKsi": true
}
```

- Response includes deterministic verification hint payload:
  - `project.id`
  - `verificationHint.checklistItemId`
  - `verificationHint.framework`
  - `verificationHint.controlId`

### One-tool end-to-end verification

Call MCP tool `evidence_link_project_bootstrap_verify_v1` with optional payload:

```json
{
  "name": "MCP Verify Chain",
  "pathType": "20x",
  "impactLevel": "moderate",
  "includeKsi": true,
  "evidenceType": "mcp_project_bootstrap_verify",
  "autoScopeOptions": {
    "mode": "recommendation_only"
  }
}
```

Tool output includes:

- created `projectId`
- control resolution result
- evidence ingest result (`accepted/rejected`, `requestId`)
- auto-scope trigger result
- `ok` summary flag and diagnostics

### Agent-style orchestration (single call)

Use `compliance_agent_autopilot_v1` when you want MCP to behave like a compliance automation agent:

- scans the active workspace inventory
- infers control gaps
- builds a remediation plan
- ensures project/linkage pipeline runs:
  - if `projectId` is omitted and `createProjectIfMissing` is true, it creates + bootstraps a project
  - if `projectId` is provided, it links/resolves control and pushes evidence, then triggers auto-scope

Minimal create-if-missing example:

```json
{
  "strategy": "balanced",
  "createProjectIfMissing": true,
  "projectName": "Agent Autopilot Project"
}
```

Existing project example:

```json
{
  "projectId": "YOUR_PROJECT_ID",
  "controlId": "frr:ID.AM:AM-01",
  "framework": "frmr",
  "strategy": "balanced"
}
```

Full-loop apply example:

```json
{
  "strategy": "balanced",
  "createProjectIfMissing": true,
  "projectName": "20x Closure Run",
  "executionMode": "apply"
}
```

Autopilot and remediation outputs now include richer context for planning:

- repo context hints (CI workflow files, compliance files, lockfiles, IaC files)
- control intent mapping (FedRAMP/FRMR objective hints)
- acceptance criteria per detected gap
- explicit `nextMcpCalls` with input templates for loop closure
- FRMR process/requirement targets (`frmrTargets`) and KSI targets (`ksiTargets`)
- `execution.before` / `execution.after` gap state and per-gap closure verdicts when apply mode is used

### Gap closure execution brief

Use `gap_closure_execution_brief_v1` when you want a deterministic, edit-focused brief before making changes.

It returns:

- `proposedChanges`
- `validationCommands`
- `closureBrief` with FRMR/KSI targets and close criteria

### FRMR taxonomy lookup

Use `frmr_taxonomy_v1` to get machine-readable FRMR process, requirement, actor, and KSI structure:

```json
{
  "pathType": "20x"
}
```

### Unified search and policies (GRC)

- **`opengrc_search_v1`**: `{ "q": "access", "projectId": "optional-uuid", "types": "checklist,evidence,risk,policy", "limit": 20 }`  
  Calls `GET /search`. `q` must be at least 2 characters.
- **`opengrc_policies_list_v1`**: `{ "projectId": "optional", "status": "optional" }`  
  Calls `GET /policies`.

Both use `INTEGRATION_API_KEY` as `Authorization: Bearer …` (same as other OpenGRC integration tools). The API accepts this key on JWT-protected routes and maps it to the first active **admin** user for authorization.

### FedRAMP OSCAL handoff

Use `fedramp_oscal_report_v1` after a closure/autopilot run to package:

- OSCAL SSP JSON
- OSCAL POA&M JSON
- closure manifest with run IDs and evidence IDs

Example:

```json
{
  "projectId": "YOUR_PROJECT_ID",
  "pathType": "20x",
  "closureSummary": {
    "gapCountBefore": 1,
    "gapCountAfter": 0
  }
}
```

## Exact agent workflow

Recommended deterministic sequence for an AI agent:

1. `capabilities_v1`
2. `frmr_taxonomy_v1` with `pathType: \"20x\"`
3. `gap_closure_execution_brief_v1`
4. `compliance_agent_autopilot_v1` with `executionMode: \"apply\"`
5. `fedramp_oscal_report_v1`

### MCP help tool (recommended first call)

Use `capabilities_v1` to return a machine-friendly "how to use this MCP" guide with:

- prerequisites (`OPEN_GRC_API_URL`, `INTEGRATION_API_KEY`)
- recommended starting tool
- workflow options (autopilot vs fine-grained)
- example payloads

Example call payload:

```json
{
  "objective": "Create project if missing and link evidence automatically"
}
```

Prompt pattern for agents:

`Call capabilities_v1 first, then execute compliance_agent_autopilot_v1 using the recommended flow.`

Tool descriptions: `capabilities_v1` is the entrypoint (**START HERE**). `frmr_taxonomy_v1` uses **FRMR** (FedRAMP Requirements and Metrics Repository) and **KSI** (Key Security Indicators); **20x** / **rev5** are FedRAMP path types. `fedramp_oscal_report_v1` outputs **OSCAL** (Open Security Controls Assessment Language), **SSP** (System Security Plan), and **POA&M** (Plan of Action and Milestones). `compliance_agent_autopilot_v1` is **RECOMMENDED** for end-to-end orchestration.

## Audit Logs

Run logs are written to:

- `/app/data/runs/<runId>.jsonl`

Retrieve via tool:

- `get_run_log_v1`

Rollback via tool:

- `rollback_run_v1`
