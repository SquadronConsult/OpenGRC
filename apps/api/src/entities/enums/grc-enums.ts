/** Checklist control implementation status (dashboard / readiness). */
export enum ChecklistItemStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Compliant = 'compliant',
  NonCompliant = 'non_compliant',
}

/** Risk register row lifecycle. */
export enum RiskStatus {
  Draft = 'draft',
  Open = 'open',
  Treating = 'treating',
  Accepted = 'accepted',
  Closed = 'closed',
}

/** Formal risk acceptance workflow state. */
export enum RiskAcceptanceRequestStatus {
  Draft = 'draft',
  Submitted = 'submitted',
  Approved = 'approved',
  Rejected = 'rejected',
  Cancelled = 'cancelled',
}

/** Audit finding remediation lifecycle. */
export enum AuditFindingStatus {
  Open = 'open',
  Remediation = 'remediation',
  Closed = 'closed',
  RiskAccepted = 'risk_accepted',
}

/**
 * Severity for audit findings (FedRAMP-style P1–P4 or qualitative scale).
 * APIs may send other strings historically; prefer these values for new data.
 */
export enum AuditFindingSeverity {
  P1 = 'P1',
  P2 = 'P2',
  P3 = 'P3',
  P4 = 'P4',
  Low = 'low',
  Medium = 'medium',
  High = 'high',
  Critical = 'critical',
}

/** Evidence artifact review workflow. */
export enum EvidenceReviewState {
  Draft = 'draft',
  ReadyForReview = 'ready_for_review',
  Accepted = 'accepted',
  Rejected = 'rejected',
  Expired = 'expired',
}
