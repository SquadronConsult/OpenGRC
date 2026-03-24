import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserAuthColumns1700000005000 implements MigrationInterface {
  name = 'UserAuthColumns1700000005000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'sqlite') {
      const cols = await queryRunner.query(`PRAGMA table_info(users)`);
      const names = new Set((cols as { name: string }[]).map((c) => c.name));
      if (!names.has('is_active')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "is_active" boolean NOT NULL DEFAULT 1`,
        );
      }
      if (!names.has('password_set_at')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "password_set_at" datetime`,
        );
      }
      if (!names.has('last_login_at')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "last_login_at" datetime`,
        );
      }
      if (!names.has('auth_provider')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "auth_provider" varchar NOT NULL DEFAULT 'local'`,
        );
      }
      if (!names.has('auth_subject')) {
        await queryRunner.query(
          `ALTER TABLE "users" ADD COLUMN "auth_subject" varchar`,
        );
      }
    } else {
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true
      `);
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_set_at" TIMESTAMPTZ
      `);
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" TIMESTAMPTZ
      `);
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_provider" varchar NOT NULL DEFAULT 'local'
      `);
      await queryRunner.query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "auth_subject" varchar
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // SQLite cannot drop columns easily; no-op for safety.
  }
}
