import { getSaveTable, getSaveTableSchemaSummaries, SAVE_TABLES } from './saveDb';
import type {
  SaveTableDebugSnapshot,
  SaveTableName,
  SaveTableSchemaSummary,
} from './saveTypes';

const DEFAULT_DEBUG_ROW_LIMIT = 100;

export interface SaveDebugDatabaseSnapshot {
  schemas: readonly SaveTableSchemaSummary[];
  tables: readonly SaveTableDebugSnapshot[];
}

export async function getSaveDebugDatabaseSnapshot(
  rowLimit = DEFAULT_DEBUG_ROW_LIMIT,
): Promise<SaveDebugDatabaseSnapshot> {
  const tables = await Promise.all(
    SAVE_TABLES.map(tableName => getSaveTableDebugSnapshot(tableName, rowLimit)),
  );

  return {
    schemas: getSaveTableSchemaSummaries(),
    tables,
  };
}

export async function getSaveTableDebugSnapshot(
  tableName: SaveTableName,
  rowLimit = DEFAULT_DEBUG_ROW_LIMIT,
): Promise<SaveTableDebugSnapshot> {
  const table = getSaveTable(tableName);
  const [count, rows] = await Promise.all([
    table.count(),
    table.limit(rowLimit).toArray(),
  ]);

  return {
    table: tableName,
    count,
    rows,
    detectedFields: getDetectedFields(rows),
  };
}

function getDetectedFields(rows: readonly unknown[]): readonly string[] {
  const fields = new Set<string>();

  rows.forEach(row => {
    if (!isRecord(row)) {
      return;
    }

    Object.keys(row).forEach(key => fields.add(key));
  });

  return Array.from(fields).sort((a, b) => a.localeCompare(b));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
