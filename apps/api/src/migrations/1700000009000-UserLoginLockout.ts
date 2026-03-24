import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserLoginLockout1700000009000 implements MigrationInterface {
  name = 'UserLoginLockout1700000009000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'sqlite') {
      const cols = await queryRunner.query(`PRAGMA table_info(users)`);
      const names = new Set((cols as { name: string }[]).map((c) => c.name));
      if (!names.has('failed_login_attempts')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "failed_login_attempts" integer NOT NULL DEFAULT 0`,
        );
      }
      if (!names.has('locked_until')) {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "locked_until" datetime`);
      }
    } else {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "failed_login_attempts" integer NOT NULL DEFAULT 0
      `);
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locked_until" TIMESTAMP
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type !== 'sqlite') {
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "locked_until"`);
      await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "failed_login_attempts"`);
    }
  }
}
