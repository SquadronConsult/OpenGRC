# Controls Program Playbook

> Engineering-level guidance for closing FedRAMP 20x controls: what to build, how to prove it, and how to keep it passing.

---

## How to use this guide

This is a **software engineering playbook**, not a policy document. It tells you what to build, what evidence to produce, and how to close controls in a FedRAMP 20x program. Every section maps to a process area or KSI domain in the FRMR and tells you the **best practice implementation**, the **minimum viable evidence**, and the **automation path** to keep it closed.

**FedRAMP 20x context:** The 20x path uses the FRMR (FedRAMP Requirements Management Repository) as the authoritative requirements source. Requirements are organized by **process ID** (P1–Pn), scoped by **actor** (CSO, CSX, CISO), filtered by **impact level** (low/moderate/high), and measured by **KSIs** (Key Security Indicators). OpenGRC generates your checklist from this structure — path type `20x`, your actors, and your impact level determine what lands on it.

---

## 1. Identity & access management

This is where most programs fail first and where assessors look hardest. You need to prove that only the right people and services can reach the right things, and you can show it.

### What to build

**Authentication infrastructure**

- **SSO with a hardened IdP.** Okta, Entra ID, or Google Workspace as the single source of truth. No local accounts on any system that touches FedRAMP data. If a service cannot federate, it gets a service account with a rotated secret — never a shared human credential.
- **MFA everywhere, no exceptions.** FIDO2/WebAuthn for humans is the gold standard. TOTP is acceptable. SMS is not — assessors will flag it. Enforce MFA at the IdP level so it cannot be bypassed per-app.
- **Phishing-resistant MFA for privileged access.** Admin consoles, CI/CD, infrastructure management, and anything that can modify the authorization boundary must require hardware keys or passkeys.

```yaml
# Example: Okta policy for FedRAMP boundary apps
- name: fedramp-boundary-apps
  authentication_policy:
    constraints:
      - type: POSSESSION   # something you have (FIDO2 / passkey)
      - type: KNOWLEDGE    # something you know (password)
    re_auth_frequency: 12h
    session_lifetime: 8h
    mfa_enrollment: REQUIRED
```

**Authorization model**

- **RBAC with least privilege enforced in code.** Define roles in your IdP or authorization service. Map them to application permissions. Never grant broad admin — use scoped roles (e.g., `project:reader`, `project:editor`, `admin:audit`).
- **Service-to-service: short-lived tokens.** Use OIDC workload identity (GCP), IAM roles for service accounts (AWS), or managed identity (Azure). No long-lived API keys baked into configs.
- **Emergency access (break-glass).** Documented, MFA-protected, logged, time-boxed, and reviewed within 24 hours of use.

**Access lifecycle**

- **Automated provisioning/deprovisioning via SCIM.** When HR terminates → IdP disables → all downstream sessions revoke. Target: deprovisioning within 1 hour of termination.
- **Quarterly access reviews.** Export the full user list from every system in scope. Compare against HR roster. Document exceptions. Revoke stale accounts.
- **Service account inventory.** Every service account has an owner, a rotation schedule, and a documented purpose. No orphaned service accounts.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| IdP user export with MFA status | Okta/Entra admin API → CSV/JSON | AC-2, IA-2 |
| Role-permission matrix | Export from RBAC system or IaC (Terraform IAM) | AC-3, AC-6 |
| Quarterly access review report | Script: diff IdP users vs HR roster → findings → remediation tickets | AC-2(3) |
| Deprovisioning log | Ticketing system export showing termination → revocation timeline | AC-2(j), PS-4 |
| Break-glass usage log | CloudTrail/audit log filtered to emergency accounts | AC-2(2) |
| MFA enforcement proof | IdP policy screenshot + test login attempt without MFA (should fail) | IA-2(1), IA-2(2) |

### Automation path

```bash
# Nightly access review diff (conceptual)
python3 scripts/access-review.py \
  --idp-export okta \
  --hr-source bamboo \
  --output-format json \
  --alert-on-delta \
  --push-to-opengrc --project-id $PROJECT_ID
```

Wire this into a scheduled connector or CI job. Push the output as evidence to OpenGRC via the integration API or MCP `evidence_link_upsert_v1`.

---

## 2. System & information integrity

This is your vulnerability management, patching, and anti-tampering posture. Assessors will check scan coverage, remediation SLAs, and whether you actually patch what you find.

### What to build

**Vulnerability scanning stack**

- **Infrastructure:** Authenticated scans with Nessus, Qualys, or Rapid7. Weekly minimum, monthly is the floor for FedRAMP. Authenticated scans — credentialed — are required; unauthenticated scans miss most findings.
- **Container images:** Trivy, Grype, or Snyk in CI/CD. Scan at build time AND on a schedule for running images. Block deploys on critical/high CVEs.
- **Dependencies (SCA):** Dependabot, Renovate, or Snyk for every repo in the boundary. Auto-PR for patches. Alert on known exploited vulnerabilities (CISA KEV).
- **SAST:** Semgrep, CodeQL, or SonarQube in CI. Fail the build on high-severity findings. Review medium findings in sprint.
- **DAST:** ZAP or Burp in CI or nightly against staging. Cover OWASP Top 10.
- **Cloud configuration (CSPM):** AWS Security Hub, Azure Defender, GCP SCC, or Prowler/ScoutSuite. Run continuously.

```yaml
# Example: GitHub Actions vulnerability gate
- name: Container scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '${{ env.IMAGE }}:${{ github.sha }}'
    format: 'json'
    output: 'trivy-results.json'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'   # Fail the build

- name: Push results to OpenGRC
  if: always()
  run: |
    curl -X POST "$OPENGRC_API/integrations/v1/evidence" \
      -H "Authorization: Bearer $INTEGRATION_API_KEY" \
      -H "Content-Type: application/json" \
      -d @trivy-results.json
```

**Patching discipline**

- **Critical/CISA KEV:** 15 days. No exceptions.
- **High:** 30 days.
- **Medium:** 90 days.
- **Low:** Next scheduled maintenance or 180 days.
- **OS patching:** Automate with SSM Patch Manager (AWS), Update Management (Azure), or OS Config (GCP). Immutable infrastructure (rebuild, don't patch) is the best practice — kill the instance and deploy a patched image.
- **Zero-day response:** Have a runbook. "We will assess within 48 hours, patch or mitigate within 14 days, document in POA&M if SLA is exceeded."

**File integrity monitoring**

- AIDE, OSSEC, or Wazuh on every server/container that processes FedRAMP data. Baseline on deploy. Alert on unexpected changes. Investigate every alert.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Scan coverage report | Scanner dashboard showing 100% of asset inventory scanned | RA-5, SI-2 |
| Vulnerability aging report | Export from scanner: open vulns with days-open, severity, SLA status | SI-2, RA-5 |
| MTTR metrics by severity | Script against scanner API: median remediation time per severity tier | SI-2 |
| Container scan CI logs | GitHub Actions / GitLab CI artifact from image scan step | SA-11, SI-7 |
| Dependency audit | `npm audit`, `pip audit`, or SCA tool output with remediation plan | SA-11, SI-2 |
| CSPM findings export | AWS Security Hub / Prowler JSON with pass/fail per check | CM-6, SI-4 |
| FIM baseline + alert log | Wazuh/AIDE report showing baseline hash and change detections | SI-7 |

---

## 3. Audit & accountability

If you cannot prove it happened, it did not happen. Logging is the foundation of every other control.

### What to build

**Centralized logging architecture**

```
App logs (structured)  ──▶  Log router (Fluentd/Vector/Datadog)  ──▶  SIEM/Log store
Infra logs (CloudTrail)──▶                                        ──▶  (Splunk/Elastic/
Auth logs (IdP audit)  ──▶  Direct ingest (API/webhook)               CloudWatch)
                                                                        │
                                                                        ▼
                                                                   Alerting (PagerDuty)
```

**What must be logged (non-negotiable for FedRAMP)**

- Authentication events: login success, login failure, MFA challenge, password change, session termination.
- Authorization events: access granted, access denied, privilege escalation.
- Data events: create, read (for sensitive), update, delete on controlled data.
- Administrative events: user creation, role changes, policy changes, configuration changes.
- System events: service start/stop, error conditions, resource exhaustion.

**Log requirements**

- **Structured JSON** with at minimum: timestamp (UTC ISO8601), actor (user/service ID), action, resource, result (success/fail), source IP, correlation ID.
- **Immutable storage.** S3 with Object Lock, CloudWatch Logs with retention policy, or equivalent. No one — including admins — should be able to delete or modify audit logs.
- **Retention:** 1 year online, 3 years archived (FedRAMP).
- **Tamper detection.** CloudTrail log file validation, S3 object checksums, or equivalent integrity verification.

```json
{
  "timestamp": "2025-03-15T14:22:01.003Z",
  "level": "info",
  "event": "auth.login.success",
  "actor": { "userId": "u-abc123", "email": "jane@org.com" },
  "source": { "ip": "10.0.1.42", "userAgent": "Mozilla/5.0..." },
  "resource": { "type": "application", "id": "opengrc" },
  "result": "success",
  "mfa": { "method": "webauthn", "verified": true },
  "correlationId": "req-7f3a9c1e"
}
```

**Alerting rules (minimum)**

- 5+ failed logins in 10 minutes → alert.
- Admin action outside business hours → alert.
- Privilege escalation → alert.
- Log pipeline failure / gap > 15 minutes → P1 alert.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Log source inventory | List of all systems with log destination, format, retention | AU-2, AU-3 |
| Sample log entries | Export 7 days of structured logs from each source | AU-3, AU-6 |
| Log retention proof | S3 lifecycle policy / CloudWatch retention config export | AU-11 |
| Immutability proof | S3 Object Lock config or equivalent tamper protection | AU-9 |
| Alert rule inventory | SIEM rule export with trigger conditions and response playbook | AU-6, SI-4 |
| Weekly log review evidence | Triage notes or ticket from scheduled log review | AU-6 |

---

## 4. Configuration & change management

Configuration management is where "infrastructure as code" meets "compliance as code." If your infrastructure is in Terraform/Pulumi and your deployments are in CI/CD, you are 80% there. The remaining 20% is proving it.

### What to build

**Configuration baselines**

- **Golden images.** Build hardened AMIs/container images from CIS Benchmarks or STIG baselines. Never deploy from stock vendor images.
- **Infrastructure as code.** Every piece of infrastructure in the boundary must be defined in Terraform, Pulumi, CloudFormation, or equivalent. No console-click deployments. The IaC repo IS your configuration baseline.
- **Drift detection.** AWS Config Rules, Azure Policy, or `terraform plan` on a schedule. When drift is detected, either remediate or document the deviation.

```hcl
# Example: Terraform enforcing encryption at rest (S3)
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.audit.arn
    }
    bucket_key_enabled = true
  }
}
```

**Change management process (FedRAMP 20x)**

1. **All changes via pull request.** No direct commits to main. PR requires at least one approval.
2. **CI pipeline runs security checks.** SAST, SCA, linting, unit tests, Terraform plan diff on every PR.
3. **Significant change detection.** Define and tag PRs that change boundary, auth, data flows, or services.
4. **Deployment audit trail.** Every deploy links back to a merged PR. GitHub/GitLab provides this natively.
5. **Rollback capability.** Every deployment must be rollback-able within 15 minutes.

```yaml
# Example: GitHub branch protection as CM evidence
branch_protection:
  branch: main
  required_reviews: 1
  dismiss_stale_reviews: true
  required_status_checks:
    strict: true
    contexts: ["ci/lint", "ci/test", "ci/sast", "ci/sca", "ci/terraform-plan"]
  enforce_admins: true
  allow_force_pushes: false
  allow_deletions: false
```

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| IaC repo with commit history | The Terraform/Pulumi repo — your baseline is the code | CM-2, CM-6 |
| CIS/STIG benchmark scan | `docker-bench-security`, `kube-bench`, or CIS scanner export | CM-6 |
| Branch protection config | GitHub API export or screenshot of branch rules | CM-3, CM-5 |
| Drift detection report | AWS Config compliance snapshot or `terraform plan` output | CM-3, CM-6 |
| Deployment log | CI/CD pipeline run history with PR links | CM-3, CM-5 |
| Change review evidence | Merged PRs with approval metadata for the assessment period | CM-3, CM-4 |

---

## 5. Data protection & encryption

Encryption is non-negotiable. Every piece of controlled data must be encrypted at rest and in transit. The hard part is proving key management is sound.

### What to build

**Encryption at rest**

- **Database:** RDS encryption (AES-256 via KMS). Enable at creation — you cannot retroactively encrypt.
- **Object storage:** S3 SSE-KMS (not SSE-S3 — you need key control for FedRAMP).
- **Disk/volume:** EBS encryption, Azure Disk Encryption, or GCP CMEK.
- **Backups:** Encrypted with separate key from production.

**Encryption in transit**

- **TLS 1.2+ everywhere.** TLS 1.3 preferred. No TLS 1.0/1.1.
- **Internal traffic too.** Service mesh (Istio/Linkerd mTLS) or application-level TLS.
- **Certificate management.** ACM, Let's Encrypt with auto-renewal. No self-signed certs in production.

**Key management**

- **Use a managed KMS** (AWS KMS, Azure Key Vault, GCP Cloud KMS, or HashiCorp Vault).
- **Key rotation:** Annual minimum. Automate it. AWS KMS supports automatic annual rotation.
- **Key access policy:** Least privilege. Only the services that need to encrypt/decrypt get access.
- **Separation of duties:** Key managers should not be data managers.

```hcl
# Example: KMS key with rotation and restricted access
resource "aws_kms_key" "fedramp_data" {
  description             = "FedRAMP data encryption key"
  enable_key_rotation     = true
  deletion_window_in_days = 30
}
```

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Encryption-at-rest inventory | Every data store + encryption method + KMS key ARN | SC-28 |
| TLS configuration proof | SSL Labs scan or `nmap --script ssl-enum-ciphers` output | SC-8, SC-13 |
| KMS key policy export | `aws kms get-key-policy` output for each key | SC-12 |
| Key rotation proof | KMS key metadata showing rotation enabled + last rotation date | SC-12 |
| Certificate inventory | All certs with issuer, expiry, auto-renewal status | SC-17 |

---

## 6. Network architecture & boundary protection

Your network architecture must enforce defense in depth. Assessors will trace data flows and verify that every path is intentional, documented, and protected.

### What to build

**Network segmentation**

- **VPC/VNet isolation.** Production FedRAMP workloads in a dedicated VPC.
- **Subnet tiering.** Public (ALB only), private app, private data. No direct internet from app/data tiers.
- **Security groups.** Default deny. Explicit allow with justification. No `0.0.0.0/0` inbound except LB HTTPS.

```hcl
# Example: Terraform security group - app tier
resource "aws_security_group" "app_tier" {
  name_prefix = "fedramp-app-"
  vpc_id      = aws_vpc.fedramp.id

  ingress {
    description     = "HTTPS from ALB only"
    from_port       = 8080
    to_port         = 8080
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    description     = "DB access"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.data_tier.id]
  }
}
```

**Boundary protection**

- **WAF** on every public endpoint. AWS WAF + OWASP Core Rule Set. Log blocked requests.
- **DDoS protection.** AWS Shield Standard minimum.
- **Egress filtering.** VPC endpoints for AWS services. Restrictive NAT/proxy for everything else.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Architecture / data flow diagram | IaC-derived diagram with all flows labeled | PL-2, SC-7 |
| Security group rules export | `aws ec2 describe-security-groups` or Terraform state | SC-7, AC-4 |
| WAF configuration + logs | WAF rule export + sample blocked-request logs | SC-7, SI-4 |
| VPC flow logs sample | CloudWatch/S3 export for the assessment period | AU-3, SC-7 |
| Egress rule inventory | Every outbound destination with business justification | SC-7(5) |

---

## 7. Incident response & contingency

You need a plan, you need to test it, and you need to prove you tested it.

### What to build

**IR plan** (concise, actionable — not 60 pages):

- Roles and contacts with phone numbers and escalation paths.
- Severity definitions: P1 (breach/outage), P2 (potential compromise), P3 (suspicious activity), P4 (minor).
- Response procedures per severity.
- Communication templates (pre-drafted).
- US-CERT reporting timelines for FedRAMP.

**Test quarterly.** Tabletop exercises with documented date, participants, scenario, decisions, timeline, findings, and improvement actions. Update the plan within 30 days.

**Contingency / DR:**

- RPO and RTO defined and tested. FedRAMP moderate typical: 24h RTO / 1h RPO.
- Automated backups tested — restore quarterly.
- Multi-AZ minimum. Document failover procedure.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| IR plan (current) | Markdown/PDF with review date | IR-1, IR-8 |
| Tabletop exercise report | Documented scenario + findings + actions | IR-3, CP-4 |
| On-call rotation | PagerDuty/OpsGenie export | IR-7 |
| Backup config proof | RDS backup settings, S3 replication config | CP-9 |
| Restore test evidence | Log of successful restore with timestamp | CP-9, CP-10 |

---

## 8. Secure development & supply chain

FedRAMP 20x cares deeply about how you build and what you build with. Your CI/CD pipeline is both your change management evidence and your supply chain control.

### What to build

- **Threat modeling** for architectural changes. STRIDE or kill-chain. Document in design docs.
- **Secure coding standards.** OWASP for your stack, enforced with linters and SAST.
- **SBOM generation** on every release. `syft`, `cdxgen`, or `trivy sbom`.
- **Dependency pinning.** Lockfiles. Container images pinned to digests.
- **Artifact signing.** `cosign` or Notation. Verify before deployment.

```bash
# Generate SBOM and sign container image
syft $IMAGE:$TAG -o cyclonedx-json > sbom.json
cosign sign --key cosign.key $IMAGE@$DIGEST
cosign attest --predicate sbom.json --type cyclonedx $IMAGE@$DIGEST
```

```yaml
# Example: Dependabot for aggressive patching
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
```

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| CI/CD pipeline definition | YAML file + run history | SA-11, CM-3 |
| SAST/SCA scan results | CI artifact exports | SA-11, SI-2 |
| SBOM for current release | CycloneDX/SPDX output | SA-11, SR-4 |
| Dependency update log | Dependabot/Renovate PR history | SI-2, SR-3 |
| Image signing proof | `cosign verify` output | SA-10 |

---

## 9. KSIs & continuous monitoring (20x-specific)

KSIs (Key Security Indicators) are unique to FedRAMP 20x. They are measurable indicators that prove controls are continuously effective — the metrics layer on top of your controls.

### KSI domains and what to measure

| Domain | Key metrics | Source | Target |
|--------|------------|--------|--------|
| Vulnerability management | MTTR by severity, % within SLA, scan coverage % | Scanner API | Critical <15d, High <30d, 100% coverage |
| Access control | Users with MFA %, stale accounts, review completion | IdP API | MFA 100%, stale 0, reviews on schedule |
| Configuration management | Drift count, baseline compliance %, time-to-remediate | CSPM / AWS Config | >95% compliant, drift remediated <48h |
| Incident response | MTTD, MTTR, % with post-mortem | SIEM + ticketing | MTTD <1h, MTTR <4h (P1) |
| Logging & monitoring | Log coverage %, triage time, false positive rate | SIEM | 100% coverage, triage <15m |
| Patch management | Patch currency %, days-overdue by severity | Patch manager | >95% current, zero critical overdue |
| Training | Completion %, phishing click rate | LMS | 100% complete, <5% click rate |

### Monthly ConMon deliverables

Produce a monthly report covering vulnerability posture (counts, SLAs, MTTR), access management (user count, MFA coverage, review status), configuration compliance (passing rules, drift events), incidents (count, severity, post-mortems), and POA&M status (open, overdue, closed this month).

### Automation in OpenGRC

1. Configure **connectors** for scanner, IdP, CSPM → auto-push evidence.
2. Enable **compliance snapshot cron** → captures trend data.
3. Use **CI/CD pipeline gate** (`/pipeline/readiness-check`) → fail deploys below threshold.
4. Use **MCP `compliance_agent_autopilot_v1`** for end-to-end gap-to-evidence flow.

---

## 10. Control closure checklist

A control is not "closed" until all four conditions are met:

1. **IMPLEMENTED** — The control exists in production. Code deployed, config applied, process documented.
2. **EVIDENCED** — At least one artifact proves it works. Dated within the assessment period.
3. **TESTED** — Someone verified it does what it claims. Automated or manual with documented result.
4. **MAINTAINED** — An automated or scheduled process keeps it current.

### Common families and fastest path

| Family | Fastest path | Don't do this |
|--------|-------------|---------------|
| **AC** | SSO + SCIM + RBAC in code + quarterly review script | Manual user spreadsheets, shared accounts |
| **AU** | Structured logging + SIEM + immutable S3 | Unstructured text logs, no retention |
| **CM** | IaC + branch protection + drift detection + CIS scans | Console-click infra, no change tracking |
| **IA** | Federated SSO + MFA everywhere + workload identity | Long-lived API keys, shared passwords |
| **IR** | Documented plan + tested quarterly + PagerDuty | Plan nobody reads, never tested |
| **RA** | Authenticated scans + risk register + remediation SLAs | Unauthenticated scans, unbounded timelines |
| **SC** | TLS 1.2+ everywhere + KMS + network segmentation | Mixed TLS, unencrypted internal, flat network |
| **SI** | Vuln scanning + patching SLAs + FIM + CSPM | Scan but don't patch, no container scanning |

### When a control cannot be closed

1. Document the gap with specific weakness.
2. Add to POA&M with owner, milestones, realistic dates.
3. Assess risk — add to risk register with scoring.
4. Implement compensating controls.
5. If risk must be accepted, use formal approval with expiration.

Never leave a control in limbo. Every control is either `compliant`, on the `POA&M` with a plan, or formally `risk_accepted`.

---

## 11. Wiring automation into OpenGRC

Everything above describes what to build. This section describes how to pipe evidence from your tools into OpenGRC automatically so controls stay closed without manual uploads. OpenGRC exposes three automation surfaces: the **Integration REST API**, **connectors** (scheduled collectors), and **MCP tools** (AI-agent orchestration).

### Architecture: how evidence flows in

```
YOUR TOOLS (scanners, IdP, CI/CD, CSPM, SIEM, ticketing)
       │              │                    │
       ▼              ▼                    ▼
  REST API (push)  Connectors (pull)  MCP tools (AI-agent)
       │              │                    │
       └──────────────┴────────────────────┘
                      │
                      ▼
          OpenGRC → Evidence → Checklist items
                    Control test results
                    Compliance snapshots
                    Readiness % / dashboard
```

### Method 1: Integration REST API (push from CI/CD)

Your CI/CD pipeline produces evidence and pushes it to OpenGRC on every run. All endpoints use `Authorization: Bearer <INTEGRATION_API_KEY>`.

**Push a single evidence artifact:**

```bash
curl -X POST "https://your-opengrc/api/integrations/v1/evidence" \
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_UUID",
    "controlId": "SI-2",
    "framework": "frmr",
    "evidenceType": "container_scan",
    "sourceSystem": "GitHub Actions",
    "sourceConnector": "trivy",
    "assertion": {
      "status": "pass",
      "message": "0 critical, 0 high vulnerabilities",
      "measuredAt": "2025-03-24T14:00:00Z"
    },
    "metadata": { "image": "myapp:v2.1.0", "critical": 0, "high": 0 }
  }'
```

The API resolves `controlId` to a checklist item using framework-aware matching:
- NIST-style: `"SI-2"`, `"AC-2"`, `"SC-28"`
- FRR-style: `"frr:P1:both:CSO:P1_1:null"`
- KSI-style: `"ksi:VM:IND-01:dom"`

**Bulk ingest (idempotent):**

```bash
curl -X POST "https://your-opengrc/api/integrations/v1/evidence/bulk" \
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "YOUR_PROJECT_UUID",
    "idempotencyKey": "ci-run-abc123",
    "items": [
      { "controlId": "SI-2", "evidenceType": "sca_scan", "sourceSystem": "GitHub" },
      { "controlId": "SA-11", "evidenceType": "sast_scan", "sourceSystem": "GitHub" },
      { "controlId": "CM-3", "evidenceType": "ci_pipeline", "sourceSystem": "GitHub" }
    ]
  }'
```

**Gate deployments on compliance readiness:**

```bash
RESULT=$(curl -s -X POST "https://your-opengrc/api/pipeline/check" \
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "projectId": "YOUR_PROJECT_UUID", "minReadinessPct": 95 }')

if [ "$(echo $RESULT | jq -r '.pass')" != "true" ]; then
  echo "COMPLIANCE GATE FAILED: $(echo $RESULT | jq -r '.readinessPct')%"
  exit 1
fi
```

### Method 2: Connectors (scheduled pull)

Connectors are built-in collectors that OpenGRC runs on a cron schedule.

| Connector | What it collects | Key config |
|-----------|-----------------|------------|
| `github` | Repo security, branch protection, Dependabot alerts | `org`, `token` |
| `gitlab` | Similar for GitLab-hosted repos | `url`, `token`, `group` |
| `aws` | Security Hub findings, Config compliance, IAM | `accessKeyId`, `secretAccessKey`, `region` |
| `okta` | User MFA status, policies, system log | `domain`, `apiToken` |
| `entra` | Users/groups, conditional access policies | `tenantId`, `clientId`, `clientSecret` |
| `jira` | Issue tracking for POA&M items | `url`, `email`, `apiToken`, `project` |
| `linear` | Issue tracking for Linear teams | `apiKey`, `teamId` |

**Create a connector:**

```bash
curl -X POST "https://your-opengrc/api/integrations/v1/projects/$PROJECT_ID/connectors" \
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "connectorId": "github",
    "label": "Production repos",
    "enabled": true,
    "config": { "org": "your-org", "token": "ghp_..." },
    "pollIntervalMinutes": 60
  }'
```

Connector secrets are encrypted at rest and redacted in API responses.

### Method 3: MCP tools (AI-agent orchestration)

MCP tools let an AI agent drive the full compliance loop.

**Recommended workflow:**

1. `capabilities_v1` → discover available tools
2. `frmr_taxonomy_v1` → understand 20x requirements
3. `gap_closure_execution_brief_v1` → identify gaps
4. `compliance_agent_autopilot_v1` → fix everything
5. `fedramp_oscal_report_v1` → package for assessor

**One-shot autopilot:**

```json
{
  "strategy": "balanced",
  "createProjectIfMissing": true,
  "projectName": "My FedRAMP System",
  "executionMode": "apply"
}
```

This scans workspace → maps gaps → creates project → generates fixes → links evidence → triggers auto-scope.

### Control ID resolution

| Format | Example | Resolution |
|--------|---------|-----------|
| NIST family | `AC-2`, `SI-7` | KSI controls array or FRR keyword match |
| FRR code | `frr:P1:both:CSO:P1_1:null` | Exact FRMR requirement match |
| KSI code | `ksi:VM:IND-01:dom` | Exact KSI match |
| UUID | `550e8400-e29b-...` | Direct checklist item |
| Manual link | Created via `/controls/link` | Lookup table |

### Complete automation stack

| Frequency | What runs | Controls covered |
|-----------|-----------|-----------------|
| **Every merge** | CI: SCA + container scan + SAST + SBOM + pipeline gate | SI-2, SI-7, SA-11, SR-4, CM-3 |
| **Hourly** | Connectors: GitHub, AWS, Okta | AC-2, IA-2, CM-6, SI-4 |
| **Weekly** | Prowler CSPM, access review diff, SSL scan, Nessus | RA-5, AC-2(3), SC-8 |
| **Monthly** | ConMon report, POA&M review, autopilot gap check | All KSI domains |
| **On demand** | MCP: gap brief, OSCAL export, auto-scope | Assessment readiness |

The result: evidence flows in continuously, readiness stays above threshold, gaps are detected within hours, and assessor preparation is a report export — not a scramble.

---

*This playbook covers FedRAMP 20x implementation practices for cloud-native software teams. Adapt tooling choices to your stack; the principles and evidence requirements are authoritative.*
