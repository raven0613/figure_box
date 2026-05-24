import Dexie, { type Table } from 'dexie';

import {
  SAVE_DATABASE_NAME,
  SAVE_DATABASE_VERSION,
  type CharacterSaveRecord,
  type ItemSaveRecord,
  type RelationshipSaveRecord,
  type SaveMetaRecord,
  type SaveTableName,
  type SaveTableSchemaSummary,
  type SettingsRecord,
  type ShopSaveRecord,
  type WorldProgressRecord,
} from './saveTypes';

export interface GenericSaveRecord {
  id: string;
  updatedAt?: number;
  [key: string]: unknown;
}

const TABLE_SCHEMAS: Record<SaveTableName, string> = {
  saveMeta: 'id, schemaVersion, updatedAt',
  worldProgress: 'id, day, updatedAt',
  items: 'id, updatedAt',
  settings: 'id, updatedAt',
  shops: 'id, updatedAt',
  relationships: 'id, updatedAt',
  characters: 'id, seedId, updatedAt',
  characterAvatars: 'id, characterId, updatedAt',
};

class FigureBoxSaveDatabase extends Dexie {
  saveMeta!: Table<SaveMetaRecord, string>;
  worldProgress!: Table<WorldProgressRecord, string>;
  items!: Table<ItemSaveRecord, string>;
  settings!: Table<SettingsRecord, string>;
  shops!: Table<ShopSaveRecord, string>;
  relationships!: Table<RelationshipSaveRecord, string>;
  characters!: Table<CharacterSaveRecord, string>;
  characterAvatars!: Table<GenericSaveRecord, string>;

  constructor() {
    super(SAVE_DATABASE_NAME);
    this.version(SAVE_DATABASE_VERSION).stores(TABLE_SCHEMAS);
  }
}

export const saveDb = new FigureBoxSaveDatabase();

export const SAVE_TABLES = Object.keys(TABLE_SCHEMAS) as SaveTableName[];

export function getSaveTableSchemaSummaries(): readonly SaveTableSchemaSummary[] {
  return SAVE_TABLES.map(tableName => {
    const [primaryKey, ...indexes] = TABLE_SCHEMAS[tableName]
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);

    return {
      name: tableName,
      primaryKey: primaryKey ?? 'id',
      indexes,
    };
  });
}

export function getSaveTable(tableName: SaveTableName): Table<unknown, string> {
  return saveDb.table(tableName);
}

export async function deleteSaveDatabase(): Promise<void> {
  await saveDb.close();
  await Dexie.delete(SAVE_DATABASE_NAME);
}
