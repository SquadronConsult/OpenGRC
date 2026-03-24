import { ColumnType } from 'typeorm';

export const datetimeColumnType: ColumnType =
  (process.env.DB_TYPE || 'sqlite') === 'postgres' ? 'timestamp' : 'datetime';
