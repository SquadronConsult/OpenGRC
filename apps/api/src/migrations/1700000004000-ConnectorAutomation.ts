import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConnectorAutomation1700000004000 implements MigrationInterface {
  name = 'ConnectorAutomation1700000004000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const isSqlite = driver === 'sqlite';
    const uuidType = isSqlite ? 'varchar(36)' : 'uuid';
    const datetimeType = isSqlite ? 'datetime' : 'TIMESTAMPTZ';
    const nowExpr = isSqlite ? "(datetime('now'))" : 'now()';
    const boolTrue = isSqlite ? '1' : 'true';
    const diagnosticsType = isSqlite ? 'text' : 'jsonb';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_connector_instances" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "project_id" ${uuidType} NOT NULL,
        "connector_id" varchar NOT NULL,
        "label" varchar NOT NULL,
        "enabled" boolean NOT NULL DEFAULT ${boolTrue},
        "config_json" text NOT NULL,
        "cursor" text,
        "last_run_at" ${datetimeType},
        "last_success_at" ${datetimeType},
        "last_error" text,
        "created_at" ${datetimeType} NOT NULL DEFAULT ${nowExpr},
        "updated_at" ${datetimeType} NOT NULL DEFAULT ${nowExpr},
        CONSTRAINT "FK_conn_inst_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_connector_runs" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "instance_id" ${uuidType} NOT NULL,
        "status" varchar NOT NULL DEFAULT 'running',
        "started_at" ${datetimeType} NOT NULL,
        "finished_at" ${datetimeType},
        "items_accepted" integer NOT NULL DEFAULT 0,
        "items_rejected" integer NOT NULL DEFAULT 0,
        "error_message" text,
        "diagnostics" ${diagnosticsType},
        "created_at" ${datetimeType} NOT NULL DEFAULT ${nowExpr},
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
