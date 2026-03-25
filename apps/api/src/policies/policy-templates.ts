/**
 * FedRAMP policy templates.
 *
 * Every FedRAMP authorization requires a defined set of policy documents.
 * These templates provide a starting framework with section structure,
 * placeholder content, and guidance comments.  Organizations should
 * customize every section to reflect their actual practices.
 *
 * Templates follow NIST SP 800-53 Rev 5 control families and map to the
 * FedRAMP requirements that mandate each policy.
 */

export interface PolicyTemplate {
  /** Stable slug used as an identifier — never changes between versions. */
  slug: string;
  /** Human-readable title for the policy document. */
  title: string;
  /** Short category tag for grouping (e.g. "security", "operations"). */
  category: string;
  /** NIST 800-53 control families this policy primarily addresses. */
  controlFamilies: string[];
  /** Markdown body with section scaffolding and guidance comments. */
  content: string;
}

// ---------------------------------------------------------------------------
// Template library
// ---------------------------------------------------------------------------

export const POLICY_TEMPLATES: PolicyTemplate[] = [
  // -----------------------------------------------------------------------
  // 1. Information Security Policy (overarching)
  // -----------------------------------------------------------------------
  {
    slug: 'information-security',
    title: 'Information Security Policy',
    category: 'security',
    controlFamilies: ['PL', 'PM'],
    content: `# Information Security Policy

## 1. Purpose

This policy establishes the information security program for **[Organization Name]** and defines the management framework, responsibilities, and principles that govern the protection of information assets within the FedRAMP authorization boundary.

<!-- Customize: Replace [Organization Name] and describe your specific boundary. -->

## 2. Scope

This policy applies to all personnel, contractors, and third parties who access, process, store, or transmit information within the **[System Name]** authorization boundary, including all interconnected systems and services.

## 3. Roles and responsibilities

| Role | Responsibility |
|------|---------------|
| **Authorizing Official (AO)** | Accepts residual risk and grants authorization to operate. |
| **System Owner** | Accountable for the system's security posture and compliance. |
| **ISSO** | Operates the security program day-to-day; manages POA&M, evidence, and ConMon. |
| **CISO** | Provides strategic security direction and risk management oversight. |
| **Engineering / DevOps** | Implements technical controls, produces evidence, and responds to findings. |
| **All personnel** | Comply with this policy and report security incidents. |

## 4. Policy statements

### 4.1 Risk management

- The organization shall conduct risk assessments at least annually and whenever significant changes occur.
- Risks shall be documented in the risk register, scored for likelihood and impact, and treated per the risk treatment plan.
- Residual risks exceeding the organization's risk appetite require formal acceptance by the AO.

### 4.2 Security planning

- A System Security Plan (SSP) shall be maintained as a living document and updated within 30 days of any significant change.
- The SSP shall accurately describe the authorization boundary, implemented controls, and responsible parties.

### 4.3 Continuous monitoring

- The organization shall implement a continuous monitoring strategy covering vulnerability management, configuration monitoring, and security assessments.
- All controls shall be assessed within a rolling 3-year cycle, with high-impact controls assessed annually.
- Monthly continuous monitoring reports shall be produced and submitted per FedRAMP requirements.

### 4.4 Policy review

- All security policies shall be reviewed at least annually and updated as needed.
- Policy changes shall be approved by the CISO or designated authority before publication.
- Personnel shall attest to policy acknowledgment within 30 days of publication or update.

## 5. Enforcement

Violations of this policy may result in disciplinary action up to and including termination, contract cancellation, or legal action as appropriate.

## 6. Review schedule

| Item | Frequency |
|------|-----------|
| This policy | Annually, or after significant changes |
| Risk assessment | Annually |
| SSP | Continuously maintained; formal review annually |

## 7. Approval

| Role | Name | Date |
|------|------|------|
| CISO | | |
| System Owner | | |
`,
  },

  // -----------------------------------------------------------------------
  // 2. Access Control Policy
  // -----------------------------------------------------------------------
  {
    slug: 'access-control',
    title: 'Access Control Policy',
    category: 'security',
    controlFamilies: ['AC', 'IA'],
    content: `# Access Control Policy

## 1. Purpose

Define the rules and procedures for managing access to information systems within the authorization boundary, ensuring that only authorized personnel and services have access to resources they need to perform their duties.

## 2. Scope

All user accounts, service accounts, API keys, and access credentials associated with **[System Name]** and its interconnected systems.

## 3. Policy statements

### 3.1 Account management (AC-2)

- All accounts shall be authorized by the system owner or designated manager before creation.
- Accounts shall be assigned based on job function using role-based access control (RBAC).
- Accounts for separated personnel shall be disabled within **[1 hour / 24 hours]** of notification from HR.
- Inactive accounts shall be disabled after **[30/60/90]** days of inactivity.
- All accounts shall be reviewed quarterly by account managers.
- Service accounts shall have documented owners, defined purposes, and secrets rotated per the Credential Management section.
- Shared or group accounts are prohibited unless explicitly approved and documented.

### 3.2 Least privilege (AC-6)

- Users shall be granted the minimum permissions necessary to perform their duties.
- Privileged access (admin, root, database admin) shall be restricted to named individuals with documented justification.
- Privileged access shall require multi-factor authentication with phishing-resistant methods (FIDO2/WebAuthn preferred).
- Privilege escalation events shall be logged and reviewed.

### 3.3 Multi-factor authentication (IA-2)

- MFA shall be required for all interactive access to systems within the boundary.
- Phishing-resistant MFA (FIDO2, WebAuthn, or hardware tokens) is required for privileged access.
- TOTP-based MFA is acceptable for non-privileged access. SMS-based MFA is not permitted.
- MFA shall be enforced at the identity provider level and cannot be bypassed per-application.

### 3.4 Remote access (AC-17)

- All remote access shall traverse an encrypted channel (VPN, TLS 1.2+, or equivalent).
- Remote privileged access shall require MFA and be logged.
- Split-tunnel VPN configurations are prohibited for connections to the authorization boundary.

### 3.5 Emergency access (break-glass)

- Emergency access procedures shall be documented, tested annually, and require MFA.
- Emergency access shall be time-boxed to **[4/8/24]** hours and reviewed within 24 hours of use.
- All emergency access events shall trigger alerts to the security team.

### 3.6 Session management

- Interactive sessions shall time out after **[15/30]** minutes of inactivity.
- Session tokens shall expire after **[8/12]** hours regardless of activity.
- Concurrent session limits shall be enforced per the system's risk profile.

## 4. Access review schedule

| Review | Frequency | Responsible |
|--------|-----------|-------------|
| User access review | Quarterly | Account managers |
| Privileged access review | Quarterly | ISSO |
| Service account review | Quarterly | System owner |
| Role-permission review | Annually | CISO |

## 5. Enforcement

Unauthorized access attempts shall be logged, investigated, and reported. Policy violations may result in access revocation and disciplinary action.
`,
  },

  // -----------------------------------------------------------------------
  // 3. Audit and Accountability Policy
  // -----------------------------------------------------------------------
  {
    slug: 'audit-accountability',
    title: 'Audit and Accountability Policy',
    category: 'security',
    controlFamilies: ['AU'],
    content: `# Audit and Accountability Policy

## 1. Purpose

Establish requirements for generating, protecting, reviewing, and retaining audit records to support security monitoring, forensic investigation, and compliance reporting.

## 2. Policy statements

### 2.1 Auditable events (AU-2)

The following events shall be logged across all systems in the boundary:

- Authentication: login success/failure, MFA challenge, password change, session termination
- Authorization: access granted/denied, privilege escalation, role changes
- Data: create, read (for sensitive data), update, delete operations on controlled data
- Administrative: user/account changes, configuration changes, policy changes
- System: service start/stop, errors, resource exhaustion, backup events

### 2.2 Audit record content (AU-3)

Each log entry shall include at minimum:

- Timestamp (UTC, ISO 8601 format)
- Event type and result (success/failure)
- Actor identity (user ID, service account, or system process)
- Source (IP address, hostname, user agent where applicable)
- Target resource (type, identifier)
- Correlation ID (for request tracing)

### 2.3 Centralized logging

- All audit records shall be forwarded to a centralized log management system (SIEM).
- Log forwarding shall be monitored; gaps exceeding **[15]** minutes shall trigger P1 alerts.

### 2.4 Log protection (AU-9)

- Audit logs shall be stored in immutable storage (e.g., S3 Object Lock, WORM storage).
- Access to audit logs shall be restricted to authorized security personnel.
- Logs shall not be modifiable or deletable by system administrators.
- Log integrity shall be verified using checksums or cryptographic validation.

### 2.5 Retention (AU-11)

- Online retention: **[1 year]** minimum
- Archive retention: **[3 years]** minimum (per FedRAMP requirement)
- Retention periods may be extended for active investigations or legal holds.

### 2.6 Log review (AU-6)

- Automated alerts shall be configured for high-severity events (failed auth bursts, privilege escalation, off-hours admin activity, log pipeline failures).
- Security team shall review alerts within **[15 minutes / 1 hour]** during business hours.
- Weekly log review shall be conducted and documented.

## 3. Review schedule

This policy shall be reviewed annually or when logging infrastructure changes.
`,
  },

  // -----------------------------------------------------------------------
  // 4. Configuration Management Policy
  // -----------------------------------------------------------------------
  {
    slug: 'configuration-management',
    title: 'Configuration Management Policy',
    category: 'operations',
    controlFamilies: ['CM', 'SA'],
    content: `# Configuration Management Policy

## 1. Purpose

Define requirements for establishing, maintaining, and controlling configuration baselines for all systems within the authorization boundary, and for managing changes to those systems.

## 2. Policy statements

### 2.1 Configuration baselines (CM-2)

- All infrastructure shall be defined in infrastructure-as-code (IaC) — Terraform, Pulumi, CloudFormation, or equivalent.
- Manual ("console click") infrastructure provisioning is prohibited in production.
- Baselines shall follow CIS Benchmarks, STIGs, or vendor hardening guides. Deviations shall be documented with rationale.
- Container base images shall be hardened, pinned to specific digests, and rebuilt on a defined schedule.

### 2.2 Change management (CM-3)

- All changes to production systems shall be made through version-controlled pull requests.
- Pull requests shall require at least one approval from a reviewer who did not author the change.
- CI pipelines shall run security checks (SAST, SCA, linting, tests) on every pull request; merge is blocked on failure.
- Significant changes (boundary, auth, encryption, new services, new data flows) shall be tagged for security review.

### 2.3 Configuration monitoring (CM-3, CM-6)

- Configuration drift detection shall run continuously (AWS Config, Azure Policy, or equivalent).
- Drift from baseline shall be remediated within **[48 hours]** or documented as an approved deviation.
- Baseline compliance percentage shall be reported monthly.

### 2.4 Least functionality (CM-7)

- Systems shall run only the services, ports, and protocols required for their function.
- Unnecessary services shall be disabled. Unused software shall be removed.
- Allowed ports, protocols, and services shall be documented and reviewed quarterly.

### 2.5 Software restrictions (CM-11)

- Only approved software may be installed on systems within the boundary.
- Software installation shall be controlled through package management and image pipelines.
- End users shall not have administrative privileges to install software.

### 2.6 Rollback

- Every deployment shall be rollback-capable within **[15]** minutes.
- Rollback procedures shall be documented and tested quarterly.

## 3. Significant change criteria

A change is considered significant if it involves:

- New or changed authorization boundary
- New interconnection or external service
- Change to authentication or authorization mechanisms
- Change to encryption methods or key management
- New data type entering the boundary
- Major version upgrade of security-relevant software

Significant changes require ISSO review and may trigger re-assessment.

## 4. Review schedule

This policy and the configuration baseline shall be reviewed annually and after significant changes.
`,
  },

  // -----------------------------------------------------------------------
  // 5. Incident Response Policy
  // -----------------------------------------------------------------------
  {
    slug: 'incident-response',
    title: 'Incident Response Policy',
    category: 'security',
    controlFamilies: ['IR'],
    content: `# Incident Response Policy

## 1. Purpose

Establish the incident response program, define severity classifications, and set expectations for detection, containment, eradication, recovery, and post-incident analysis.

## 2. Severity classifications

| Level | Definition | Examples | Response time |
|-------|-----------|----------|---------------|
| **P1 — Critical** | Confirmed breach of controlled data, complete service outage, active exploitation | Data exfiltration, ransomware, boundary compromise | Immediate (< 15 min) |
| **P2 — High** | Potential compromise, significant service degradation, privilege escalation | Suspicious admin activity, partial outage, unpatched critical CVE under exploit | < 1 hour |
| **P3 — Medium** | Suspicious activity with no confirmed impact | Anomalous login patterns, policy violations, failed attack attempts | < 4 hours |
| **P4 — Low** | Minor policy violation or informational | Single failed login, low-severity finding | Next business day |

## 3. Incident response team

| Role | Responsibility | Contact |
|------|---------------|---------|
| Incident Commander | Coordinates response, makes containment decisions | [Name, phone] |
| Security Lead | Technical analysis, evidence collection, forensics | [Name, phone] |
| Engineering Lead | System remediation, patching, rollback | [Name, phone] |
| Communications Lead | Internal/external messaging, customer notification | [Name, phone] |
| Legal / Privacy | Regulatory notification, legal implications | [Name, phone] |

## 4. Response procedures

### 4.1 Detection and analysis

- Monitor automated alerts from SIEM, IDS/IPS, EDR, and CSPM.
- Validate and classify the incident per the severity table above.
- Document initial findings in the incident tracking system.

### 4.2 Containment

- Isolate affected systems to prevent lateral movement.
- Preserve evidence before remediation (memory dumps, log snapshots, disk images).
- Activate break-glass procedures if needed (document usage).

### 4.3 Eradication and recovery

- Identify and eliminate root cause (remove malware, patch vulnerability, revoke compromised credentials).
- Restore from known-good backups or redeploy from verified images.
- Verify system integrity before returning to production.

### 4.4 Post-incident review

- Conduct post-incident review within **[5 business days]** of incident closure.
- Document: timeline, root cause, impact, lessons learned, and improvement actions.
- Track improvement actions in the POA&M or risk register.
- Update this policy, runbooks, or detection rules based on findings.

## 5. Reporting obligations

| Audience | Timeline | Method |
|----------|----------|--------|
| Internal security team | Immediate (P1/P2) | PagerDuty / on-call |
| ISSO / System Owner | Within 1 hour (P1), 4 hours (P2) | Direct communication |
| FedRAMP PMO / US-CERT | Per NIST SP 800-61 timelines | Official reporting channel |
| Affected customers | Per contractual SLAs | Pre-drafted communication templates |

## 6. Testing

- Tabletop exercises shall be conducted at least **[quarterly / annually]**.
- Exercises shall rotate scenarios: ransomware, insider threat, supply chain compromise, data exfiltration.
- Exercise findings shall be documented and tracked to closure.

## 7. Review schedule

This policy shall be reviewed annually, after significant incidents, and after tabletop exercises.
`,
  },

  // -----------------------------------------------------------------------
  // 6. Contingency Planning (BCP/DR) Policy
  // -----------------------------------------------------------------------
  {
    slug: 'contingency-planning',
    title: 'Contingency Planning Policy',
    category: 'operations',
    controlFamilies: ['CP'],
    content: `# Contingency Planning Policy

## 1. Purpose

Ensure continuity of operations and recovery of information systems in the event of a disruption, disaster, or emergency.

## 2. Recovery objectives

| Metric | Target | Justification |
|--------|--------|---------------|
| **Recovery Time Objective (RTO)** | [4 / 24] hours | Maximum acceptable downtime |
| **Recovery Point Objective (RPO)** | [1 / 4] hours | Maximum acceptable data loss |
| **Maximum Tolerable Downtime (MTD)** | [48 / 72] hours | Beyond this, business impact is unacceptable |

## 3. Policy statements

### 3.1 Backup (CP-9)

- All critical data shall be backed up automatically per the RPO target.
- Backups shall be encrypted with keys separate from production.
- Backups shall be stored in a geographically separate location (different AZ/region).
- Backup integrity shall be verified automatically (checksum validation).
- **Restore tests shall be performed quarterly** — untested backups are not backups.

### 3.2 System recovery (CP-10)

- Recovery procedures shall be documented as runbooks with step-by-step instructions.
- Immutable infrastructure (rebuild from IaC + restore data) is the preferred recovery method.
- Recovery procedures shall be tested at least annually.

### 3.3 Alternate processing (CP-7)

- Production systems shall be deployed across multiple availability zones at minimum.
- For high-impact systems, multi-region failover capability shall be maintained.
- Failover procedures shall be documented and tested annually.

### 3.4 Contingency plan testing (CP-4)

- Full contingency plan test: annually at minimum.
- Backup restore test: quarterly.
- Failover test (AZ/region): annually.
- Results shall be documented with any gaps tracked in the POA&M.

## 4. Activation criteria

The contingency plan shall be activated when:

- Production service is unavailable for longer than **[30 minutes / 1 hour]**.
- Data loss is detected or imminent.
- A disaster (natural, infrastructure, cyber) affects the primary site.
- The Incident Commander or System Owner declares activation.

## 5. Review schedule

This policy and all contingency procedures shall be reviewed annually, after plan activation, and after significant infrastructure changes.
`,
  },

  // -----------------------------------------------------------------------
  // 7. Risk Assessment Policy
  // -----------------------------------------------------------------------
  {
    slug: 'risk-assessment',
    title: 'Risk Assessment Policy',
    category: 'security',
    controlFamilies: ['RA', 'PM'],
    content: `# Risk Assessment Policy

## 1. Purpose

Define the methodology and cadence for identifying, analyzing, and treating risks to the organization's information systems.

## 2. Policy statements

### 2.1 Risk assessment methodology

- Risk assessments shall use a quantitative or semi-quantitative methodology based on likelihood and impact scoring.
- Likelihood scale: 1 (rare) to 5 (almost certain).
- Impact scale: 1 (negligible) to 5 (catastrophic).
- Risk score = Likelihood x Impact. Residual risk = re-scored after controls.

### 2.2 Frequency

- Comprehensive risk assessment: annually.
- Targeted risk assessment: when significant changes occur, new threats emerge, or after security incidents.
- Vulnerability-driven risk updates: monthly (informed by scan results).

### 2.3 Risk register

- All identified risks shall be documented in the risk register with: description, category, likelihood, impact, inherent score, treatment plan, residual score, owner, and status.
- The risk register shall be reviewed quarterly by the ISSO and annually by the AO.

### 2.4 Risk treatment

| Strategy | When to use |
|----------|------------|
| **Mitigate** | Implement controls to reduce likelihood or impact. |
| **Transfer** | Shift risk via insurance, contract, or third-party service. |
| **Accept** | AO formally accepts residual risk with documented rationale and expiration date. |
| **Avoid** | Eliminate the activity or technology that creates the risk. |

### 2.5 Risk acceptance

- Risk acceptance requires written approval from the AO or designated authority.
- Acceptances shall include: specific risk, residual level, compensating controls, conditions, and expiration date.
- All risk acceptances shall be reviewed annually and whenever conditions change.

### 2.6 Vulnerability scanning (RA-5)

- Authenticated vulnerability scans: monthly minimum (weekly preferred).
- Web application scans: monthly and after significant changes.
- Container image scans: at build time and on a schedule.
- Dependency scans: continuous via SCA in CI/CD.
- Remediation SLAs: Critical 15 days, High 30 days, Medium 90 days, Low 180 days.

## 3. Review schedule

This policy and the risk assessment methodology shall be reviewed annually.
`,
  },

  // -----------------------------------------------------------------------
  // 8. System and Communications Protection Policy
  // -----------------------------------------------------------------------
  {
    slug: 'system-communications-protection',
    title: 'System and Communications Protection Policy',
    category: 'security',
    controlFamilies: ['SC'],
    content: `# System and Communications Protection Policy

## 1. Purpose

Define requirements for protecting the confidentiality and integrity of information in transit and at rest through encryption, network architecture, and boundary protection.

## 2. Policy statements

### 2.1 Encryption in transit (SC-8, SC-13)

- All data in transit shall be encrypted using TLS 1.2 or higher. TLS 1.3 is preferred.
- TLS 1.0 and 1.1 are prohibited.
- Internal service-to-service communication within the boundary shall be encrypted (mTLS, service mesh, or application-level TLS).
- Certificate management shall use automated issuance and renewal (ACM, Let's Encrypt).
- Self-signed certificates are prohibited in production.

### 2.2 Encryption at rest (SC-28)

- All data at rest shall be encrypted using AES-256 or equivalent.
- Databases: encrypted via managed service encryption (e.g., RDS encryption with KMS).
- Object storage: SSE-KMS (not SSE-S3) with customer-managed keys.
- Volumes/disks: encrypted with managed service encryption.
- Backups: encrypted with keys separate from production data.

### 2.3 Key management (SC-12)

- Encryption keys shall be managed through a dedicated KMS (AWS KMS, Azure Key Vault, GCP Cloud KMS, or HashiCorp Vault).
- Manual key management is prohibited.
- Key rotation: annual minimum, automated where supported.
- Key access shall follow least privilege; only services that need encrypt/decrypt get access.
- Key management and data management responsibilities shall be separated.

### 2.4 Network architecture (SC-7)

- Production workloads shall reside in dedicated, isolated networks (VPC/VNet).
- Network segmentation: public tier (load balancers only), private application tier, private data tier.
- Default deny: all traffic is denied unless explicitly allowed with documented justification.
- No direct internet access from application or data tiers.
- Egress filtering: only known, documented destinations allowed.

### 2.5 Boundary protection (SC-7)

- Web Application Firewall (WAF) required on all public-facing endpoints.
- DDoS protection required (at minimum, cloud provider default protection).
- VPC flow logs enabled and forwarded to SIEM.

### 2.6 DNS security

- DNSSEC shall be enabled where supported.
- Internal DNS shall be used for private resources.

## 3. Review schedule

This policy shall be reviewed annually and when network architecture or encryption methods change.
`,
  },

  // -----------------------------------------------------------------------
  // 9. Personnel Security Policy
  // -----------------------------------------------------------------------
  {
    slug: 'personnel-security',
    title: 'Personnel Security Policy',
    category: 'human-resources',
    controlFamilies: ['PS', 'AT'],
    content: `# Personnel Security Policy

## 1. Purpose

Define requirements for personnel screening, security awareness training, and personnel actions (transfers, termination) to ensure trustworthy access to information systems.

## 2. Policy statements

### 2.1 Personnel screening (PS-3)

- Background investigations shall be completed for all individuals before granting access to the authorization boundary.
- Screening level shall be commensurate with the risk and sensitivity of the position.
- Re-screening shall be conducted per organizational policy or when risk indicators emerge.
- Background check completion shall be documented (date, result, no PII stored in the system).

### 2.2 Personnel termination (PS-4)

- Upon notification of termination, system access shall be disabled within **[1 hour / 24 hours]**.
- Access credentials, tokens, and keys shall be revoked.
- Organization-owned equipment shall be returned.
- Exit interview shall cover ongoing confidentiality obligations.

### 2.3 Personnel transfer (PS-5)

- When personnel transfer to a different role, access privileges shall be reviewed and adjusted within **[5 business days]**.
- Access no longer required for the new role shall be revoked.

### 2.4 Security awareness training (AT-2)

- All personnel shall complete security awareness training within **[30 days]** of onboarding.
- Annual refresher training is required for all personnel.
- Training shall cover: phishing recognition, password hygiene, incident reporting, data handling, acceptable use.
- Phishing simulations shall be conducted at least **[quarterly / annually]** with results tracked.

### 2.5 Role-based training (AT-3)

| Role | Required training |
|------|-------------------|
| Developers | Secure coding practices (OWASP), secure SDLC |
| System administrators | Privileged access management, incident response |
| Security team | Advanced threat detection, forensics, IR procedures |
| Management | Risk management, security governance |

### 2.6 Acceptable use (PL-4)

- All personnel shall sign an acceptable use agreement before receiving access.
- Annual re-attestation is required.
- The agreement shall cover authorized use, prohibited activities, monitoring notice, and consequences of violations.

## 3. Review schedule

This policy shall be reviewed annually.
`,
  },

  // -----------------------------------------------------------------------
  // 10. System and Information Integrity Policy
  // -----------------------------------------------------------------------
  {
    slug: 'system-information-integrity',
    title: 'System and Information Integrity Policy',
    category: 'security',
    controlFamilies: ['SI'],
    content: `# System and Information Integrity Policy

## 1. Purpose

Define requirements for identifying and remediating information system flaws, monitoring for security threats, and protecting against malicious code and unauthorized changes.

## 2. Policy statements

### 2.1 Flaw remediation (SI-2)

- Vulnerability remediation SLAs:
  - **Critical / CISA KEV**: 15 days
  - **High**: 30 days
  - **Medium**: 90 days
  - **Low**: 180 days
- Immutable infrastructure is preferred: rebuild and redeploy rather than patch in place.
- Zero-day response: assess within 48 hours, patch or mitigate within 14 days, document in POA&M if SLA exceeded.

### 2.2 Malicious code protection (SI-3)

- Endpoint protection / anti-malware shall be deployed on all applicable systems.
- Container runtime security shall detect and alert on unexpected behavior.
- Email security shall include anti-phishing, anti-malware, and sandboxing.

### 2.3 Security monitoring (SI-4)

- Intrusion detection / prevention systems (IDS/IPS) shall monitor network boundaries.
- CSPM tools shall continuously monitor cloud configuration compliance.
- SIEM shall correlate events from all sources and generate alerts per defined rules.

### 2.4 File integrity monitoring (SI-7)

- FIM shall be deployed on all servers and containers processing controlled data.
- Baselines shall be established at deployment.
- Unauthorized changes shall trigger alerts and investigation.

### 2.5 Software assurance (SI-10, SA-11)

- Input validation shall be implemented for all user-supplied data.
- SAST and DAST shall be integrated into the CI/CD pipeline.
- Dependency scanning (SCA) shall run continuously.
- SBOM shall be generated for each production release.

## 3. Review schedule

This policy shall be reviewed annually and when scanning infrastructure changes.
`,
  },

  // -----------------------------------------------------------------------
  // 11. Supply Chain Risk Management Policy
  // -----------------------------------------------------------------------
  {
    slug: 'supply-chain-risk-management',
    title: 'Supply Chain Risk Management Policy',
    category: 'security',
    controlFamilies: ['SR', 'SA'],
    content: `# Supply Chain Risk Management Policy

## 1. Purpose

Define requirements for managing supply chain risks associated with third-party software, hardware, and services used within the authorization boundary.

## 2. Policy statements

### 2.1 Third-party risk assessment

- All third-party vendors and services within or connected to the boundary shall be inventoried.
- Vendors shall be assessed based on criticality (impact if compromised) and data sensitivity.
- High-criticality vendors shall undergo security assessment before onboarding and annually thereafter.
- Vendor security posture shall be validated through SOC 2 reports, FedRAMP authorization, ISO 27001 certification, or equivalent.

### 2.2 Software supply chain

- All dependencies shall be managed through lockfiles and pinned versions.
- Container images shall be pinned to digests, not mutable tags.
- Dependency updates shall be automated (Dependabot, Renovate) with security patches prioritized.
- SBOM shall be generated in CycloneDX or SPDX format for each release.
- Artifact signing (cosign, Notation) shall be used for container images.
- Signature verification shall be required before deployment.

### 2.3 Provenance and integrity

- Build provenance attestations shall be generated for production artifacts.
- CI/CD pipelines shall be the only path to production — no manual builds.
- Pipeline definitions shall be version-controlled and reviewed like application code.

### 2.4 Vendor monitoring

- Vendor authorization status (FedRAMP, SOC 2 report period) shall be tracked and alerts set for expiration.
- Vendor security incidents shall be tracked and assessed for impact to the organization.
- Vendor contracts shall include security requirements, breach notification, and right to audit.

## 3. Review schedule

This policy and the vendor inventory shall be reviewed annually.
`,
  },

  // -----------------------------------------------------------------------
  // 12. Privacy and Data Protection Policy
  // -----------------------------------------------------------------------
  {
    slug: 'privacy-data-protection',
    title: 'Privacy and Data Protection Policy',
    category: 'privacy',
    controlFamilies: ['PT', 'AR'],
    content: `# Privacy and Data Protection Policy

## 1. Purpose

Define requirements for the collection, use, retention, and disposal of personally identifiable information (PII) and other sensitive data within the authorization boundary.

## 2. Policy statements

### 2.1 Data classification

| Classification | Description | Handling |
|---------------|-------------|----------|
| **Public** | No restrictions on disclosure | Standard controls |
| **Internal** | Business-sensitive, not for public | Access restricted to authorized personnel |
| **Confidential** | PII, financial, health, or security-sensitive | Encrypted at rest and in transit, access logged, retention enforced |
| **Restricted** | Highest sensitivity (credentials, keys, breach data) | Encrypted, strict access control, need-to-know basis |

### 2.2 Data minimization

- Only the minimum data necessary shall be collected and retained.
- Data fields shall be justified against business requirements.
- PII that is no longer needed shall be disposed of per the retention schedule.

### 2.3 Retention and disposal

- Data retention periods shall be defined per data type and regulatory requirement.
- Disposal methods shall ensure data is irrecoverable (cryptographic erasure, secure deletion, physical destruction).
- Disposal shall be documented with certificates where applicable.

### 2.4 Privacy impact

- Privacy impact assessments shall be conducted when new data types are introduced or processing changes significantly.
- Privacy controls shall be documented in the SSP and tested per the assessment methodology.

## 3. Review schedule

This policy shall be reviewed annually and when data types or processing activities change.
`,
  },

  // -----------------------------------------------------------------------
  // 13. Physical and Environmental Protection Policy
  // -----------------------------------------------------------------------
  {
    slug: 'physical-environmental-protection',
    title: 'Physical and Environmental Protection Policy',
    category: 'operations',
    controlFamilies: ['PE'],
    content: `# Physical and Environmental Protection Policy

## 1. Purpose

Define requirements for physical access controls, environmental protections, and media handling for systems within the authorization boundary.

## 2. Policy statements

### 2.1 Cloud-hosted systems

For systems hosted entirely in FedRAMP-authorized cloud infrastructure:

- Physical and environmental controls for data centers are **inherited** from the cloud service provider (CSP).
- The CSP's FedRAMP authorization and Customer Responsibility Matrix (CRM) shall be reviewed to confirm coverage.
- Any on-premises components (office endpoints, development workstations) shall comply with sections below.

### 2.2 Physical access (PE-2, PE-3)

- Physical access to facilities housing boundary components shall require authorization.
- Visitors shall be escorted and logged.
- Physical access shall be reviewed at least annually.

### 2.3 Media protection (MP-2, MP-4, MP-6)

- Portable media containing controlled data shall be encrypted.
- Media disposal shall use approved sanitization methods (NIST SP 800-88).
- Media transport shall be authorized, tracked, and restricted to approved couriers.

### 2.4 Environmental protection

- Environmental controls (fire suppression, climate control, power protection) for cloud-hosted components are inherited per the CSP's authorization.
- On-premises components shall have appropriate environmental protections commensurate with their criticality.

## 3. Review schedule

This policy shall be reviewed annually or when hosting arrangements change.
`,
  },

  // -----------------------------------------------------------------------
  // 14. Maintenance Policy
  // -----------------------------------------------------------------------
  {
    slug: 'maintenance',
    title: 'Maintenance Policy',
    category: 'operations',
    controlFamilies: ['MA'],
    content: `# Maintenance Policy

## 1. Purpose

This policy establishes requirements for the controlled maintenance of **[System Name]** information system components, including hardware, software, and firmware, to ensure continued availability, integrity, and security within the FedRAMP authorization boundary.

<!-- Customize: Replace [Organization Name] and [System Name] with your actual names. -->

## 2. Scope

This policy applies to all system components within or supporting the **[System Name]** authorization boundary, including:
- Cloud infrastructure and virtual machines
- Network devices and appliances
- Endpoint devices with access to boundary data
- Software and firmware requiring periodic updates

## 3. Policy statements

### 3.1 Controlled maintenance (MA-2)

- All maintenance activities shall be scheduled, documented, and approved prior to execution.
- Maintenance windows shall be communicated to stakeholders at least 48 hours in advance for planned activities.
- Emergency maintenance shall follow the incident response escalation path and be documented within 24 hours of completion.
- Maintenance records shall capture: date, personnel, description of work, components affected, and verification results.
- All maintenance tools shall be inspected for improper modifications before use.

### 3.2 Maintenance tools (MA-3)

- Only authorized maintenance tools shall be used on system components.
- A current inventory of approved maintenance tools shall be maintained.
- All tools brought into the facility or connected to system components shall be inspected for malicious software.
- Maintenance tools shall be removed or secured when not in active use.

### 3.3 Non-local maintenance (MA-4)

- Remote/non-local maintenance sessions shall use multifactor authentication and encrypted communications (FIPS 140-validated).
- Non-local maintenance sessions shall be logged with full audit trail (session start/end, actions taken, personnel).
- Remote diagnostic or maintenance sessions shall be monitored in real time by authorized personnel.
- All remote maintenance sessions shall be terminated upon completion; persistent access shall not remain.

### 3.4 Maintenance personnel (MA-5)

- Only personnel with appropriate authorization and clearance (if applicable) shall perform maintenance.
- Contractor or vendor maintenance personnel shall be escorted and supervised when on-premises.
- A current list of authorized maintenance personnel and organizations shall be maintained.
- Personnel performing maintenance shall have credentials verified before access is granted.

### 3.5 Timely maintenance (MA-6)

- Spare parts and maintenance contracts (SLAs) shall be in place for critical components.
- Mean time to repair (MTTR) targets shall be defined for each component tier:
  - **Critical**: 4 hours
  - **High**: 8 hours
  - **Moderate**: 24 hours
  - **Low**: 5 business days

## 4. Automation and evidence

| Control | Evidence source | Collection method |
|---------|----------------|-------------------|
| MA-2 | Change management tickets | Connector (Jira/Linear) |
| MA-3 | Approved tool inventory | Manual attestation |
| MA-4 | Remote session logs | Connector (SIEM) |
| MA-5 | Personnel authorization list | Connector (IdP) |
| MA-6 | SLA compliance reports | Connector (monitoring) |

## 5. Review schedule

This policy shall be reviewed annually or after any significant infrastructure change.
`,
  },

  // -----------------------------------------------------------------------
  // 15. Media Protection Policy
  // -----------------------------------------------------------------------
  {
    slug: 'media-protection',
    title: 'Media Protection Policy',
    category: 'operations',
    controlFamilies: ['MP'],
    content: `# Media Protection Policy

## 1. Purpose

This policy establishes requirements for protecting, controlling, sanitizing, and disposing of information system media containing federal data within the **[System Name]** authorization boundary.

<!-- Customize: Replace [Organization Name] and [System Name] with your actual names. -->

## 2. Scope

This policy applies to all forms of media, both digital and physical:
- Hard drives, SSDs, and other persistent storage
- Removable media (USB drives, external drives, optical media)
- Backup tapes and archival media
- Cloud storage volumes and snapshots
- Printed materials containing controlled information

## 3. Policy statements

### 3.1 Media access (MP-2)

- Access to digital and non-digital media containing system information shall be restricted to authorized personnel.
- Media access shall be controlled through physical and logical access mechanisms.
- Removable media usage shall require explicit authorization from the system owner.
- USB mass storage devices shall be disabled by default on all endpoints; exceptions require documented approval.

### 3.2 Media marking (MP-3)

- All media containing controlled unclassified information (CUI) or FedRAMP-scoped data shall be marked with:
  - Classification or sensitivity level
  - Distribution limitations
  - Handling caveats
- Cloud storage volumes shall be tagged with equivalent metadata labels.

### 3.3 Media storage (MP-4)

- Media containing FedRAMP-scoped data shall be stored in physically secured areas with access control.
- Encrypted storage shall use FIPS 140-validated cryptographic modules.
- Cloud volumes and snapshots shall be encrypted at rest using organization-managed or CSP-managed keys.
- Backup media shall be stored in a geographically separate location from primary systems.

### 3.4 Media transport (MP-5)

- Media transport outside controlled areas shall require:
  - Written authorization from the information system owner
  - FIPS 140-validated encryption of data on the media
  - Tamper-evident packaging
  - Tracking and delivery confirmation
- Digital transfer of media contents shall use encrypted channels (TLS 1.2+, SFTP, SCP).

### 3.5 Media sanitization (MP-6)

- Media shall be sanitized prior to disposal, release, or reuse in accordance with NIST SP 800-88 Rev 1.
- Sanitization method shall be commensurate with the sensitivity of the data:

| Sensitivity | Method | Standard |
|-------------|--------|----------|
| Low | Clear (overwrite) | NIST SP 800-88 Clear |
| Moderate | Purge (cryptographic erase) | NIST SP 800-88 Purge |
| High | Destroy (shred/incinerate) | NIST SP 800-88 Destroy |

- Cloud storage: deletion of volumes, snapshots, and backups shall follow the CSP's documented sanitization procedures (verify in CSP's SSP).
- Certificates of destruction shall be obtained for all physical media disposal.
- Media sanitization shall be verified and logged.

### 3.6 Media use restrictions (MP-7)

- Organization-owned media shall not be used on non-organization systems without authorization.
- Personally-owned media shall not be connected to systems within the authorization boundary.
- Mobile code on media shall be scanned before execution.

## 4. Automation and evidence

| Control | Evidence source | Collection method |
|---------|----------------|-------------------|
| MP-2 | Endpoint DLP / USB policy | Connector (EDR) |
| MP-4 | Encryption-at-rest status | Connector (AWS/Azure/GCP) |
| MP-5 | Transfer logs | Connector (SIEM) |
| MP-6 | Sanitization certificates | Manual upload |
| MP-7 | Endpoint policy enforcement | Connector (MDM/EDR) |

## 5. Review schedule

This policy shall be reviewed annually or when media handling procedures change.
`,
  },

  // -----------------------------------------------------------------------
  // 16. Security Assessment and Authorization Policy
  // -----------------------------------------------------------------------
  {
    slug: 'security-assessment-authorization',
    title: 'Security Assessment and Authorization Policy',
    category: 'security',
    controlFamilies: ['CA'],
    content: `# Security Assessment and Authorization Policy

## 1. Purpose

This policy establishes the security assessment, authorization, and continuous monitoring framework for **[System Name]** to ensure ongoing compliance with FedRAMP requirements and NIST SP 800-53 Rev 5 controls.

<!-- Customize: Replace [Organization Name] and [System Name] with your actual names. -->

## 2. Scope

This policy applies to:
- The entire **[System Name]** authorization boundary
- All interconnected systems and external services
- Assessment activities including penetration testing, vulnerability scanning, and control assessments
- Authorization decisions and ongoing monitoring activities

## 3. Policy statements

### 3.1 Security assessments (CA-2)

- An independent security assessment shall be conducted:
  - **Initial**: Prior to FedRAMP authorization
  - **Annual**: Full assessment by an accredited 3PAO
  - **Significant change**: When system changes trigger reassessment per FedRAMP guidance
- Assessments shall evaluate all applicable NIST SP 800-53 controls using FedRAMP test procedures.
- Assessment plans shall define scope, methodology, roles, schedule, and reporting format.
- Assessment results shall be documented in a Security Assessment Report (SAR).

### 3.2 System interconnections (CA-3)

- All interconnections with external systems shall be authorized via Interconnection Security Agreements (ISAs) or Memoranda of Understanding (MOUs).
- Interconnection documentation shall specify:
  - Interface characteristics and security requirements
  - Data types exchanged and their sensitivity
  - Security controls protecting the connection
- Interconnections shall be reviewed annually and reauthorized when changes occur.

### 3.3 Plan of action and milestones (CA-5)

- A Plan of Action and Milestones (POA&M) shall be maintained for all known vulnerabilities and control deficiencies.
- POA&M entries shall include: weakness description, risk rating, responsible party, milestones, scheduled completion dates, and current status.
- High-risk findings shall have remediation plans within 30 days; critical findings within 15 days.
- POA&M shall be reviewed and updated monthly.

### 3.4 Authorization (CA-6)

- The system shall not operate in a production capacity processing federal data without a valid Authorization to Operate (ATO).
- The Authorizing Official (AO) shall review the security authorization package (SSP, SAR, POA&M) before making an authorization decision.
- Authorization decisions shall be documented and communicated to all stakeholders.
- FedRAMP 20x authorization path: continuous authorization via KSIs, automated evidence, and ConMon reporting replaces periodic reauthorization.

### 3.5 Continuous monitoring (CA-7)

- A continuous monitoring strategy shall define:
  - Metrics and frequencies for each control family
  - Automated scanning and evidence collection schedules
  - Key Security Indicators (KSIs) aligned with FRMR requirements
  - Escalation thresholds and remediation timelines
- Monthly vulnerability scans and quarterly reviews shall be conducted at minimum.
- Significant findings shall be reported to the FedRAMP PMO per ConMon guidance.
- Annual assessment of a subset of controls (per FedRAMP ConMon requirements).

### 3.6 Penetration testing (CA-8)

- Penetration testing shall be conducted annually by an independent assessor (3PAO for FedRAMP).
- Testing scope shall include:
  - External and internal network testing
  - Web application testing (OWASP Top 10)
  - Social engineering (if in scope)
  - Cloud-specific attack vectors
- Findings shall be remediated per POA&M timelines and retested to confirm resolution.

### 3.7 Internal system connections (CA-9)

- Internal connections between subsystems within the boundary shall be documented.
- Internal interfaces shall enforce the same security policies as external interfaces where technically feasible.
- Micro-segmentation or network policies shall limit lateral movement.

## 4. FedRAMP 20x considerations

Under the FedRAMP 20x path:
- **FRMR Process P5** (Continuous Monitoring) defines KSI-based evidence requirements that replace point-in-time assessments.
- Automated evidence pipelines (via \\\`/integrations/v1/evidence\\\`) shall continuously feed assessment data.
- Deviation from expected KSI baselines shall trigger automated alerts and POA&M entries.
- The 3PAO role shifts toward validating automation fidelity and spot-checking outputs.

## 5. Automation and evidence

| Control | Evidence source | Collection method |
|---------|----------------|-------------------|
| CA-2 | SAR documents | Manual upload |
| CA-5 | POA&M entries | API (\\\`/poam\\\` endpoints) |
| CA-7 | Scan results, KSI dashboards | Connectors (scanners, SIEM) |
| CA-8 | Pen test reports | Manual upload |

## 6. Review schedule

This policy shall be reviewed annually, after each assessment cycle, or when authorization conditions change.
`,
  },

  // -----------------------------------------------------------------------
  // 17. System and Services Acquisition Policy
  // -----------------------------------------------------------------------
  {
    slug: 'system-services-acquisition',
    title: 'System and Services Acquisition Policy',
    category: 'security',
    controlFamilies: ['SA'],
    content: `# System and Services Acquisition Policy

## 1. Purpose

This policy establishes requirements for incorporating security into the system development lifecycle, acquiring secure systems and services, and managing developer security practices for **[System Name]** within the FedRAMP authorization boundary.

<!-- Customize: Replace [Organization Name] and [System Name] with your actual names. -->

## 2. Scope

This policy applies to:
- All software developed for or integrated into **[System Name]**
- Third-party services and components within the authorization boundary
- System development, acquisition, and maintenance activities
- Developer environments, tools, and practices

## 3. Policy statements

### 3.1 System development lifecycle (SA-3)

- **[Organization Name]** shall incorporate security at every phase of the SDLC:
  - **Planning**: Threat modeling and security requirements definition
  - **Development**: Secure coding standards, SAST/DAST integration
  - **Testing**: Security test plans, penetration testing
  - **Deployment**: Hardened configurations, infrastructure-as-code review
  - **Operations**: Continuous monitoring, vulnerability management
  - **Disposal**: Secure decommissioning and data sanitization
- Security roles and responsibilities shall be defined for each SDLC phase.

### 3.2 Acquisition process (SA-4)

- Security requirements shall be included in all acquisition contracts and service-level agreements:
  - FIPS 140-validated encryption
  - FedRAMP authorization or equivalent for cloud services
  - Vulnerability disclosure and patching commitments
  - Right-to-audit clauses
  - Incident notification requirements (≤ 1 hour for FedRAMP)
- Functional requirements documentation shall include security capability descriptions.

### 3.3 System documentation (SA-5)

- Administrator and user documentation shall be maintained including:
  - Secure configuration guidance
  - Security-relevant functions and interfaces
  - Effective use of security features
- Documentation shall be updated with each significant system change.
- Architecture documentation shall include data flow diagrams and boundary definitions.

### 3.4 External system services (SA-9)

- External service providers shall:
  - Hold FedRAMP authorization at the appropriate impact level, or
  - Demonstrate equivalent security controls validated by **[Organization Name]**
- External services shall be documented in the SSP with:
  - Service description and data processed
  - Security controls provided vs. inherited
  - Interconnection details (ISA/MOU)
- External services shall be continuously monitored for compliance status changes.

### 3.5 Developer security and privacy architecture (SA-8, SA-17)

- System architecture shall follow security engineering principles:
  - Least privilege and separation of duties
  - Defense in depth
  - Fail-secure design
  - Minimal attack surface
- Architecture decisions shall be documented and reviewed during design phases.
- Security architecture shall be validated against the FedRAMP baseline during assessments.

### 3.6 Developer configuration management (SA-10)

- Developers shall:
  - Use version control for all source code and infrastructure-as-code
  - Track and resolve security-relevant changes
  - Perform integrity verification of code and artifacts
- Configuration management shall enforce:
  - Branch protection and code review requirements
  - Signed commits for production releases
  - Automated CI/CD security scanning gates

### 3.7 Developer security testing (SA-11)

- Security testing shall be integrated into the development process:
  - **SAST** (Static Analysis): On every pull request
  - **DAST** (Dynamic Analysis): On staging deployments
  - **SCA** (Software Composition Analysis): On every build
  - **Container scanning**: On every image build
- Flaw remediation timelines:
  - **Critical**: 48 hours
  - **High**: 7 days
  - **Medium**: 30 days
  - **Low**: 90 days
- Test results shall be retained as evidence for FedRAMP assessments.

### 3.8 Component authenticity and provenance (SA-12, SA-19)

- Software components shall be obtained from trusted sources.
- Cryptographic verification (signatures, checksums) shall be performed on all third-party components before use.
- A software bill of materials (SBOM) shall be maintained for each release.
- Anti-counterfeit provisions shall be included in acquisition contracts for hardware.

## 4. Automation and evidence

| Control | Evidence source | Collection method |
|---------|----------------|-------------------|
| SA-3 | SDLC documentation, sprint artifacts | Manual / Connector (Jira/Linear) |
| SA-10 | Git branch protection, signed commits | Connector (GitHub) |
| SA-11 | SAST/DAST/SCA scan results | Connector (GitHub Actions, Snyk) |
| SA-12 | SBOM, signature verification logs | Connector (CI/CD) |

## 5. Review schedule

This policy shall be reviewed annually or when significant changes to development practices or service acquisitions occur.
`,
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return all available template slugs. */
export function listTemplateSlugs(): string[] {
  return POLICY_TEMPLATES.map((t) => t.slug);
}

/** Retrieve a single template by slug, or undefined if not found. */
export function getTemplateBySlug(slug: string): PolicyTemplate | undefined {
  return POLICY_TEMPLATES.find((t) => t.slug === slug);
}
