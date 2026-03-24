import { MigrationInterface, QueryRunner } from 'typeorm';

export class GrcPlatformExpansion1700000006000 implements MigrationInterface {
  name = 'GrcPlatformExpansion1700000006000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const isSqlite = driver === 'sqlite';

    if (isSqlite) {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policies" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36),
          "title" varchar NOT NULL,
          "version" varchar NOT NULL DEFAULT '1.0.0',
          "status" varchar NOT NULL,
          "category" varchar,
          "owner_user_id" varchar(36),
          "approver_user_id" varchar(36),
          "content" text NOT NULL,
          "effective_date" datetime,
          "next_review_date" datetime,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_policies_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_policies_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_policies_approver" FOREIGN KEY ("approver_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_policies_project" ON "policies" ("project_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_versions" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "version_number" varchar NOT NULL,
          "content" text NOT NULL,
          "change_description" text,
          "author_user_id" varchar(36),
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_pv_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pv_author" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_pv_policy" ON "policy_versions" ("policy_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "catalog_requirement_id" varchar(36),
          "internal_control_id" varchar(36),
          CONSTRAINT "FK_pcm_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pcm_cat" FOREIGN KEY ("catalog_requirement_id") REFERENCES "catalog_requirements" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_pcm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_attestations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "policy_version_id" varchar(36),
          "user_id" varchar(36) NOT NULL,
          "attested_at" datetime,
          "expires_at" datetime,
          "status" varchar NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_pa_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pa_pv" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_pa_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_pa_policy" ON "policy_attestations" ("policy_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "compliance_snapshots" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "captured_at" datetime NOT NULL,
          "total_controls" integer NOT NULL,
          "compliant" integer NOT NULL,
          "in_progress" integer NOT NULL,
          "non_compliant" integer NOT NULL,
          "readiness_pct" float NOT NULL,
          "evidence_count" integer NOT NULL,
          "expired_evidence_count" integer NOT NULL,
          "open_risk_count" integer NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_cs_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_cs_project_cap" ON "compliance_snapshots" ("project_id", "captured_at")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "control_test_results" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "test_type" varchar NOT NULL,
          "result" varchar NOT NULL,
          "tested_at" datetime,
          "next_test_date" datetime,
          "connector_run_id" varchar(36),
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_ctr_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ctr_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ctr_run" FOREIGN KEY ("connector_run_id") REFERENCES "integration_connector_runs" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_ctr_project" ON "control_test_results" ("project_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "grc_audits" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "type" varchar NOT NULL,
          "status" varchar NOT NULL,
          "lead_auditor_user_id" varchar(36),
          "scope" text,
          "planned_start" datetime,
          "planned_end" datetime,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_grc_audit_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_grc_audit_lead" FOREIGN KEY ("lead_auditor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "audit_findings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "audit_id" varchar(36) NOT NULL,
          "severity" varchar NOT NULL,
          "status" varchar NOT NULL,
          "checklist_item_id" varchar(36),
          "title" varchar NOT NULL,
          "description" text,
          "remediation_plan" text,
          "due_date" datetime,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_af_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_af_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "audit_evidence_requests" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "audit_id" varchar(36) NOT NULL,
          "assignee_user_id" varchar(36),
          "status" varchar NOT NULL,
          "notes" text,
          "evidence_item_id" varchar(36),
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_aer_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_aer_assignee" FOREIGN KEY ("assignee_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_aer_ev" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "report_templates" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36),
          "type" varchar NOT NULL,
          "name" varchar NOT NULL,
          "config" text,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_rt_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendors" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "name" varchar NOT NULL,
          "criticality" varchar,
          "status" varchar NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_vendors_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendor_assessments" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "vendor_id" varchar(36) NOT NULL,
          "risk_score" float,
          "questionnaire" text,
          "findings" text,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_va_vendor" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendor_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "vendor_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          CONSTRAINT "FK_vcm_vendor" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_vcm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "incidents" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "severity" varchar NOT NULL,
          "status" varchar NOT NULL,
          "title" varchar NOT NULL,
          "description" text,
          "impact_assessment" text,
          "root_cause" text,
          "owner_user_id" varchar(36),
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_inc_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_inc_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "incident_control_impacts" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "incident_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_ici_inc" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ici_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "pipeline_checks" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL,
          "detail" text,
          "external_ref" varchar,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_pc_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "assets" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "name" varchar NOT NULL,
          "type" varchar,
          "environment" varchar,
          "criticality" varchar,
          "metadata" text,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_assets_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "asset_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "asset_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          CONSTRAINT "FK_acm_asset" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_acm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN "expires_at" datetime`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN "superseded_by_id" varchar(36)`,
      );
      await queryRunner.query(
        `ALTER TABLE "integration_connector_instances" ADD COLUMN "recollection_enabled" boolean NOT NULL DEFAULT 0`,
      );
      await queryRunner.query(
        `ALTER TABLE "integration_connector_instances" ADD COLUMN "recollection_interval_days" integer`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN "resolved_at" datetime`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN "resolved_by_user_id" varchar(36)`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN "mentions" text`,
      );
      await queryRunner.query(
        `ALTER TABLE "project_members" ADD COLUMN "permissions" text`,
      );
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policies" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36),
          "title" varchar NOT NULL,
          "version" varchar NOT NULL DEFAULT '1.0.0',
          "status" varchar NOT NULL,
          "category" varchar,
          "owner_user_id" varchar(36),
          "approver_user_id" varchar(36),
          "content" text NOT NULL,
          "effective_date" TIMESTAMPTZ,
          "next_review_date" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_policies_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_policies_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_policies_approver" FOREIGN KEY ("approver_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_policies_project" ON "policies" ("project_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_versions" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "version_number" varchar NOT NULL,
          "content" text NOT NULL,
          "change_description" text,
          "author_user_id" varchar(36),
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_pv_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pv_author" FOREIGN KEY ("author_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_pv_policy" ON "policy_versions" ("policy_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "catalog_requirement_id" varchar(36),
          "internal_control_id" varchar(36),
          CONSTRAINT "FK_pcm_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pcm_cat" FOREIGN KEY ("catalog_requirement_id") REFERENCES "catalog_requirements" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_pcm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "policy_attestations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "policy_id" varchar(36) NOT NULL,
          "policy_version_id" varchar(36),
          "user_id" varchar(36) NOT NULL,
          "attested_at" TIMESTAMPTZ,
          "expires_at" TIMESTAMPTZ,
          "status" varchar NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_pa_policy" FOREIGN KEY ("policy_id") REFERENCES "policies" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_pa_pv" FOREIGN KEY ("policy_version_id") REFERENCES "policy_versions" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_pa_user" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_pa_policy" ON "policy_attestations" ("policy_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "compliance_snapshots" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "captured_at" TIMESTAMPTZ NOT NULL,
          "total_controls" integer NOT NULL,
          "compliant" integer NOT NULL,
          "in_progress" integer NOT NULL,
          "non_compliant" integer NOT NULL,
          "readiness_pct" double precision NOT NULL,
          "evidence_count" integer NOT NULL,
          "expired_evidence_count" integer NOT NULL,
          "open_risk_count" integer NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_cs_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_cs_project_cap" ON "compliance_snapshots" ("project_id", "captured_at")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "control_test_results" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "test_type" varchar NOT NULL,
          "result" varchar NOT NULL,
          "tested_at" TIMESTAMPTZ,
          "next_test_date" TIMESTAMPTZ,
          "connector_run_id" varchar(36),
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_ctr_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ctr_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ctr_run" FOREIGN KEY ("connector_run_id") REFERENCES "integration_connector_runs" ("id") ON DELETE SET NULL
        )
      `);
      await queryRunner.query(
        `CREATE INDEX IF NOT EXISTS "IDX_ctr_project" ON "control_test_results" ("project_id")`,
      );

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "grc_audits" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "type" varchar NOT NULL,
          "status" varchar NOT NULL,
          "lead_auditor_user_id" varchar(36),
          "scope" text,
          "planned_start" TIMESTAMPTZ,
          "planned_end" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_grc_audit_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_grc_audit_lead" FOREIGN KEY ("lead_auditor_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "audit_findings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "audit_id" varchar(36) NOT NULL,
          "severity" varchar NOT NULL,
          "status" varchar NOT NULL,
          "checklist_item_id" varchar(36),
          "title" varchar NOT NULL,
          "description" text,
          "remediation_plan" text,
          "due_date" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_af_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_af_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "audit_evidence_requests" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "audit_id" varchar(36) NOT NULL,
          "assignee_user_id" varchar(36),
          "status" varchar NOT NULL,
          "notes" text,
          "evidence_item_id" varchar(36),
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_aer_audit" FOREIGN KEY ("audit_id") REFERENCES "grc_audits" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_aer_assignee" FOREIGN KEY ("assignee_user_id") REFERENCES "users" ("id") ON DELETE SET NULL,
          CONSTRAINT "FK_aer_ev" FOREIGN KEY ("evidence_item_id") REFERENCES "evidence_items" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "report_templates" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36),
          "type" varchar NOT NULL,
          "name" varchar NOT NULL,
          "config" jsonb,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_rt_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendors" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "name" varchar NOT NULL,
          "criticality" varchar,
          "status" varchar NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_vendors_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendor_assessments" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "vendor_id" varchar(36) NOT NULL,
          "risk_score" double precision,
          "questionnaire" jsonb,
          "findings" text,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_va_vendor" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "vendor_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "vendor_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          CONSTRAINT "FK_vcm_vendor" FOREIGN KEY ("vendor_id") REFERENCES "vendors" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_vcm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "incidents" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "severity" varchar NOT NULL,
          "status" varchar NOT NULL,
          "title" varchar NOT NULL,
          "description" text,
          "impact_assessment" text,
          "root_cause" text,
          "owner_user_id" varchar(36),
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_inc_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_inc_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "incident_control_impacts" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "incident_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_ici_inc" FOREIGN KEY ("incident_id") REFERENCES "incidents" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_ici_ci" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "pipeline_checks" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL,
          "detail" text,
          "external_ref" varchar,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_pc_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "assets" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "name" varchar NOT NULL,
          "type" varchar,
          "environment" varchar,
          "criticality" varchar,
          "metadata" jsonb,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_assets_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "asset_control_mappings" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "asset_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          CONSTRAINT "FK_acm_asset" FOREIGN KEY ("asset_id") REFERENCES "assets" ("id") ON DELETE CASCADE,
          CONSTRAINT "FK_acm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE
        )
      `);

      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "superseded_by_id" varchar(36)`,
      );
      await queryRunner.query(
        `ALTER TABLE "integration_connector_instances" ADD COLUMN IF NOT EXISTS "recollection_enabled" boolean NOT NULL DEFAULT false`,
      );
      await queryRunner.query(
        `ALTER TABLE "integration_connector_instances" ADD COLUMN IF NOT EXISTS "recollection_interval_days" integer`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "resolved_by_user_id" varchar(36)`,
      );
      await queryRunner.query(
        `ALTER TABLE "comments" ADD COLUMN IF NOT EXISTS "mentions" jsonb`,
      );
      await queryRunner.query(
        `ALTER TABLE "project_members" ADD COLUMN IF NOT EXISTS "permissions" jsonb`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'asset_control_mappings',
      'assets',
      'pipeline_checks',
      'incident_control_impacts',
      'incidents',
      'vendor_control_mappings',
      'vendor_assessments',
      'vendors',
      'report_templates',
      'audit_evidence_requests',
      'audit_findings',
      'grc_audits',
      'control_test_results',
      'compliance_snapshots',
      'policy_attestations',
      'policy_control_mappings',
      'policy_versions',
      'policies',
    ];
    for (const t of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${t}"`);
    }
  }
}
