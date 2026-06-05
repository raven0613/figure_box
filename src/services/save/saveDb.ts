import Dexie, { type Table } from 'dexie';

import {
  SAVE_DATABASE_NAME,
  SAVE_DATABASE_VERSION,
  type CharacterAvatarRecord,
  type CharacterProfileRecord,
  type CharacterRuntimeSaveRecord,
  type CustomObjectImageRecord,
  type CustomObjectRecord,
  type ItemSaveRecord,
  type OfflineRecapSaveRecord,
  type RelationshipSaveRecord,
  type SaveMetaRecord,
  type SaveTableName,
  type SaveTableSchemaSummary,
  type SettingsRecord,
  type ShopSaveRecord,
  type WorldProgressRecord,
} from './saveTypes';
import { deleteMiniSpriteSheetCacheDatabase } from './miniSpriteSheetCacheService';

export interface GenericSaveRecord {
  id: string;
  updatedAt?: number;
  [key: string]: unknown;
}

const LEGACY_V1_TABLE_SCHEMAS: Record<string, string> = {
  saveMeta: 'id, schemaVersion, updatedAt',
  worldProgress: 'id, day, updatedAt',
  items: 'id, updatedAt',
  settings: 'id, updatedAt',
  shops: 'id, updatedAt',
  relationships: 'id, updatedAt',
  characters: 'id, seedId, updatedAt',
  characterAvatars: 'id, characterId, updatedAt',
};

const LEGACY_V2_TABLE_SCHEMAS: Record<string, string> = {
  ...LEGACY_V1_TABLE_SCHEMAS,
  playerCharacters: 'id, source, templateId, updatedAt',
};

const LEGACY_V3_TABLE_SCHEMAS: Record<string, string> = {
  saveMeta: 'id, schemaVersion, updatedAt',
  worldProgress: 'id, day, updatedAt',
  items: 'id, updatedAt',
  settings: 'id, updatedAt',
  shops: 'id, updatedAt',
  relationships: 'id, updatedAt',
  characters: 'id, source, templateId, updatedAt',
  characterRuntime: 'id, seedId, updatedAt',
  characterAvatars: 'id, characterId, updatedAt',
};

type LegacyV4SaveTableName = Exclude<SaveTableName, 'offlineRecaps'>;

const TABLE_SCHEMAS: Record<LegacyV4SaveTableName, string> = {
  saveMeta: 'id, schemaVersion, updatedAt',
  worldProgress: 'id, day, updatedAt',
  items: 'id, updatedAt',
  settings: 'id, updatedAt',
  shops: 'id, updatedAt',
  relationships: 'id, updatedAt',
  characters: 'id, source, templateId, updatedAt',
  characterRuntime: 'id, seedId, updatedAt',
  characterAvatars: 'id, characterId, updatedAt',
  customObjects: 'id, source, imageId, updatedAt',
  customObjectImages: 'id, objectId, updatedAt',
};

const LEGACY_V4_TABLE_SCHEMAS: Record<string, string> = {
  ...TABLE_SCHEMAS,
};

const CURRENT_TABLE_SCHEMAS: Record<SaveTableName, string> = {
  ...TABLE_SCHEMAS,
  offlineRecaps: 'id, simulationSeed, characterId, eventId, timestamp, isRead, updatedAt',
};

class FigureBoxSaveDatabase extends Dexie {
  saveMeta!: Table<SaveMetaRecord, string>;
  worldProgress!: Table<WorldProgressRecord, string>;
  items!: Table<ItemSaveRecord, string>;
  settings!: Table<SettingsRecord, string>;
  shops!: Table<ShopSaveRecord, string>;
  relationships!: Table<RelationshipSaveRecord, string>;
  characters!: Table<CharacterProfileRecord, string>;
  characterRuntime!: Table<CharacterRuntimeSaveRecord, string>;
  characterAvatars!: Table<CharacterAvatarRecord, string>;
  customObjects!: Table<CustomObjectRecord, string>;
  customObjectImages!: Table<CustomObjectImageRecord, string>;
  offlineRecaps!: Table<OfflineRecapSaveRecord, string>;

  constructor() {
    super(SAVE_DATABASE_NAME);
    this.version(1).stores(LEGACY_V1_TABLE_SCHEMAS);
    this.version(2).stores(LEGACY_V2_TABLE_SCHEMAS);
    this.version(3).stores(LEGACY_V3_TABLE_SCHEMAS);
    this.version(4).stores(LEGACY_V4_TABLE_SCHEMAS);
    this.version(SAVE_DATABASE_VERSION).stores(CURRENT_TABLE_SCHEMAS);
  }
}

export const saveDb = new FigureBoxSaveDatabase();

export const SAVE_TABLES = Object.keys(CURRENT_TABLE_SCHEMAS) as SaveTableName[];

export function getSaveTableSchemaSummaries(): readonly SaveTableSchemaSummary[] {
  return SAVE_TABLES.map(tableName => {
    const [primaryKey, ...indexes] = CURRENT_TABLE_SCHEMAS[tableName]
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
  await Promise.all([
    Dexie.delete(SAVE_DATABASE_NAME),
    deleteMiniSpriteSheetCacheDatabase(),
  ]);
}
