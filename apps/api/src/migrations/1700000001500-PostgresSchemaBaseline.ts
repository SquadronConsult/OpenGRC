import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Production baseline for fresh Postgres installs.
 *
 * Earlier migrations in this repo were historical anchors because local-first
 * deployments relied on TypeORM synchronize to create the initial schema.
 * For a brand-new Postgres database, later migrations (starting at 2000)
 * expect core tables like `users`, `projects`, `checklist_items`, and
 * `evidence_items` to already exist.
 *
 * This migration uses the current entity metadata exactly once to establish
 * that baseline on fresh/partially initialized Postgres databases, after which
 * the additive historical migrations can run safely.
 */
export class PostgresSchemaBaseline1700000001500
  implements MigrationInterface
{
  name = 'PostgresSchemaBaseline1700000001500';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (queryRunner.connection.options.type === 'sqlite') {
      return;
    }

    const tableRows = await queryRunner.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_type = 'BASE TABLE'
    `);
    const tableNames = new Set(
      (tableRows as { table_name: string }[]).map((row) => row.table_name),
    );

    const hasCoreSchema =
      tableNames.has('users') &&
      tableNames.has('projects') &&
      tableNames.has('checklist_items') &&
      tableNames.has('evidence_items');

    if (hasCoreSchema) {
      return;
    }

    await queryRunner.connection.synchronize(false);
  }

  public async down(): Promise<void> {
    // Baseline only; never drop schema automatically.
  }
}
