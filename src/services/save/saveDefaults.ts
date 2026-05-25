import { createRelationshipStore } from '~/stateMachines/gameFlow/relationships';
import type { ItemStoreSnapshot } from '~/services/items/itemStore';
import {
  SAVE_SCHEMA_VERSION,
  type ItemSaveRecord,
  type RelationshipSaveRecord,
  type SaveMetaRecord,
  type SettingsRecord,
  type ShopSaveRecord,
  type ShopStoreSnapshot,
  type WorldProgressRecord,
} from './saveTypes';

const INITIAL_WORLD_DAY = 1;

export function createDefaultSaveMeta(timestamp = Date.now()): SaveMetaRecord {
  return {
    id: 'current',
    schemaVersion: SAVE_SCHEMA_VERSION,
    createdAt: timestamp,
    updatedAt: timestamp,
    lastBackupAt: null,
    lastActiveAt: timestamp,
    lastOfflineSimulationAt: null,
  };
}

export function createDefaultWorldProgress(timestamp = Date.now()): WorldProgressRecord {
  return {
    id: 'current',
    day: INITIAL_WORLD_DAY,
    timeOfDay: 'morning',
    flags: {},
    updatedAt: timestamp,
  };
}

export function createDefaultItemSnapshot(): ItemStoreSnapshot {
  return {
    itemInstances: [],
    placedObjects: [],
  };
}

export function createDefaultItemSaveRecord(timestamp = Date.now()): ItemSaveRecord {
  return {
    id: 'current',
    snapshot: createDefaultItemSnapshot(),
    updatedAt: timestamp,
  };
}

export function createDefaultSettingsRecord(timestamp = Date.now()): SettingsRecord {
  return {
    id: 'current',
    language: 'zh',
    isSaveDebugPanelOpen: false,
    updatedAt: timestamp,
  };
}

export function createDefaultShopSnapshot(): ShopStoreSnapshot {
  return {
    stockItems: [],
  };
}

export function createDefaultShopSaveRecord(timestamp = Date.now()): ShopSaveRecord {
  return {
    id: 'current',
    snapshot: createDefaultShopSnapshot(),
    updatedAt: timestamp,
  };
}

export function createDefaultRelationshipSaveRecord(timestamp = Date.now()): RelationshipSaveRecord {
  return {
    id: 'current',
    snapshot: createRelationshipStore(),
    updatedAt: timestamp,
  };
}
