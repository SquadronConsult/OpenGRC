import { User } from '../entities/user.entity';
import { FrmrVersion } from '../entities/frmr-version.entity';
import { FrdTerm } from '../entities/frd-term.entity';
import { FrrRequirement } from '../entities/frr-requirement.entity';
import { KsiIndicator } from '../entities/ksi-indicator.entity';
import { Project } from '../entities/project.entity';
import { ProjectMember } from '../entities/project-member.entity';
import { ChecklistItem } from '../entities/checklist-item.entity';
import { EvidenceItem } from '../entities/evidence-item.entity';
import { Finding } from '../entities/finding.entity';
import { AuditLog } from '../entities/audit-log.entity';
import { WebhookSubscription } from '../entities/webhook-subscription.entity';
import { Notification } from '../entities/notification.entity';
import { Comment } from '../entities/comment.entity';
import { SourceSnapshot } from '../entities/source-snapshot.entity';
import { DetectorFinding } from '../entities/detector-finding.entity';
import { ApplicabilityRecommendation } from '../entities/applicability-recommendation.entity';
import { ReviewDecision } from '../entities/review-decision.entity';
import { IntegrationCredential } from '../entities/integration-credential.entity';
import { IntegrationControlLink } from '../entities/integration-control-link.entity';
import { IntegrationIdempotency } from '../entities/integration-idempotency.entity';
import { PoamEntry } from '../entities/poam-entry.entity';
import { ProjectSnapshot } from '../entities/project-snapshot.entity';
import { Framework } from '../entities/framework.entity';
import { FrameworkRelease } from '../entities/framework-release.entity';
import { CatalogControl } from '../entities/catalog-control.entity';
import { CatalogRequirement } from '../entities/catalog-requirement.entity';
import { InternalControl } from '../entities/internal-control.entity';
import { InternalControlMapping } from '../entities/internal-control-mapping.entity';
import { IntegrationConnectorInstance } from '../entities/integration-connector-instance.entity';
import { IntegrationConnectorRun } from '../entities/integration-connector-run.entity';
import { Risk } from '../entities/risk.entity';
import { RiskChecklistMitigation } from '../entities/risk-checklist-mitigation.entity';
import { RiskInternalControlMitigation } from '../entities/risk-internal-control-mitigation.entity';
import { RiskAcceptanceRequest } from '../entities/risk-acceptance-request.entity';
import { RiskAcceptanceStep } from '../entities/risk-acceptance-step.entity';
import { Policy } from '../entities/policy.entity';
import { PolicyVersion } from '../entities/policy-version.entity';
import { PolicyControlMapping } from '../entities/policy-control-mapping.entity';
import { PolicyAttestation } from '../entities/policy-attestation.entity';
import { ComplianceSnapshot } from '../entities/compliance-snapshot.entity';
import { ControlTestResult } from '../entities/control-test-result.entity';
import { GrcAudit } from '../entities/grc-audit.entity';
import { AuditFinding } from '../entities/audit-finding.entity';
import { AuditEvidenceRequest } from '../entities/audit-evidence-request.entity';
import { ReportTemplate } from '../entities/report-template.entity';
import { Vendor } from '../entities/vendor.entity';
import { VendorAssessment } from '../entities/vendor-assessment.entity';
import { VendorControlMapping } from '../entities/vendor-control-mapping.entity';
import { Incident } from '../entities/incident.entity';
import { IncidentControlImpact } from '../entities/incident-control-impact.entity';
import { PipelineCheck } from '../entities/pipeline-check.entity';
import { Asset } from '../entities/asset.entity';
import { AssetControlMapping } from '../entities/asset-control-mapping.entity';

export const entities = [
  User,
  FrmrVersion,
  FrdTerm,
  FrrRequirement,
  KsiIndicator,
  Project,
  ProjectMember,
  ChecklistItem,
  EvidenceItem,
  Finding,
  AuditLog,
  WebhookSubscription,
  Notification,
  Comment,
  SourceSnapshot,
  DetectorFinding,
  ApplicabilityRecommendation,
  ReviewDecision,
  IntegrationCredential,
  IntegrationControlLink,
  IntegrationIdempotency,
  PoamEntry,
  ProjectSnapshot,
  Framework,
  FrameworkRelease,
  CatalogControl,
  CatalogRequirement,
  InternalControl,
  InternalControlMapping,
  IntegrationConnectorInstance,
  IntegrationConnectorRun,
  Risk,
  RiskChecklistMitigation,
  RiskInternalControlMitigation,
  RiskAcceptanceRequest,
  RiskAcceptanceStep,
  Policy,
  PolicyVersion,
  PolicyControlMapping,
  PolicyAttestation,
  ComplianceSnapshot,
  ControlTestResult,
  GrcAudit,
  AuditFinding,
  AuditEvidenceRequest,
  ReportTemplate,
  Vendor,
  VendorAssessment,
  VendorControlMapping,
  Incident,
  IncidentControlImpact,
  PipelineCheck,
  Asset,
  AssetControlMapping,
];
