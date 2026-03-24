import { MigrationInterface, QueryRunner } from 'typeorm';

export class ConnectorCredentialColumns1700000004001 implements MigrationInterface {
  name = 'ConnectorCredentialColumns1700000004001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "integration_credentials" ADD COLUMN "kind" varchar NOT NULL DEFAULT 'inbound'
    `);
    await queryRunner.query(`
      ALTER TABLE "integration_connector_instances" ADD COLUMN "linked_credential_id" varchar
    `);
  }

  public async down(): Promise<void> {
    // additive migration
  }
}
