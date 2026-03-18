import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { entities } from './db/entities';

const dbType = process.env.DB_TYPE || 'sqlite';
const sqlitePath =
  process.env.SQLITE_PATH ||
  join(process.env.LOCAL_DATA_DIR || process.cwd(), 'grc.sqlite');

const dataSource =
  dbType === 'postgres'
    ? new DataSource({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USER || 'grc',
        password: process.env.DB_PASSWORD || 'grc',
        database: process.env.DB_NAME || 'grc',
        entities,
        migrations: ['src/migrations/*.ts'],
      })
    : new DataSource({
        type: 'sqlite',
        database: sqlitePath,
        entities,
        migrations: ['src/migrations/*.ts'],
      });

export default dataSource;
