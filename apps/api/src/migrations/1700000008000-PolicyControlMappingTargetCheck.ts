import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Disallow rows where both catalog and internal control are unset.
 * SQLite relies on entity @BeforeInsert/@BeforeUpdate; Postgres also gets a DB CHECK.
 */
export class PolicyControlMappingTargetCheck1700000008000
  implements MigrationInterface
{
  name = 'PolicyControlMappingTargetCheck1700000008000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(`
      DELETE FROM "policy_control_mappings"
      WHERE "catalog_requirement_id" IS NULL AND "internal_control_id" IS NULL
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "policy_control_mappings"
          ADD CONSTRAINT "CHK_policy_control_mapping_target"
          CHECK ("catalog_requirement_id" IS NOT NULL OR "internal_control_id" IS NOT NULL);
      EXCEPTION
        WHEN duplicate_object THEN NULL;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'postgres') {
      return;
    }
    await queryRunner.query(
      `ALTER TABLE "policy_control_mappings" DROP CONSTRAINT IF EXISTS "CHK_policy_control_mapping_target"`,
    );
  }
}
