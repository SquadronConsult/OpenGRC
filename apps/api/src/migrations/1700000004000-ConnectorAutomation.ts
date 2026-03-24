import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConnectorAutomation1700000004000 implements MigrationInterface {
  name = 'ConnectorAutomation1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_connector_instances" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "project_id" varchar(36) NOT NULL,
        "connector_id" varchar NOT NULL,
        "label" varchar NOT NULL,
        "enabled" boolean NOT NULL DEFAULT 1,
        "config_json" text NOT NULL,
        "cursor" text,
        "last_run_at" datetime,
        "last_success_at" datetime,
        "last_error" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        "updated_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_conn_inst_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_connector_runs" (
        "id" varchar(36) PRIMARY KEY NOT NULL,
        "instance_id" varchar(36) NOT NULL,
        "status" varchar NOT NULL DEFAULT 'running',
        "started_at" datetime NOT NULL,
        "finished_at" datetime,
        "items_accepted" integer NOT NULL DEFAULT 0,
        "items_rejected" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "diagnostics" text,
        "created_at" datetime NOT NULL DEFAULT (datetime('now')),
        CONSTRAINT "FK_conn_run_instance" FOREIGN KEY ("instance_id") REFERENCES "integration_connector_instances" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conn_inst_project" ON "integration_connector_instances" ("project_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_conn_run_instance" ON "integration_connector_runs" ("instance_id")
    `);
  }

  public async down(): Promise<void> {
    // additive migration
  }
}
