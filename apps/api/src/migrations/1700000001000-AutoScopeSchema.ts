import { MigrationInterface, QueryRunner } from 'typeorm';

export class AutoScopeSchema1700000001000 implements MigrationInterface {
  name = 'AutoScopeSchema1700000001000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Local-first deployments currently use TypeORM synchronize for schema updates.
    // This migration anchors auto-scope schema changes for future migration-based deployments.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op anchor migration.
  }
}
