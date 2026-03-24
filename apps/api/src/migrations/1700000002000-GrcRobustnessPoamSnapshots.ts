import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * POA&M persistence + project snapshots + evidence metadata columns.
 * Safe for SQLite when DB_SYNC=false and migrations run after upgrade.
 */
export class GrcRobustnessPoamSnapshots1700000002000 implements MigrationInterface {
  name = 'GrcRobustnessPoamSnapshots1700000002000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    if (driver === 'sqlite') {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "poam_entries" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36),
          "row_data" text NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now')),
          "updated_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "project_snapshots" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "title" varchar(512) NOT NULL,
          "kind" varchar NOT NULL DEFAULT 'manual',
          "payload" text NOT NULL,
          "created_at" datetime NOT NULL DEFAULT (datetime('now'))
        )
      `);
      const cols = await queryRunner.query(`PRAGMA table_info(evidence_items)`);
      const names = new Set((cols as { name: string }[]).map((c) => c.name));
      if (!names.has('review_state')) {
        await queryRunner.query(`ALTER TABLE "evidence_items" ADD COLUMN "review_state" varchar`);
      }
      if (!names.has('artifact_type')) {
        await queryRunner.query(`ALTER TABLE "evidence_items" ADD COLUMN "artifact_type" varchar`);
      }
      if (!names.has('source_system')) {
        await queryRunner.query(`ALTER TABLE "evidence_items" ADD COLUMN "source_system" varchar`);
      }
      if (!names.has('collection_start')) {
        await queryRunner.query(`ALTER TABLE "evidence_items" ADD COLUMN "collection_start" datetime`);
      }
      if (!names.has('collection_end')) {
        await queryRunner.query(`ALTER TABLE "evidence_items" ADD COLUMN "collection_end" datetime`);
      }
    } else {
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "poam_entries" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "checklist_item_id" varchar(36),
          "row_data" jsonb NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
          "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(`
        CREATE TABLE IF NOT EXISTS "project_snapshots" (
          "id" varchar(36) PRIMARY KEY NOT NULL,
          "project_id" varchar(36) NOT NULL,
          "title" varchar(512) NOT NULL,
          "kind" varchar NOT NULL DEFAULT 'manual',
          "payload" jsonb NOT NULL,
          "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "review_state" varchar`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "artifact_type" varchar`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "source_system" varchar`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "collection_start" TIMESTAMPTZ`,
      );
      await queryRunner.query(
        `ALTER TABLE "evidence_items" ADD COLUMN IF NOT EXISTS "collection_end" TIMESTAMPTZ`,
      );
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive down: tables may contain user data.
  }
}
