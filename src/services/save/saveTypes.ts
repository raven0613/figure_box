import type { ItemStoreSnapshot } from '~/services/items/itemStore';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type { RelationshipStore } from '~/stateMachines/gameFlow/relationships';
import type { ShopStockItem } from '~/typing/item';

export const SAVE_DATABASE_NAME = 'figureBoxSaveDb';
export const SAVE_DATABASE_VERSION = 4;
export const SAVE_SCHEMA_VERSION = 1;

export type SaveTableName =
  | 'saveMeta'
  | 'worldProgress'
  | 'items'
  | 'settings'
  | 'shops'
  | 'relationships'
  | 'characters'
  | 'characterRuntime'
  | 'characterAvatars'
  | 'customObjects'
  | 'customObjectImages';

export interface SaveMetaRecord {
  id: 'current';
  schemaVersion: number;
  createdAt: number;
  updatedAt: number;
  lastBackupAt: number | null;
}

export interface WorldProgressRecord {
  id: 'current';
  day: number;
  timeOfDay: string;
  flags: Record<string, boolean>;
  updatedAt: number;
}

export interface SettingsRecord {
  id: 'current';
  language: string;
  isSaveDebugPanelOpen: boolean;
  updatedAt: number;
}

export interface ItemSaveRecord {
  id: 'current';
  snapshot: ItemStoreSnapshot;
  updatedAt: number;
}

export interface ShopStoreSnapshot {
  stockItems: readonly ShopStockItem[];
}

export interface ShopSaveRecord {
  id: 'current';
  snapshot: ShopStoreSnapshot;
  updatedAt: number;
}

export interface RelationshipSaveRecord {
  id: 'current';
  snapshot: RelationshipStore;
  updatedAt: number;
}

export interface CharacterRuntimeSnapshot {
  id: string;
  seedId: string;
  status: CharacterContext['status'];
  position: CharacterContext['position'];
  presence: CharacterContext['presence'];
  heldItem: CharacterContext['heldItem'];
  activityCooldowns: CharacterContext['activityCooldowns'];
  locks: CharacterContext['locks'];
  relationships: CharacterContext['relationships'];
}

export interface CharacterRuntimeSaveRecord {
  id: string;
  seedId: string;
  snapshot: CharacterRuntimeSnapshot;
  updatedAt: number;
}

export interface CharacterProfileRecord {
  id: string;
  source: 'playerCreated' | 'imported' | 'debug';
  templateId?: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  profile: Record<string, unknown>;
}

export interface CharacterAvatarRecord {
  id: string;
  characterId: string;
  avatarSchemaVersion: number;
  avatarState?: unknown;
  appearanceOverride?: unknown;
  updatedAt: number;
}

export interface CustomObjectRecord {
  id: string;
  source: 'playerCreated' | 'imported' | 'debug';
  name: string;
  origin: {
    kind: 'blank' | 'staticObject' | 'customObject';
    objectId: string | null;
  };
  imageId: string;
  width: number;
  height: number;
  objectSchemaVersion: number;
  createdAt: number;
  updatedAt: number;
  metadata: Record<string, unknown>;
}

export interface CustomObjectImageRecord {
  id: string;
  objectId: string;
  mimeType: string;
  dataUrl: string;
  updatedAt: number;
}

export type SaveDomain =
  | 'items'
  | 'shops'
  | 'settings'
  | 'worldProgress'
  | 'relationships'
  | 'characters'
  | 'characterRuntime'
  | 'characterAvatars'
  | 'customObjects'
  | 'customObjectImages';

export interface SaveTableSchemaSummary {
  name: SaveTableName;
  primaryKey: string;
  indexes: readonly string[];
}

export interface SaveTableDebugSnapshot {
  table: SaveTableName;
  count: number;
  rows: readonly unknown[];
  detectedFields: readonly string[];
}

export interface BrowserStorageStatus {
  usage: number | null;
  quota: number | null;
  isPersisted: boolean | null;
  isPersistenceSupported: boolean;
}
