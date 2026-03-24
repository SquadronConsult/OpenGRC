import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Generic framework catalog (Framework → Release → Control → Requirement),
 * internal controls + mappings, and checklist_items.catalog_requirement_id.
 */
export class GenericCatalog1700000003000 implements MigrationInterface {
  name = 'GenericCatalog1700000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const driver = queryRunner.connection.options.type;
    const jsonType = driver === 'sqlite' ? 'text' : 'jsonb';
    const uuidType = driver === 'sqlite' ? 'varchar(36)' : 'uuid';

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "frameworks" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "code" varchar NOT NULL,
        "name" varchar NOT NULL,
        "description" text
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_frameworks_code" ON "frameworks" ("code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "framework_releases" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "framework_id" ${uuidType} NOT NULL,
        "release_code" varchar NOT NULL,
        "label" varchar,
        "metadata" ${jsonType},
        "frmr_version_id" ${uuidType},
        CONSTRAINT "FK_framework_releases_framework" FOREIGN KEY ("framework_id") REFERENCES "frameworks" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_framework_releases_frmr_version" FOREIGN KEY ("frmr_version_id") REFERENCES "frmr_versions" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_framework_releases_frmr" ON "framework_releases" ("frmr_version_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_controls" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "framework_release_id" ${uuidType} NOT NULL,
        "control_code" varchar NOT NULL,
        "title" varchar,
        "description" text,
        "parent_id" ${uuidType},
        "metadata" ${jsonType},
        CONSTRAINT "FK_catalog_controls_release" FOREIGN KEY ("framework_release_id") REFERENCES "framework_releases" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_catalog_controls_release_code" ON "catalog_controls" ("framework_release_id", "control_code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "catalog_requirements" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "framework_release_id" ${uuidType} NOT NULL,
        "catalog_control_id" ${uuidType},
        "requirement_code" varchar NOT NULL,
        "statement" text NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'generic',
        "source_frr_id" ${uuidType},
        "source_ksi_id" ${uuidType},
        "metadata" ${jsonType},
        CONSTRAINT "FK_catalog_requirements_release" FOREIGN KEY ("framework_release_id") REFERENCES "framework_releases" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_catalog_requirements_control" FOREIGN KEY ("catalog_control_id") REFERENCES "catalog_controls" ("id") ON DELETE SET NULL ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_catalog_req_release_code" ON "catalog_requirements" ("framework_release_id", "requirement_code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "internal_controls" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "code" varchar NOT NULL,
        "title" varchar NOT NULL,
        "description" text
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_internal_controls_code" ON "internal_controls" ("code")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "internal_control_mappings" (
        "id" ${uuidType} PRIMARY KEY NOT NULL,
        "internal_control_id" ${uuidType} NOT NULL,
        "catalog_requirement_id" ${uuidType} NOT NULL,
        "framework_code" varchar,
        "mapping_type" varchar NOT NULL DEFAULT 'full',
        "coverage" float,
        "rationale" text,
        "source" varchar,
        "priority_rank" integer NOT NULL DEFAULT 0,
        CONSTRAINT "FK_icm_internal" FOREIGN KEY ("internal_control_id") REFERENCES "internal_controls" ("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_icm_requirement" FOREIGN KEY ("catalog_requirement_id") REFERENCES "catalog_requirements" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_icm_ic_req" ON "internal_control_mappings" ("internal_control_id", "catalog_requirement_id")
    `);

    let names = new Set<string>();
    if (driver === 'sqlite') {
      const cols = await queryRunner.query(`PRAGMA table_info(checklist_items)`);
      names = new Set((cols as { name: string }[]).map((c) => c.name));
    } else {
      const tableInfo = await queryRunner.query(
        `SELECT column_name as name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'checklist_items'`,
      );
      names = new Set((tableInfo as { name: string }[]).map((c) => c.name));
    }
    if (!names.has('catalog_requirement_id')) {
      if (driver === 'sqlite') {
        await queryRunner.query(
          `ALTER TABLE "checklist_items" ADD COLUMN "catalog_requirement_id" ${uuidType}`,
        );
      } else {
        await queryRunner.query(
          `ALTER TABLE "checklist_items" ADD COLUMN IF NOT EXISTS "catalog_requirement_id" ${uuidType}`,
        );
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive down: catalog is additive; omit table drops to avoid data loss.
  }
}
