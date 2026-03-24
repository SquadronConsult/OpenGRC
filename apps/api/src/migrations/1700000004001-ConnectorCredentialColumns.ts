import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConnectorCredentialColumns1700000004001 implements MigrationInterface {
  name = 'ConnectorCredentialColumns1700000004001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const isSqlite = driver === 'sqlite';
    const uuidType = isSqlite ? 'varchar(36)' : 'uuid';
    const datetimeType = isSqlite ? 'datetime' : 'TIMESTAMPTZ';
    const nowExpr = isSqlite ? "(datetime('now'))" : 'now()';
    const boolTrue = isSqlite ? '1' : 'true';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_credentials" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "project_id" ${uuidType} NOT NULL,
        "label" varchar NOT NULL,
        "api_key_hash" varchar NOT NULL,
        "api_key_prefix" varchar NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'inbound',
        "is_active" boolean NOT NULL DEFAULT ${boolTrue},
        "last_used_at" ${datetimeType},
        "created_at" ${datetimeType} NOT NULL DEFAULT ${nowExpr},
        "updated_at" ${datetimeType} NOT NULL DEFAULT ${nowExpr},
        CONSTRAINT "FK_integration_credentials_project" FOREIGN KEY ("project_id") REFERENCES "projects" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);

    if (isSqlite) {
      const credentialCols = await queryRunner.query(`PRAGMA table_info(integration_credentials)`);
      const credentialColNames = new Set(
        (credentialCols as { name: string }[]).map((c) => c.name),
      );
      if (!credentialColNames.has('kind')) {
        await queryRunner.query(
          `ALTER TABLE "integration_credentials" ADD COLUMN "kind" varchar NOT NULL DEFAULT 'inbound'`,
        );
      }

      const instanceCols = await queryRunner.query(
        `PRAGMA table_info(integration_connector_instances)`,
      );
      const instanceColNames = new Set((instanceCols as { name: string }[]).map((c) => c.name));
      if (!instanceColNames.has('linked_credential_id')) {
        await queryRunner.query(
          `ALTER TABLE "integration_connector_instances" ADD COLUMN "linked_credential_id" ${uuidType}`,
        );
      }
      return;
    }

    await queryRunner.query(`
      ALTER TABLE "integration_credentials" ADD COLUMN IF NOT EXISTS "kind" varchar NOT NULL DEFAULT 'inbound'
    `);
    await queryRunner.query(`
      ALTER TABLE "integration_connector_instances" ADD COLUMN IF NOT EXISTS "linked_credential_id" ${uuidType}
    `);
  }

  public async down(): Promise<void> {
    // additive migration
  }
}
