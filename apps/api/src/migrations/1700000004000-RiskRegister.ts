import { MigrationInterface, QueryRunner } from 'typeorm';

export class RiskRegister1700000004000 implements MigrationInterface {
  name = 'RiskRegister1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'sqlite') {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risks" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "title" varchar NOT NULL,
          "description" text,
          "category" varchar,
          "likelihood" integer NOT NULL,
          "impact" integer NOT NULL,
          "inherent_score" integer NOT NULL,
          "residual_likelihood" integer,
          "residual_impact" integer,
          "residual_score" integer,
          "residual_override_reason" text,
          "status" varchar NOT NULL DEFAULT 'open',
          "owner_user_id" varchar(36),
          "appetite_decision" varchar,
          "acceptance_expires_at" datetime,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_risks_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_risks_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_risks_project_id" ON "risks" ("project_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_checklist_mitigations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_rcm_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rcm_checklist" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rcm_risk_checklist" ON "risk_checklist_mitigations" ("risk_id", "checklist_item_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rcm_risk" ON "risk_checklist_mitigations" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rcm_checklist" ON "risk_checklist_mitigations" ("checklist_item_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_internal_control_mitigations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_ricm_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_ricm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ricm_risk_ic" ON "risk_internal_control_mitigations" ("risk_id", "internal_control_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_ricm_risk" ON "risk_internal_control_mitigations" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_acceptance_requests" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL DEFAULT 'draft',
          "submitted_by_id" varchar(36),
          "submitted_at" datetime,
          "notes" text,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_rar_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rar_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rar_submitter" FOREIGN KEY ("submitted_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rar_risk" ON "risk_acceptance_requests" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rar_project" ON "risk_acceptance_requests" ("project_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_acceptance_steps" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "request_id" varchar(36) NOT NULL,
          "order_index" integer NOT NULL,
          "approver_user_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL DEFAULT 'pending',
          "notes" text,
          "acted_at" datetime,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          CONSTRAINT "FK_ras_request" FOREIGN KEY ("request_id") REFERENCES "risk_acceptance_requests" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_ras_approver" FOREIGN KEY ("approver_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_ras_request_order" ON "risk_acceptance_steps" ("request_id", "order_index")
      `);
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risks" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "title" varchar NOT NULL,
          "description" text,
          "category" varchar,
          "likelihood" integer NOT NULL,
          "impact" integer NOT NULL,
          "inherent_score" integer NOT NULL,
          "residual_likelihood" integer,
          "residual_impact" integer,
          "residual_score" integer,
          "residual_override_reason" text,
          "status" varchar NOT NULL DEFAULT 'open',
          "owner_user_id" varchar(36),
          "appetite_decision" varchar,
          "acceptance_expires_at" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_risks_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_risks_owner" FOREIGN KEY ("owner_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_risks_project_id" ON "risks" ("project_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_checklist_mitigations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_rcm_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rcm_checklist" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_rcm_risk_checklist" ON "risk_checklist_mitigations" ("risk_id", "checklist_item_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rcm_risk" ON "risk_checklist_mitigations" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rcm_checklist" ON "risk_checklist_mitigations" ("checklist_item_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_internal_control_mitigations" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "internal_control_id" varchar(36) NOT NULL,
          "notes" text,
          CONSTRAINT "FK_ricm_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_ricm_ic" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "IDX_ricm_risk_ic" ON "risk_internal_control_mitigations" ("risk_id", "internal_control_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_ricm_risk" ON "risk_internal_control_mitigations" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_acceptance_requests" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "risk_id" varchar(36) NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL DEFAULT 'draft',
          "submitted_by_id" varchar(36),
          "submitted_at" TIMESTAMPTZ,
          "notes" text,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_rar_risk" FOREIGN KEY ("risk_id") REFERENCES "risks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rar_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_rar_submitter" FOREIGN KEY ("submitted_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rar_risk" ON "risk_acceptance_requests" ("risk_id")
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_rar_project" ON "risk_acceptance_requests" ("project_id")
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "risk_acceptance_steps" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "request_id" varchar(36) NOT NULL,
          "order_index" integer NOT NULL,
          "approver_user_id" varchar(36) NOT NULL,
          "status" varchar NOT NULL DEFAULT 'pending',
          "notes" text,
          "acted_at" TIMESTAMPTZ,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT "FK_ras_request" FOREIGN KEY ("request_id") REFERENCES "risk_acceptance_requests" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
          CONSTRAINT "FK_ras_approver" FOREIGN KEY ("approver_user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
        )
      `);
      await queryRunner.query(`
        CREATE INDEX IF NOT EXISTS "IDX_ras_request_order" ON "risk_acceptance_steps" ("request_id", "order_index")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "risk_acceptance_steps"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "risk_acceptance_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "risk_internal_control_mitigations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "risk_checklist_mitigations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "risks"`);
  }
}
