import type { DocPaper } from './types';

export const controlsPaper: DocPaper = {
  slug: 'controls',
  title: 'Controls program playbook',
  subtitle:
    'Engineering-level guidance for closing FedRAMP 20x controls: what to build, how to prove it, and how to keep it passing.',
  preamble: `This is a **software engineering playbook**, not a policy document. It tells you what to build, what evidence to produce, and how to close controls in a FedRAMP 20x program. Every section maps to a process area or KSI domain in the FRMR and tells you the **best practice implementation**, the **minimum viable evidence**, and the **automation path** to keep it closed.

> **FedRAMP 20x context:** The 20x path uses the FRMR (FedRAMP Requirements Management Repository) as the authoritative requirements source. Requirements are organized by **process ID** (P1–Pn), scoped by **actor** (CSO, CSX, CISO), filtered by **impact level** (low/moderate/high), and measured by **KSIs** (Key Security Indicators). OpenGRC generates your checklist from this structure—path type \`20x\`, your actors, and your impact level determine what lands on it.`,

  sections: [
    {
      id: 'identity-and-access',
      title: 'Identity & access management',
      body: `This is where most programs fail first and where assessors look hardest. You need to prove that **only the right people and services can reach the right things, and you can show it**.

### What to build

**Authentication infrastructure**

- **SSO with a hardened IdP.** Okta, Entra ID, or Google Workspace as the single source of truth. No local accounts on any system that touches FedRAMP data. If a service cannot federate, it gets a service account with a rotated secret—never a shared human credential.
- **MFA everywhere, no exceptions.** FIDO2/WebAuthn for humans is the gold standard. TOTP is acceptable. SMS is not—assessors will flag it. Enforce MFA at the IdP level so it cannot be bypassed per-app.
- **Phishing-resistant MFA for privileged access.** Admin consoles, CI/CD, infrastructure management, and anything that can modify the authorization boundary must require hardware keys or passkeys.

\`\`\`yaml
# Example: Okta policy for FedRAMP boundary apps
- name: fedramp-boundary-apps
  authentication_policy:
    constraints:
      - type: POSSESSION   # something you have (FIDO2 / passkey)
      - type: KNOWLEDGE    # something you know (password)
    re_auth_frequency: 12h
    session_lifetime: 8h
    mfa_enrollment: REQUIRED
\`\`\`

**Authorization model**

- **RBAC with least privilege enforced in code.** Define roles in your IdP or authorization service. Map them to application permissions. Never grant broad admin—use scoped roles (e.g., \`project:reader\`, \`project:editor\`, \`admin:audit\`).
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

\`\`\`bash
# Nightly access review diff (conceptual)
# Pull active users from IdP, compare against HR system, output delta
python3 scripts/access-review.py \\
  --idp-export okta \\
  --hr-source bamboo \\
  --output-format json \\
  --alert-on-delta \\
  --push-to-opengrc --project-id $PROJECT_ID
\`\`\`

Wire this into a scheduled connector or CI job. Push the output as evidence to OpenGRC via the integration API or MCP \`evidence_link_upsert_v1\`.`,
    },

    {
      id: 'system-integrity',
      title: 'System & information integrity',
      body: `This is your vulnerability management, patching, and anti-tampering posture. Assessors will check scan coverage, remediation SLAs, and whether you actually patch what you find.

### What to build

**Vulnerability scanning stack**

- **Infrastructure:** Authenticated scans with Nessus, Qualys, or Rapid7. Weekly minimum, monthly is the floor for FedRAMP. Authenticated scans—credentialed—are required; unauthenticated scans miss most findings.
- **Container images:** Trivy, Grype, or Snyk in CI/CD. Scan at build time AND on a schedule for running images. Block deploys on critical/high CVEs.
- **Dependencies (SCA):** Dependabot, Renovate, or Snyk for every repo in the boundary. Auto-PR for patches. Alert on known exploited vulnerabilities (CISA KEV).
- **SAST:** Semgrep, CodeQL, or SonarQube in CI. Fail the build on high-severity findings. Review medium findings in sprint.
- **DAST:** ZAP or Burp in CI or nightly against staging. Cover OWASP Top 10.
- **Cloud configuration (CSPM):** AWS Security Hub, Azure Defender, GCP SCC, or Prowler/ScoutSuite. Run continuously.

\`\`\`yaml
# Example: GitHub Actions vulnerability gate
- name: Container scan
  uses: aquasecurity/trivy-action@master
  with:
    image-ref: '\${{ env.IMAGE }}:\${{ github.sha }}'
    format: 'json'
    output: 'trivy-results.json'
    severity: 'CRITICAL,HIGH'
    exit-code: '1'   # Fail the build

- name: Push results to OpenGRC
  if: always()
  run: |
    curl -X POST "$OPENGRC_API/integrations/v1/evidence" \\
      -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
      -H "Content-Type: application/json" \\
      -d @trivy-results.json
\`\`\`

**Patching discipline**

- **Critical/CISA KEV:** 15 days. No exceptions.
- **High:** 30 days.
- **Medium:** 90 days.
- **Low:** Next scheduled maintenance or 180 days.
- **OS patching:** Automate with SSM Patch Manager (AWS), Update Management (Azure), or OS Config (GCP). Immutable infrastructure (rebuild, don't patch) is the best practice—kill the instance and deploy a patched image.
- **Zero-day response:** Have a runbook. "We will assess within 48 hours, patch or mitigate within 14 days, document in POA&M if SLA is exceeded."

**File integrity monitoring**

- AIDE, OSSEC, or Wazuh on every server/container that processes FedRAMP data.
- Baseline on deploy. Alert on unexpected changes. Investigate every alert.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Scan coverage report | Scanner dashboard showing 100% of asset inventory scanned | RA-5, SI-2 |
| Vulnerability aging report | Export from scanner: open vulns with days-open, severity, SLA status | SI-2, RA-5 |
| MTTR metrics by severity | Script against scanner API: median remediation time per severity tier | SI-2 |
| Container scan CI logs | GitHub Actions / GitLab CI artifact from image scan step | SA-11, SI-7 |
| Dependency audit | \`npm audit\`, \`pip audit\`, or SCA tool output with remediation plan | SA-11, SI-2 |
| CSPM findings export | AWS Security Hub / Prowler JSON with pass/fail per check | CM-6, SI-4 |
| FIM baseline + alert log | Wazuh/AIDE report showing baseline hash and change detections | SI-7 |`,
    },

    {
      id: 'audit-and-accountability',
      title: 'Audit & accountability',
      body: `If you cannot prove it happened, it did not happen. Logging is the foundation of every other control—incident response, access reviews, change tracking all depend on it.

### What to build

**Centralized logging architecture**

\`\`\`text
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  App logs     │───▶│  Log router   │───▶│  SIEM / Log  │
│  (structured) │    │  (Fluentd /   │    │  store       │
│               │    │   Vector /    │    │  (Splunk /   │
│  Infra logs   │───▶│   Datadog)   │───▶│   Elastic /  │
│  (CloudTrail, │    │              │    │   CloudWatch │
│   VPC Flow)   │    └──────────────┘    │   Logs)      │
│               │                        └──────────────┘
│  Auth logs    │───▶  Direct ingest          │
│  (IdP audit)  │    (API / webhook)          ▼
└──────────────┘                        ┌──────────────┐
                                        │  Alerting    │
                                        │  (PagerDuty /│
                                        │   OpsGenie)  │
                                        └──────────────┘
\`\`\`

**What must be logged (non-negotiable for FedRAMP)**

- Authentication events: login success, login failure, MFA challenge, password change, session termination.
- Authorization events: access granted, access denied, privilege escalation.
- Data events: create, read (for sensitive), update, delete on controlled data.
- Administrative events: user creation, role changes, policy changes, configuration changes.
- System events: service start/stop, error conditions, resource exhaustion.

**Log requirements**

- **Structured JSON** with at minimum: timestamp (UTC ISO8601), actor (user/service ID), action, resource, result (success/fail), source IP, correlation ID.
- **Immutable storage.** S3 with Object Lock, CloudWatch Logs with retention policy, or equivalent. No one—including admins—should be able to delete or modify audit logs.
- **Retention:** 1 year online, 3 years archived (FedRAMP). Ensure your log store actually retains this long.
- **Tamper detection.** CloudTrail log file validation, S3 object checksums, or equivalent integrity verification.

\`\`\`json
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
\`\`\`

**Alerting rules (minimum)**

- 5+ failed logins in 10 minutes → alert.
- Admin action outside business hours → alert.
- Privilege escalation → alert.
- Log pipeline failure / gap > 15 minutes → P1 alert (your logging is your audit trail—if it stops, you are blind).

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Log source inventory | List of all systems with log destination, format, retention | AU-2, AU-3 |
| Sample log entries | Export 7 days of structured logs from each source | AU-3, AU-6 |
| Log retention proof | S3 lifecycle policy / CloudWatch retention config export | AU-11 |
| Immutability proof | S3 Object Lock config or equivalent tamper protection | AU-9 |
| Alert rule inventory | SIEM rule export with trigger conditions and response playbook | AU-6, SI-4 |
| Weekly log review evidence | Triage notes or ticket from scheduled log review | AU-6 |`,
    },

    {
      id: 'configuration-management',
      title: 'Configuration & change management',
      body: `Configuration management is where "infrastructure as code" meets "compliance as code." If your infrastructure is in Terraform/Pulumi and your deployments are in CI/CD, you are 80% there. The remaining 20% is proving it.

### What to build

**Configuration baselines**

- **Golden images.** Build hardened AMIs/container images from CIS Benchmarks or STIG baselines. Never deploy from stock vendor images. Document deviations from the benchmark with rationale.
- **Infrastructure as code.** Every piece of infrastructure in the boundary must be defined in Terraform, Pulumi, CloudFormation, or equivalent. No console-click deployments. The IaC repo IS your configuration baseline.
- **Drift detection.** AWS Config Rules, Azure Policy, or \`terraform plan\` on a schedule. When drift is detected, either remediate or document the deviation.

\`\`\`hcl
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

# AWS Config rule to detect non-compliant buckets
resource "aws_config_config_rule" "s3_encryption" {
  name = "s3-bucket-server-side-encryption-enabled"
  source {
    owner             = "AWS"
    source_identifier = "S3_BUCKET_SERVER_SIDE_ENCRYPTION_ENABLED"
  }
}
\`\`\`

**Change management process**

For FedRAMP 20x, the change management process must be **visible and auditable in your source control and CI/CD pipeline**:

1. **All changes via pull request.** No direct commits to main. PR requires at least one approval from someone who did not write the code.
2. **CI pipeline runs security checks.** SAST, SCA, linting, unit tests, and a Terraform plan diff on every PR.
3. **Significant change detection.** Define what constitutes a significant change (boundary change, new service, new data flow, auth change). Tag these PRs for security review.
4. **Deployment audit trail.** Every deploy links back to a merged PR, which links to an approved change. GitHub/GitLab provides this natively.
5. **Rollback capability.** Every deployment must be rollback-able within 15 minutes. Blue/green, canary, or container-based rollback.

\`\`\`yaml
# Example: GitHub branch protection as CM evidence
branch_protection:
  branch: main
  required_reviews: 1
  dismiss_stale_reviews: true
  require_code_owner_reviews: true
  required_status_checks:
    strict: true
    contexts:
      - "ci/lint"
      - "ci/test"
      - "ci/sast"
      - "ci/sca"
      - "ci/terraform-plan"
  enforce_admins: true          # Even admins cannot bypass
  allow_force_pushes: false
  allow_deletions: false
\`\`\`

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| IaC repo with commit history | The Terraform/Pulumi repo itself—your baseline is the code | CM-2, CM-6 |
| CIS/STIG benchmark scan | \`docker-bench-security\`, \`kube-bench\`, or CIS scanner export | CM-6 |
| Branch protection config | GitHub API export or screenshot of branch rules | CM-3, CM-5 |
| Drift detection report | AWS Config compliance snapshot or \`terraform plan\` output | CM-3, CM-6 |
| Deployment log | CI/CD pipeline run history with PR links | CM-3, CM-5 |
| Change review evidence | Merged PRs with approval metadata for the assessment period | CM-3, CM-4 |
| Significant change log | Tagged PRs or change advisory board (CAB) records | CM-3(2) |`,
    },

    {
      id: 'data-protection',
      title: 'Data protection & encryption',
      body: `Encryption is non-negotiable. Every piece of controlled data must be encrypted at rest and in transit. The hard part is proving key management is sound.

### What to build

**Encryption at rest**

- **Database:** RDS encryption (AES-256 via KMS), or application-level encryption for highly sensitive fields. Enable encryption at creation—you cannot retroactively encrypt an RDS instance without migration.
- **Object storage:** S3 SSE-KMS (not SSE-S3—you need key control for FedRAMP). Default encryption on every bucket.
- **Disk/volume:** EBS encryption, Azure Disk Encryption, or GCP CMEK.
- **Backups:** Encrypted with separate key from production. Test restore periodically.

**Encryption in transit**

- **TLS 1.2+ everywhere.** TLS 1.3 preferred. No TLS 1.0/1.1—kill it at the load balancer.
- **Internal traffic too.** Service-to-service communication within the boundary must be encrypted. Service mesh (Istio/Linkerd mTLS) or application-level TLS.
- **Certificate management.** ACM (AWS), Let's Encrypt with auto-renewal, or a managed CA. No self-signed certs in production. Monitor expiration.

**Key management**

- **Use a managed KMS** (AWS KMS, Azure Key Vault, GCP Cloud KMS, or HashiCorp Vault). Do not manage keys manually.
- **Key rotation:** Annual minimum. Automate it. AWS KMS supports automatic annual rotation.
- **Key access policy:** Least privilege. Only the services that need to encrypt/decrypt get access. Admin key access logged and alerted.
- **Separation of duties:** The team that manages keys should not be the same team that manages data.

\`\`\`hcl
# Example: KMS key with rotation and restricted access
resource "aws_kms_key" "fedramp_data" {
  description             = "FedRAMP data encryption key"
  enable_key_rotation     = true   # Automatic annual rotation
  deletion_window_in_days = 30

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowKeyAdmin"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::role/KeyAdmin" }
        Action    = ["kms:Create*", "kms:Describe*", "kms:Enable*",
                     "kms:List*", "kms:Put*", "kms:Update*",
                     "kms:Revoke*", "kms:Disable*", "kms:Delete*",
                     "kms:ScheduleKeyDeletion", "kms:CancelKeyDeletion"]
        Resource  = "*"
      },
      {
        Sid    = "AllowAppEncryptDecrypt"
        Effect = "Allow"
        Principal = { AWS = "arn:aws:iam::role/AppServiceRole" }
        Action    = ["kms:Encrypt", "kms:Decrypt", "kms:GenerateDataKey"]
        Resource  = "*"
      }
    ]
  })
}
\`\`\`

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Encryption-at-rest inventory | List every data store + encryption method + KMS key ARN | SC-28 |
| TLS configuration proof | SSL Labs scan or \`nmap --script ssl-enum-ciphers\` output | SC-8, SC-13 |
| KMS key policy export | \`aws kms get-key-policy\` output for each key | SC-12 |
| Key rotation proof | KMS key metadata showing rotation enabled + last rotation date | SC-12 |
| Certificate inventory | List of all certs with issuer, expiry, auto-renewal status | SC-17 |
| Internal mTLS proof | Service mesh config export or network capture showing TLS internal | SC-8(1) |`,
    },

    {
      id: 'network-security',
      title: 'Network architecture & boundary protection',
      body: `Your network architecture must enforce defense in depth. Assessors will trace data flows and verify that every path is intentional, documented, and protected.

### What to build

**Network segmentation**

- **VPC/VNet isolation.** Production FedRAMP workloads in a dedicated VPC. No shared VPCs with non-FedRAMP workloads.
- **Subnet tiering.** Public subnet (ALB/NLB only), private app subnet, private data subnet. No direct internet access from app or data tiers.
- **Security groups / NSGs.** Default deny. Explicit allow rules with justification for each. No \`0.0.0.0/0\` inbound except on the load balancer's HTTPS port.

\`\`\`hcl
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
    description = "HTTPS to data tier"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    security_groups = [aws_security_group.data_tier.id]
  }

  egress {
    description = "HTTPS to AWS APIs (KMS, S3, STS)"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    prefix_list_ids = [data.aws_prefix_list.s3.id]
  }

  # No other egress - default deny
}
\`\`\`

**Boundary protection**

- **WAF** on every public-facing endpoint. AWS WAF, Cloudflare, or equivalent. Enable OWASP Core Rule Set. Log every blocked request.
- **DDoS protection.** AWS Shield (Standard is automatic, Advanced for higher assurance), Cloudflare, or equivalent.
- **Egress filtering.** Your app tier should only talk to known destinations. Use VPC endpoints for AWS services. Proxy or NAT with restrictive rules for anything else.
- **DNS security.** DNSSEC where supported. Internal DNS resolution for private resources.

**Network flow documentation**

Create an authoritative data flow diagram. Not a Visio from 2 years ago—a diagram generated from your IaC or maintained alongside it.

\`\`\`text
Internet → CloudFront (TLS 1.2+) → ALB (TLS termination)
  → App tier (private subnet, port 8080)
    → PostgreSQL RDS (private subnet, port 5432, encrypted)
    → S3 (VPC endpoint, SSE-KMS)
    → KMS (VPC endpoint)
  → Entra ID (HTTPS, federation)
  → CloudWatch Logs (VPC endpoint)
\`\`\`

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Architecture / data flow diagram | IaC-derived or maintained diagram with all flows labeled | PL-2, SC-7 |
| Security group / NSG rules export | \`aws ec2 describe-security-groups\` or Terraform state | SC-7, AC-4 |
| WAF configuration + logs | WAF rule export + sample blocked-request logs | SC-7, SI-4 |
| VPC flow logs sample | CloudWatch/S3 export of VPC flow logs for the assessment period | AU-3, SC-7 |
| Egress rule inventory | Document every allowed outbound destination with business justification | SC-7(5) |
| Network segmentation test | Penetration test or \`nmap\` scan proving app tier cannot reach internet directly | SC-7 |`,
    },

    {
      id: 'incident-response',
      title: 'Incident response & contingency',
      body: `You need a plan, you need to test it, and you need to prove you tested it. Assessors will ask for the plan, the test results, and the lessons learned.

### What to build

**Incident response plan**

Write a concise, actionable IR plan—not a 60-page document nobody reads. It must cover:

- **Roles and contacts.** Incident commander, security lead, engineering lead, communications lead, legal. With phone numbers and escalation paths.
- **Severity definitions.** P1 (breach of controlled data, service down), P2 (potential compromise, degraded service), P3 (suspicious activity, no confirmed impact), P4 (policy violation, minor issue).
- **Response procedures per severity.** For each level: who is notified, within what timeframe, what actions are taken, and what is documented.
- **Communication templates.** Pre-drafted messages for internal stakeholders, customers, and regulators. Do not write these during an incident.
- **Reporting obligations.** US-CERT notification timelines for FedRAMP. Breach notification requirements.

**Test the plan (tabletop exercise)**

- **Annually at minimum.** Quarterly is better. Rotate scenarios: ransomware, insider threat, data exfiltration, third-party compromise.
- **Document everything:** date, participants, scenario, decisions made, timeline, findings, improvement actions.
- **Feed findings back into the plan.** Update the IR plan within 30 days of the exercise.

\`\`\`markdown
## Tabletop exercise record

**Date:** 2025-03-10
**Scenario:** Compromised CI/CD pipeline pushing malicious container image
**Participants:** [names]

### Timeline
- T+0: Detection via container scan alert in Slack
- T+5m: Incident commander activated
- T+15m: Pipeline disabled, last 3 deployments identified
- T+30m: Rollback initiated to last known-good image
- T+1h: Root cause: compromised GitHub PAT in environment variable

### Findings
1. PAT rotation was overdue by 45 days → Action: automate PAT rotation
2. Container scan alert went to a low-priority channel → Action: route to PagerDuty
3. No runbook for "compromised CI/CD" → Action: write runbook by 2025-04-01
\`\`\`

**Contingency / disaster recovery**

- **RPO and RTO defined and tested.** What is your maximum acceptable data loss (RPO) and maximum downtime (RTO)? For FedRAMP moderate: 24h RTO / 1h RPO is common. High: tighter.
- **Automated backups tested.** RDS automated backups, S3 cross-region replication, or equivalent. **Test a restore quarterly** — untested backups are not backups.
- **Multi-AZ or multi-region.** At minimum, multi-AZ for production. Document your failover procedure and test it.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| IR plan (current, reviewed annually) | Markdown/PDF with review date in header | IR-1, IR-8 |
| Tabletop exercise report | Document per format above | IR-3, CP-4 |
| On-call rotation schedule | PagerDuty/OpsGenie export showing 24/7 coverage | IR-7 |
| Incident log (last 12 months) | Ticketing system export with timeline and resolution | IR-5, IR-6 |
| Backup configuration proof | RDS backup settings, S3 replication config | CP-9 |
| Restore test evidence | Screenshot/log of successful restore with timestamp | CP-9, CP-10 |
| BCP/DR plan | Document with RPO/RTO targets and failover procedure | CP-2 |`,
    },

    {
      id: 'supply-chain-and-dev',
      title: 'Secure development & supply chain',
      body: `FedRAMP 20x cares deeply about how you build and what you build with. Your CI/CD pipeline is both your change management evidence and your supply chain control.

### What to build

**Secure development lifecycle**

- **Threat modeling.** Before building a new feature that touches the boundary, identify threats. STRIDE or kill-chain-based. Document in the design doc or ADR. You do not need a formal threat model for every PR—do it for architectural changes.
- **Secure coding standards.** Adopt OWASP guidance for your stack. Enforce with linters and SAST. Document which standards apply and how they are enforced.
- **Code review policy.** All code changes reviewed by at least one person who did not author them. Security-sensitive changes (auth, crypto, access control) reviewed by someone with security context.

**Supply chain security**

\`\`\`yaml
# Example: Dependabot config for aggressive patching
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "daily"
    open-pull-requests-limit: 10
    labels:
      - "dependencies"
      - "security"
    # Auto-merge patch updates after CI passes
    groups:
      patch-updates:
        update-types: ["patch"]

  - package-ecosystem: "docker"
    directory: "/"
    schedule:
      interval: "weekly"
\`\`\`

- **SBOM generation.** Generate a Software Bill of Materials on every release. \`syft\`, \`cdxgen\`, or \`trivy sbom\`. Store it alongside the release artifact.
- **Dependency pinning.** Use lockfiles (\`package-lock.json\`, \`poetry.lock\`, \`go.sum\`). Pin container base images to digests, not tags.
- **Artifact signing.** Sign container images with \`cosign\` or Notation. Verify signatures before deployment.
- **Provenance.** Use SLSA framework concepts: build provenance attestations showing what was built, from what source, by what pipeline.

\`\`\`bash
# Generate SBOM and sign container image
syft $IMAGE:$TAG -o cyclonedx-json > sbom.json
cosign sign --key cosign.key $IMAGE@$DIGEST
cosign attest --predicate sbom.json --type cyclonedx $IMAGE@$DIGEST
\`\`\`

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| CI/CD pipeline definition | The YAML file itself + run history | SA-11, CM-3 |
| SAST/SCA scan results (last 90 days) | CI artifact exports showing scan ran and results addressed | SA-11, SI-2 |
| SBOM for current release | \`syft\` or \`cdxgen\` output in CycloneDX/SPDX format | SA-11, SR-4 |
| Dependency update log | Dependabot/Renovate PR history showing patches merged | SI-2, SR-3 |
| Image signing verification | \`cosign verify\` output for production images | SA-10 |
| Branch protection + review policy | GitHub API export showing PR requirements enforced | SA-11, CM-5 |
| Threat model (for major features) | Design doc or ADR with threat analysis | SA-8, SA-15 |`,
    },

    {
      id: 'personnel-and-training',
      title: 'Personnel security & awareness training',
      body: `This domain is often underestimated by engineering teams. It covers onboarding, offboarding, background checks, and security awareness—and it produces some of the most commonly missing evidence.

### What to build

- **Background checks before access.** Every person with access to the FedRAMP boundary must have a background check completed before they receive credentials. Document the check, do not store the results—just the attestation that it was completed and passed.
- **Security awareness training.** Annual minimum, within 30 days of onboarding. Use KnowBe4, Proofpoint, or equivalent. Track completion in an LMS and export the report.
- **Role-based training.** Developers get secure coding training. Admins get privileged access training. Incident responders get IR-specific training. Document which roles require which training.
- **Acceptable use policy.** Signed by every person with access. Annual re-attestation.
- **Offboarding.** Tied to access deprovisioning (see Identity & Access section). Verify credential revocation, equipment return, and NDA continuation.

### Evidence that closes controls

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Training completion report | LMS export showing all in-scope personnel completed training | AT-2 |
| Role-based training matrix | Table: role → required training → completion status | AT-3 |
| Background check attestation log | HR system export or spreadsheet with check date, pass/fail, no PII | PS-3 |
| Signed acceptable use agreements | DocuSign/equivalent export or scanned copies | PL-4, PS-6 |
| Offboarding checklist evidence | Completed checklists showing access revoked, equipment returned | PS-4 |

> **Automation tip:** Integrate your LMS with your IdP. Block access to FedRAMP boundary apps until training is completed. This turns a manual audit into an automated gate.`,
    },

    {
      id: 'ksi-and-continuous-monitoring',
      title: 'KSIs & continuous monitoring (20x-specific)',
      body: `**KSIs (Key Security Indicators) are unique to FedRAMP 20x.** They are measurable indicators that assessors use to evaluate whether your security controls are not just implemented but are continuously effective. Think of them as the metrics layer on top of your controls.

### How KSIs work in 20x

In the FRMR, KSIs are organized by **domain** (e.g., personnel management, access control, vulnerability management) and link to underlying controls. When you create a 20x project in OpenGRC, KSIs are included in your checklist alongside FRR requirements.

**KSIs are not new controls—they are measurements of existing controls.** For example, a KSI might measure "percentage of critical vulnerabilities remediated within SLA" rather than simply requiring that you have a vulnerability management program.

### What to build

**Metrics pipeline**

Your continuous monitoring strategy must produce quantifiable, exportable metrics for each KSI domain:

\`\`\`text
┌───────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Source systems    │────▶│  Metrics engine   │────▶│  Dashboard / │
│  (scanner, IdP,   │     │  (script, ETL,    │     │  OpenGRC     │
│   SIEM, CI/CD)    │     │   or integration) │     │  snapshots   │
│                    │     │                    │     │              │
│  Raw telemetry     │     │  KSI calculations  │     │  Trend data  │
└───────────────────┘     └──────────────────┘     └──────────────┘
\`\`\`

**KSI domains and what to measure**

| Domain | Key metrics | Source | Target |
|--------|------------|--------|--------|
| Vulnerability management | MTTR by severity, % within SLA, scan coverage % | Scanner API | Critical: <15d, High: <30d, coverage: 100% |
| Access control | Users with MFA %, stale accounts, quarterly review completion | IdP API | MFA: 100%, stale: 0, reviews: 100% on schedule |
| Configuration management | Drift detection count, baseline compliance %, time-to-remediate drift | CSPM / AWS Config | Compliance: >95%, drift remediated <48h |
| Incident response | MTTD, MTTR, % incidents with post-mortem | SIEM + ticketing | MTTD: <1h, MTTR: <4h (P1) |
| Logging & monitoring | Log coverage %, alert-to-triage time, false positive rate | SIEM | Coverage: 100%, triage: <15m |
| Patch management | Patch currency %, days-overdue by severity | Patch manager | Currency: >95%, zero critical overdue |
| Training | Completion %, on-time %, phishing simulation click rate | LMS | Completion: 100%, click rate: <5% |

### Monthly ConMon deliverables (FedRAMP 20x)

\`\`\`markdown
## Monthly continuous monitoring report — March 2025

### Vulnerability posture
- Total vulns: 142 (↓12 from Feb)
- Critical: 0 (SLA: 0 overdue) ✅
- High: 8 (SLA: 2 approaching, 0 overdue) ✅
- MTTR (critical): 4.2 days
- Scan coverage: 100% (48/48 assets)

### Access management
- Active accounts: 34
- MFA enforced: 34/34 (100%) ✅
- Quarterly access review: completed 2025-03-15
- Stale accounts removed: 2

### Configuration compliance
- AWS Config rules passing: 47/48 (97.9%)
- Non-compliant: 1 (S3 versioning on temp bucket — remediation ticket GRC-6612)
- Drift events detected/remediated: 3/3

### Incidents
- Total incidents: 1 (P3 — suspicious login from new geo, confirmed legitimate travel)
- Post-mortem: N/A (P3, documented in ticket)

### POA&M status
- Open items: 4
- Overdue: 0 ✅
- Closed this month: 2
\`\`\`

### Automation path in OpenGRC

1. **Configure connectors** for your scanner, IdP, and CSPM tools. Connectors push evidence into checklist items automatically.
2. **Enable the compliance snapshot cron.** This captures readiness %, control status, and posture metrics on a schedule—creating the trend data assessors want to see.
3. **Use the CI/CD pipeline gate** (\`POST /pipeline/check\`). Set a readiness threshold (e.g., 95%). Fail deploys that drop below it. Embed the compliance badge (\`GET /pipeline/badge/:projectId\`) in your repo README for visibility.
4. **Generate reports** via the API: \`compliance-summary\`, \`risk-posture\`, \`executive-briefing\`. Or use MCP \`compliance_agent_autopilot_v1\` for end-to-end gap-to-evidence flow.

### Evidence that closes KSIs

| What to produce | How to produce it | Maps to |
|----------------|-------------------|---------|
| Monthly ConMon report | Template above, populated from dashboards/scripts | All KSI domains |
| KSI trend data (6+ months) | OpenGRC compliance snapshots showing readiness over time | KSI continuous assessment |
| Automated evidence feed | Connector outputs (scanner, IdP, CSPM) pushed to OpenGRC | Per-domain KSIs |
| Risk register (current) | OpenGRC risk register export with scoring and treatment plans | KSI risk domain |
| POA&M (current) | OpenGRC POA&M export with milestones and SLA status | KSI remediation domain |`,
    },

    {
      id: 'closing-controls-checklist',
      title: 'Control closure checklist',
      body: `Use this as your definition of done for every control. A control is not "closed" until all four conditions are met.

### The four conditions

\`\`\`text
┌─────────────────────────────────────────────────────────┐
│  ✅  1. IMPLEMENTED                                      │
│      The control exists in production. Code deployed,    │
│      config applied, process documented.                 │
│                                                          │
│  ✅  2. EVIDENCED                                         │
│      At least one artifact proves it works. Scan report, │
│      log export, config export, or test result. Dated    │
│      within the assessment period.                       │
│                                                          │
│  ✅  3. TESTED                                            │
│      Someone verified it does what it claims. Automated  │
│      test in CI, manual test with documented result, or  │
│      assessor observation.                               │
│                                                          │
│  ✅  4. MAINTAINED                                        │
│      There is an automated or scheduled process to keep  │
│      it current. Scan schedule, review cadence, rotation │
│      policy, drift detection.                            │
└─────────────────────────────────────────────────────────┘
\`\`\`

### Common control families and fastest path to closure

| Family | Fastest path | Don't do this |
|--------|-------------|---------------|
| **AC (Access)** | SSO + SCIM + RBAC in code + quarterly review script | Manual user spreadsheets, shared accounts, local auth |
| **AU (Audit)** | Structured logging + centralized SIEM + immutable S3 | Unstructured text logs, no retention policy, logs on the instance |
| **CM (Config)** | IaC + branch protection + drift detection + CIS scans | Console-click infra, no change tracking, golden images from 2022 |
| **IA (Identity)** | Federated SSO + MFA everywhere + workload identity | Long-lived API keys, shared passwords, no MFA exceptions |
| **IR (Incident)** | Documented plan + tested quarterly + PagerDuty on-call | Plan that nobody has read, never tested, no on-call rotation |
| **RA (Risk)** | Authenticated scans + risk register + remediation SLAs | Unauthenticated scans, no risk tracking, unbounded fix timelines |
| **SC (System/Comms)** | TLS 1.2+ everywhere + KMS encryption + network segmentation | Mixed TLS versions, unencrypted internal traffic, flat network |
| **SI (System Integrity)** | Vuln scanning + patching SLAs + FIM + CSPM | Scan but don't patch, no container scanning, no drift detection |

### Working in OpenGRC

1. **Create project** with path type \`20x\`, your impact level, and actor labels (e.g., \`CSO\`).
2. **Checklist generates** from FRMR—FRR requirements + KSIs land as actionable rows.
3. **For each row:** implement the control, attach evidence, update status (\`in_progress\` → \`compliant\`).
4. **Run auto-scoping** to get applicability recommendations with rationale—approve or reject.
5. **Monitor readiness %** on the dashboard. Target: 100% before assessment, with zero \`non_compliant\` items.
6. **Export:** POA&M for open items, OSCAL SSP + POA&M for the authorization package.
7. **Continuous:** Compliance snapshot cron tracks posture over time. Connectors keep evidence fresh.

### When something is not closeable

If a control cannot be fully implemented:

1. **Document the gap** with specific weakness, not vague language.
2. **Add to POA&M** with owner, milestones, and realistic dates.
3. **Assess the risk** — add to the risk register with inherent/residual scores.
4. **Implement compensating controls** where possible and document them.
5. **If risk must be accepted**, use the formal risk acceptance workflow with AO approval, expiration date, and re-evaluation triggers.

Never leave a control in limbo. Every control is either \`compliant\`, on the \`POA&M\` with a plan, or formally \`risk_accepted\`.`,
    },

    {
      id: 'wiring-automation',
      title: 'Wiring automation into OpenGRC',
      body: `Everything above describes what to build. This section describes how to **pipe evidence from your tools into OpenGRC automatically** so controls stay closed without manual uploads. OpenGRC exposes three automation surfaces: the **Integration REST API**, **connectors** (scheduled collectors), and **MCP tools** (AI-agent orchestration).

### Architecture: how evidence flows in

\`\`\`text
┌──────────────────────────────────────────────────────────────────┐
│  YOUR TOOLS                                                      │
│  (scanners, IdP, CI/CD, CSPM, SIEM, ticketing)                 │
└──────┬───────────┬────────────────────┬─────────────────────────┘
       │           │                    │
       ▼           ▼                    ▼
┌──────────┐ ┌───────────┐  ┌────────────────────────────────────┐
│ REST API │ │ Connectors│  │  MCP tools                         │
│ (push)   │ │ (pull)    │  │  (AI-agent orchestration)          │
│          │ │           │  │                                    │
│ You POST │ │ OpenGRC   │  │  Cursor / Claude / any MCP client  │
│ evidence │ │ polls on  │  │  calls tools that hit the same API │
│ on every │ │ a cron    │  │                                    │
│ CI run   │ │ schedule  │  │  compliance_agent_autopilot_v1     │
└────┬─────┘ └─────┬─────┘  └──────────────┬─────────────────────┘
     │             │                        │
     └─────────────┴────────────────────────┘
                   │
                   ▼
     ┌──────────────────────────────┐
     │  OpenGRC                     │
     │  Evidence → Checklist items  │
     │  Control test results        │
     │  Compliance snapshots        │
     │  Readiness % / dashboard     │
     └──────────────────────────────┘
\`\`\`

---

### Method 1: Integration REST API (push from CI/CD)

This is the most common pattern. Your CI/CD pipeline produces evidence (scan results, test reports, SBOM) and pushes it to OpenGRC on every run. All endpoints use \`Authorization: Bearer <INTEGRATION_API_KEY>\`.

**Step 1: Set your integration key**

Set the \`INTEGRATION_API_KEY\` environment variable on the OpenGRC API. This is the bearer token your CI jobs will use.

**Step 2: Push a single evidence artifact**

\`\`\`bash
# Push a Trivy container scan result after CI build
curl -X POST "https://your-opengrc/api/integrations/v1/evidence" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json" \\
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
    "metadata": {
      "image": "myapp:v2.1.0",
      "totalVulns": 3,
      "critical": 0,
      "high": 0
    }
  }'
\`\`\`

The API resolves \`controlId\` to a checklist item using framework-aware matching. For FRMR you can use:
- NIST-style: \`"SI-2"\`, \`"AC-2"\`, \`"SC-28"\`
- FRR-style: \`"frr:P1:both:CSO:P1_1:null"\`
- KSI-style: \`"ksi:VM:IND-01:dom"\`

**Step 3: Push evidence in bulk (batch ingest)**

\`\`\`bash
# Push multiple scan results in one call (idempotent)
curl -X POST "https://your-opengrc/api/integrations/v1/evidence/bulk" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_UUID",
    "idempotencyKey": "ci-run-abc123",
    "items": [
      {
        "controlId": "SI-2",
        "evidenceType": "sca_scan",
        "sourceSystem": "GitHub",
        "assertion": { "status": "pass", "message": "npm audit: 0 critical" }
      },
      {
        "controlId": "SA-11",
        "evidenceType": "sast_scan",
        "sourceSystem": "GitHub",
        "assertion": { "status": "pass", "message": "Semgrep: 0 high findings" }
      },
      {
        "controlId": "CM-3",
        "evidenceType": "ci_pipeline",
        "sourceSystem": "GitHub",
        "assertion": { "status": "pass", "message": "All checks passed on PR #142" }
      }
    ]
  }'
\`\`\`

The \`idempotencyKey\` prevents duplicate ingestion if your pipeline retries. Same key + same payload = cached response with \`replayed: true\`.

**Step 4: Wire it into GitHub Actions**

\`\`\`yaml
# .github/workflows/compliance-evidence.yml
name: Compliance evidence push
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 6 * * 1'   # Weekly Monday 6am

jobs:
  evidence:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # --- Run your scans ---
      - name: SCA scan
        run: npm audit --json > sca-results.json || true

      - name: Container scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: myapp:latest
          format: json
          output: trivy-results.json

      - name: SAST scan
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten

      # --- Push all results to OpenGRC ---
      - name: Push evidence to OpenGRC
        env:
          OPENGRC_URL: \${{ secrets.OPENGRC_URL }}
          API_KEY: \${{ secrets.OPENGRC_API_KEY }}
          PROJECT_ID: \${{ secrets.OPENGRC_PROJECT_ID }}
        run: |
          curl -X POST "$OPENGRC_URL/integrations/v1/evidence/bulk" \\
            -H "Authorization: Bearer $API_KEY" \\
            -H "Content-Type: application/json" \\
            -d "{
              \\"projectId\\": \\"$PROJECT_ID\\",
              \\"idempotencyKey\\": \\"gha-$GITHUB_RUN_ID\\",
              \\"items\\": [
                {
                  \\"controlId\\": \\"SI-2\\",
                  \\"evidenceType\\": \\"sca_scan\\",
                  \\"sourceSystem\\": \\"GitHub Actions\\",
                  \\"sourceRunId\\": \\"$GITHUB_RUN_ID\\"
                },
                {
                  \\"controlId\\": \\"SI-7\\",
                  \\"evidenceType\\": \\"container_scan\\",
                  \\"sourceSystem\\": \\"GitHub Actions\\",
                  \\"sourceRunId\\": \\"$GITHUB_RUN_ID\\"
                },
                {
                  \\"controlId\\": \\"SA-11\\",
                  \\"evidenceType\\": \\"sast_scan\\",
                  \\"sourceSystem\\": \\"GitHub Actions\\",
                  \\"sourceRunId\\": \\"$GITHUB_RUN_ID\\"
                }
              ]
            }"
\`\`\`

**Step 5: Gate deployments on compliance readiness**

\`\`\`bash
# In your deploy pipeline — fail if readiness drops below threshold
RESULT=$(curl -s -X POST "https://your-opengrc/api/pipeline/check" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "projectId": "YOUR_PROJECT_UUID", "minReadinessPct": 95 }')

PASS=$(echo $RESULT | jq -r '.pass')
PCT=$(echo $RESULT | jq -r '.readinessPct')

if [ "$PASS" != "true" ]; then
  echo "COMPLIANCE GATE FAILED: readiness is $PCT% (minimum 95%)"
  exit 1
fi
echo "Compliance gate passed: $PCT% readiness"
\`\`\`

---

### Method 2: Connectors (scheduled pull)

Connectors are built-in collectors that OpenGRC runs on a schedule. They pull evidence from external systems and map it to checklist items automatically.

**Available connectors**

| Connector ID | What it collects | Config keys |
|-------------|-----------------|-------------|
| \`github\` | Repository metadata, branch protection, PR review status, Dependabot alerts | \`org\`, \`token\`, \`include_private\` |
| \`gitlab\` | Similar to GitHub for GitLab-hosted repos | \`url\`, \`token\`, \`group\` |
| \`aws\` | Security Hub findings, Config compliance, IAM summary | \`accessKeyId\`, \`secretAccessKey\`, \`region\` |
| \`okta\` | User list with MFA status, policy config, system log events | \`domain\`, \`apiToken\` |
| \`entra\` | Entra ID user/group info, conditional access policies | \`tenantId\`, \`clientId\`, \`clientSecret\` |
| \`jira\` | Issue tracking for POA&M items, remediation tickets | \`url\`, \`email\`, \`apiToken\`, \`project\` |
| \`linear\` | Similar to Jira for Linear-based teams | \`apiKey\`, \`teamId\` |
| \`slack\` | Channel monitoring for compliance notifications | \`botToken\`, \`channel\` |
| \`teams\` | Teams channel notifications | \`webhookUrl\` |

**Create a connector instance (REST)**

\`\`\`bash
# Create a GitHub connector that polls every 60 minutes
curl -X POST "https://your-opengrc/api/integrations/v1/projects/$PROJECT_ID/connectors" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "connectorId": "github",
    "label": "Production repos",
    "enabled": true,
    "config": {
      "org": "your-org",
      "token": "ghp_your_token",
      "include_private": true
    },
    "pollIntervalMinutes": 60
  }'
\`\`\`

**Create a connector instance (MCP)**

\`\`\`json
// MCP tool: connectors_create_v1
{
  "projectId": "YOUR_PROJECT_UUID",
  "connectorId": "aws",
  "label": "Production AWS account",
  "config": {
    "accessKeyId": "AKIA...",
    "secretAccessKey": "...",
    "region": "us-east-1"
  }
}
\`\`\`

**How connectors work internally**

1. The scheduler checks enabled connector instances every minute.
2. If \`(now - lastRunAt) >= pollIntervalMinutes\`, it triggers a run.
3. The connector calls the external API, collects evidence records.
4. Each record is ingested via the same evidence service the REST API uses.
5. Control test results (\`pass\`/\`fail\`/\`not_tested\`) are created for each evidence item.
6. Secrets in connector config are **encrypted at rest** and redacted in API responses.

**Monitor connector health**

\`\`\`bash
# Check connector status summary
curl -s "https://your-opengrc/api/integrations/v1/projects/$PROJECT_ID/connectors/status/summary" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" | jq .

# Inspect recent runs for a specific connector
curl -s "https://your-opengrc/api/integrations/v1/projects/$PROJECT_ID/connectors/$INSTANCE_ID/runs" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" | jq '.[] | {status, itemsAccepted, itemsRejected, startedAt}'
\`\`\`

---

### Method 3: MCP tools (AI-agent orchestration)

MCP tools let an AI agent (Cursor, Claude, or any MCP client) drive the full compliance loop: scan your repo, map gaps, generate fixes, push evidence, and produce OSCAL packages.

**Recommended agent workflow**

\`\`\`text
1. capabilities_v1          → "What can I do?"
2. frmr_taxonomy_v1         → "What does 20x require?"
3. gap_closure_execution_brief_v1  → "Where are my gaps?"
4. compliance_agent_autopilot_v1   → "Fix everything"
5. fedramp_oscal_report_v1  → "Package for assessor"
\`\`\`

**One-shot autopilot (create project + full loop)**

\`\`\`json
// MCP tool: compliance_agent_autopilot_v1
{
  "strategy": "balanced",
  "createProjectIfMissing": true,
  "projectName": "My FedRAMP System",
  "executionMode": "apply"
}
\`\`\`

This single call:
1. Scans your workspace (languages, frameworks, IaC, security config).
2. Maps findings to FedRAMP control gaps.
3. Creates a project in OpenGRC if it does not exist.
4. Generates and applies remediation (config files, CI workflows, policies).
5. Links evidence to controls and triggers auto-scoping.
6. Returns closure verdicts per gap.

**Fine-grained evidence linking (MCP)**

\`\`\`json
// Upsert a single evidence artifact
// MCP tool: evidence_link_upsert_v1
{
  "projectId": "uuid",
  "controlId": "AC-2",
  "framework": "frmr",
  "evidenceType": "access_review",
  "metadata": { "reviewDate": "2025-03-15", "staleAccounts": 0 }
}
\`\`\`

\`\`\`json
// Resolve a control ID to a checklist item
// MCP tool: evidence_link_lookup_control_v1
{
  "projectId": "uuid",
  "controlId": "SC-28",
  "framework": "frmr"
}
// Returns: { checklistItemId: "uuid", ... }
\`\`\`

\`\`\`json
// Trigger auto-scoping after evidence push
// MCP tool: evidence_link_trigger_auto_scope_v1
{
  "projectId": "uuid"
}
\`\`\`

**Connector management via MCP**

\`\`\`json
// List available connector types
// MCP tool: connectors_registry_v1
{ "projectId": "uuid" }

// Check health of all connectors
// MCP tool: connectors_status_v1
{ "projectId": "uuid" }

// Trigger a manual collection run
// MCP tool: connectors_run_v1
{ "projectId": "uuid", "instanceId": "connector-instance-uuid" }
\`\`\`

---

### Mapping controls automatically

When evidence arrives (via any method), OpenGRC resolves the \`controlId\` to a checklist item. The resolution strategy:

| controlId format | Example | How it resolves |
|-----------------|---------|-----------------|
| NIST family code | \`AC-2\`, \`SI-7\`, \`SC-28\` | Matches KSI controls array or FRR keyword |
| FRR requirement code | \`frr:P1:both:CSO:P1_1:null\` | Exact match to FRMR requirement in catalog |
| KSI indicator | \`ksi:VM:IND-01:dom\` | Exact match to KSI in catalog |
| Checklist item UUID | \`550e8400-e29b-...\` | Direct match |
| Manual link | Pre-created via \`/controls/link\` | Lookup table match |

**Pro tip:** If you are pushing evidence from a scanner that uses NIST control IDs (like Prowler or AWS Security Hub), you can use those IDs directly — OpenGRC will map them to the corresponding FRMR requirements in your 20x checklist.

**Creating explicit control links**

For tools that do not emit standard control IDs, create a mapping once and all future evidence auto-resolves:

\`\`\`bash
# Link a custom scanner output to a specific checklist item
curl -X POST "https://your-opengrc/api/integrations/v1/controls/link" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "projectId": "YOUR_PROJECT_UUID",
    "checklistItemId": "CHECKLIST_ITEM_UUID",
    "controlId": "my-custom-scanner:encryption-check",
    "framework": "custom",
    "notes": "Maps our internal encryption scanner to SC-28"
  }'
\`\`\`

---

### Putting it all together: a complete automation stack

\`\`\`text
┌─────────────────────────────────────────────────────────────┐
│  DAILY / ON EVERY MERGE                                     │
│                                                             │
│  GitHub Actions:                                            │
│    • npm audit → push SCA evidence (SI-2)                  │
│    • Trivy image scan → push container evidence (SI-7)     │
│    • Semgrep SAST → push code scan evidence (SA-11)        │
│    • Branch protection check → push CM evidence (CM-3)     │
│    • SBOM generation → push supply chain evidence (SR-4)   │
│    • Pipeline gate: POST /pipeline/check (≥95%)            │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  HOURLY (Connectors)                                        │
│                                                             │
│  GitHub connector:                                          │
│    • Repo security config, Dependabot alerts               │
│  AWS connector:                                             │
│    • Security Hub findings, Config compliance              │
│  Okta connector:                                            │
│    • User MFA status, deprovisioning events                │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  WEEKLY (Scheduled CI job or MCP)                           │
│                                                             │
│  • Prowler CSPM full scan → bulk evidence push             │
│  • Access review diff (IdP vs HR) → push evidence          │
│  • SSL Labs scan → push TLS evidence                       │
│  • Nessus authenticated scan → push vuln evidence          │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  MONTHLY (Manual or MCP-assisted)                           │
│                                                             │
│  • ConMon report generation                                │
│  • POA&M status review                                     │
│  • compliance_agent_autopilot_v1 for gap check             │
│  • Compliance snapshot export for trend analysis           │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  ON DEMAND (MCP agent)                                      │
│                                                             │
│  • gap_closure_execution_brief_v1 before sprints           │
│  • fedramp_oscal_report_v1 for assessor packages           │
│  • Auto-scope trigger after major changes                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
\`\`\`

**The result:** Evidence flows in continuously. Readiness percentage stays above your threshold. Gaps are detected within hours, not weeks. Your compliance posture is always current, and assessor preparation is a report export—not a scramble.

---

### Additional OpenGRC capabilities for controls programs

These features are available in the platform and relevant to closing controls but often overlooked during setup.

**Per-project integration credentials**

Instead of sharing a single global \`INTEGRATION_API_KEY\`, create scoped credentials per project:

\`\`\`bash
# Create a project-scoped integration credential
curl -X POST "https://your-opengrc/api/integrations/v1/projects/$PROJECT_ID/credentials" \\
  -H "Authorization: Bearer $INTEGRATION_API_KEY" \\
  -H "Content-Type: application/json"
# Returns: { credentialId, key, projectId }
# Use the returned key as Bearer token for that project's evidence pushes
\`\`\`

This gives each project its own API key—useful for multi-boundary environments where different CI pipelines serve different systems.

**Compliance badge**

Embed a live compliance readiness badge in your repository README or internal dashboards:

\`\`\`markdown
![Compliance](https://your-opengrc/api/pipeline/badge/YOUR_PROJECT_UUID)
\`\`\`

The badge shows current readiness percentage and updates automatically.

**OSCAL export suite**

OpenGRC exports four OSCAL artifact types, not just SSP and POA&M:

| Export | Endpoint | Use case |
|--------|---------|----------|
| OSCAL SSP | \`GET /projects/:id/export?format=oscal-ssp\` | System security plan for authorization package |
| OSCAL POA&M | \`GET /projects/:id/poam?format=oscal-poam\` | Plan of action and milestones |
| OSCAL Assessment Plan | \`GET /projects/:id/export?format=oscal-ap\` | Assessment methodology and scope |
| OSCAL Assessment Results | \`GET /projects/:id/export?format=oscal-ar\` | Findings and determinations |

Also available: JSON bundle, Markdown, and CSV formats for POA&M.

**OSCAL SSP import**

If you have an existing OSCAL SSP (from another tool or a previous assessment), import it:

\`\`\`bash
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/oscal/import-ssp" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d @my-ssp.oscal.json
\`\`\`

This bootstraps your project with controls, implementation statements, and metadata from the SSP.

**Vendor management (supply chain controls)**

Track third-party vendors and their security posture — critical for SR (Supply Chain) and SA (System and Services Acquisition) controls:

\`\`\`bash
# Register a vendor
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/vendors" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{ "name": "Cloud Provider X", "category": "IaaS", "criticality": "high" }'

# Record an assessment
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/vendors/$VENDOR_ID/assessments" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{ "assessmentDate": "2025-03-01", "result": "satisfactory", "notes": "SOC 2 Type II reviewed" }'
\`\`\`

**Audit tracking**

For formal internal or external audits (3PAO, ISO surveillance, SOC 2):

\`\`\`bash
# Create an audit
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/audits" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{ "title": "FedRAMP 3PAO Annual", "type": "3pao", "status": "planned", "startDate": "2025-06-01" }'

# Record a finding against the audit
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/audits/$AUDIT_ID/findings" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{ "title": "AC-2: Stale service accounts", "severity": "moderate", "status": "open" }'
\`\`\`

Audit findings can generate POA&M items and link to the risk register.

**Incident-to-control mapping**

When logging incidents, map them to affected controls for root cause tracking:

\`\`\`bash
curl -X POST "https://your-opengrc/api/projects/$PROJECT_ID/incidents" \\
  -H "Authorization: Bearer $JWT" \\
  -H "Content-Type: application/json" \\
  -d '{ "title": "Unauthorized access attempt", "severity": "P2", "affectedControls": ["AC-2", "SI-4"] }'
\`\`\`

This creates the feedback loop: incident → affected controls → gap analysis → POA&M → remediation.

**Evidence freshness heatmap**

Monitor which controls have stale evidence before it becomes an assessment finding:

\`\`\`bash
curl -s "https://your-opengrc/api/projects/$PROJECT_ID/evidence-freshness" \\
  -H "Authorization: Bearer $JWT" | jq .
\`\`\`

Returns a per-control breakdown of evidence age, helping you target re-collection where it matters.

**Dashboard reports**

Three built-in report endpoints for different audiences:

\`\`\`bash
# KPI summary for compliance leads
curl "https://your-opengrc/api/reports/compliance-summary?projectId=$PROJECT_ID"

# Risk heatmap for risk committees
curl "https://your-opengrc/api/reports/risk-posture?projectId=$PROJECT_ID"

# Combined brief for executives / AO
curl "https://your-opengrc/api/reports/executive-briefing?projectId=$PROJECT_ID"
\`\`\`

**Unified search**

Search across checklist items, evidence, risks, and policies in one call:

\`\`\`bash
curl "https://your-opengrc/api/search?q=encryption&projectId=$PROJECT_ID&types=checklist,evidence,risk,policy&limit=20" \\
  -H "Authorization: Bearer $JWT"
\`\`\`

Or via MCP: \`opengrc_search_v1\` with the same parameters.`,
    },
  ],
};
