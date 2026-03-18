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
];
