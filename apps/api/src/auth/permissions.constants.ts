/**
 * Project-scoped permission keys for granular RBAC (Phase 3+ enforcement).
 * Store as JSON array on ProjectMember.permissions when migration adds the column;
 * until then, role string remains the coarse default.
 */
export const ProjectPermission = {
  PROJECT_READ: 'project:read',
  PROJECT_WRITE: 'project:write',
  CHECKLIST_READ: 'checklist:read',
  CHECKLIST_WRITE: 'checklist:write',
  EVIDENCE_UPLOAD: 'evidence:upload',
  EVIDENCE_REVIEW: 'evidence:review',
  RISK_READ: 'risk:read',
  RISK_WRITE: 'risk:write',
  POLICY_READ: 'policy:read',
  POLICY_WRITE: 'policy:write',
  AUDIT_READ: 'audit:read',
  AUDIT_WRITE: 'audit:write',
  COMMENT_WRITE: 'comment:write',
  COMMENT_RESOLVE: 'comment:resolve',
  REPORT_READ: 'report:read',
  ADMIN_PROJECT: 'project:admin',
} as const;

export type ProjectPermissionKey =
  (typeof ProjectPermission)[keyof typeof ProjectPermission];

/** Default permissions by legacy project member role string. */
export const DEFAULT_PERMISSIONS_BY_ROLE: Record<string, ProjectPermissionKey[]> = {
  owner: Object.values(ProjectPermission),
  admin: Object.values(ProjectPermission),
  member: [
    ProjectPermission.PROJECT_READ,
    ProjectPermission.CHECKLIST_READ,
    ProjectPermission.CHECKLIST_WRITE,
    ProjectPermission.EVIDENCE_UPLOAD,
    ProjectPermission.RISK_READ,
    ProjectPermission.RISK_WRITE,
    ProjectPermission.POLICY_READ,
    ProjectPermission.COMMENT_WRITE,
    ProjectPermission.REPORT_READ,
  ],
  viewer: [
    ProjectPermission.PROJECT_READ,
    ProjectPermission.CHECKLIST_READ,
    ProjectPermission.RISK_READ,
    ProjectPermission.POLICY_READ,
    ProjectPermission.REPORT_READ,
  ],
  engineer: [
    ProjectPermission.PROJECT_READ,
    ProjectPermission.CHECKLIST_READ,
    ProjectPermission.CHECKLIST_WRITE,
    ProjectPermission.EVIDENCE_UPLOAD,
    ProjectPermission.COMMENT_WRITE,
  ],
  assessor: [
    ProjectPermission.PROJECT_READ,
    ProjectPermission.CHECKLIST_READ,
    ProjectPermission.EVIDENCE_REVIEW,
    ProjectPermission.COMMENT_WRITE,
    ProjectPermission.REPORT_READ,
  ],
  agency_reviewer: [
    ProjectPermission.PROJECT_READ,
    ProjectPermission.CHECKLIST_READ,
    ProjectPermission.COMMENT_WRITE,
    ProjectPermission.REPORT_READ,
  ],
};
