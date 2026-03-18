import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialLocalSchema1700000000000 implements MigrationInterface {
  name = 'InitialLocalSchema1700000000000';

  public async up(_queryRunner: QueryRunner): Promise<void> {
    // Schema is currently managed by TypeORM synchronize for local-first setup.
    // This migration exists as an anchor so future migrations can be tracked.
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // No-op anchor migration.
  }
}
