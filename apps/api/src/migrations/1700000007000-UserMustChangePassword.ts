import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserMustChangePassword1700000007000 implements MigrationInterface {
  name = 'UserMustChangePassword1700000007000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'sqlite') {
      const cols = await queryRunner.query(`PRAGMA table_info(users)`);
      const names = new Set((cols as { name: string }[]).map((c) => c.name));
      if (!names.has('must_change_password')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "must_change_password" boolean NOT NULL DEFAULT 0`,
        );
      }
    } else {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite cannot drop columns easily; no-op for safety.
    if (queryRunner.connection.options.type !== 'sqlite') {
      await queryRunner.query(
        `ALTER TABLE "users" DROP COLUMN IF EXISTS "must_change_password"`,
      );
    }
  }
}
