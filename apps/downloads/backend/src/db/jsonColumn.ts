import type { JSONColumnType } from './types';

/** Serialize JSONB writes as JSON text, avoiding node-postgres array syntax. */
export function toJsonColumnValue<T>(value: T): JSONColumnType<T> {
  return JSON.stringify(value) as unknown as JSONColumnType<T>;
}
