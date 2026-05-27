import {
  Expression,
  Feeling,
  MemoryType,
  Mood,
  SocialStatus,
} from '~/constants/character';
import {
  createRelationshipStore,
  normalizeRelationshipPair,
} from '~/stateMachines/gameFlow/relationships';
import type {
  ItemInstance,
  ItemState,
  PlacedObject,
  ShopStockItem,
} from '~/typing/item';
import { createDefaultCharacterRuntimeSnapshot } from './characterRuntimeSaveService';
import {
  createDefaultItemSaveRecord,
  createDefaultItemSnapshot,
  createDefaultRelationshipSaveRecord,
  createDefaultSaveMeta,
  createDefaultSettingsRecord,
  createDefaultShopSaveRecord,
  createDefaultShopSnapshot,
  createDefaultWorldProgress,
} from './saveDefaults';
import {
  SAVE_SCHEMA_VERSION,
  type CharacterAvatarRecord,
  type CharacterProfileRecord,
  type CharacterRuntimeSaveRecord,
  type CharacterRuntimeSnapshot,
  type CustomObjectImageRecord,
  type CustomObjectRecord,
  type ItemSaveRecord,
  type OfflineRecapSaveRecord,
  type RelationshipSaveRecord,
  type SaveMetaRecord,
  type SettingsRecord,
  type ShopSaveRecord,
  type WorldProgressRecord,
} from './saveTypes';

const SOCIAL_STATUSES = new Set<string>(Object.values(SocialStatus));
const MOODS = new Set<string>(Object.values(Mood));
const EXPRESSIONS = new Set<string>(Object.values(Expression));
const FEELINGS = new Set<string>(Object.values(Feeling));

const ITEM_STATES = new Set<ItemState>([
  'stored',
  'held',
  'equipped',
  'placed',
  'shopStock',
  'transferring',
  'consumed',
]);

export function normalizeSaveMetaRecord(rawRecord: unknown): SaveMetaRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord)) {
    return createDefaultSaveMeta(timestamp);
  }

  return {
    id: 'current',
    schemaVersion: readFiniteNumber(rawRecord.schemaVersion, SAVE_SCHEMA_VERSION),
    createdAt: readFiniteNumber(rawRecord.createdAt, timestamp),
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
    lastBackupAt: rawRecord.lastBackupAt === null
      ? null
      : readOptionalFiniteNumber(rawRecord.lastBackupAt),
    lastActiveAt: rawRecord.lastActiveAt === null
      ? null
      : readOptionalFiniteNumber(rawRecord.lastActiveAt) ?? null,
    lastOfflineSimulationAt: rawRecord.lastOfflineSimulationAt === null
      ? null
      : readOptionalFiniteNumber(rawRecord.lastOfflineSimulationAt) ?? null,
  };
}

export function normalizeWorldProgressRecord(rawRecord: unknown): WorldProgressRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord)) {
    return createDefaultWorldProgress(timestamp);
  }

  return {
    id: 'current',
    day: readPositiveInteger(rawRecord.day, 1),
    timeOfDay: typeof rawRecord.timeOfDay === 'string' && rawRecord.timeOfDay.length > 0
      ? rawRecord.timeOfDay
      : 'morning',
    flags: readBooleanRecord(rawRecord.flags),
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
  };
}

export function normalizeItemSaveRecord(rawRecord: unknown): ItemSaveRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord) || !isRecord(rawRecord.snapshot)) {
    return createDefaultItemSaveRecord(timestamp);
  }

  return {
    id: 'current',
    snapshot: {
      itemInstances: readItemInstances(rawRecord.snapshot.itemInstances),
      placedObjects: readPlacedObjects(rawRecord.snapshot.placedObjects),
    },
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
  };
}

export function normalizeSettingsRecord(rawRecord: unknown): SettingsRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord)) {
    return createDefaultSettingsRecord(timestamp);
  }

  return {
    id: 'current',
    language: typeof rawRecord.language === 'string' && rawRecord.language.length > 0
      ? rawRecord.language
      : 'zh',
    isSaveDebugPanelOpen: typeof rawRecord.isSaveDebugPanelOpen === 'boolean'
      ? rawRecord.isSaveDebugPanelOpen
      : false,
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
  };
}

export function normalizeShopSaveRecord(rawRecord: unknown): ShopSaveRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord) || !isRecord(rawRecord.snapshot)) {
    return createDefaultShopSaveRecord(timestamp);
  }

  return {
    id: 'current',
    snapshot: {
      stockItems: readShopStockItems(rawRecord.snapshot.stockItems),
    },
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
  };
}

export function normalizeRelationshipSaveRecord(rawRecord: unknown): RelationshipSaveRecord {
  const timestamp = Date.now();

  if (!isRecord(rawRecord) || !isRecord(rawRecord.snapshot)) {
    return createDefaultRelationshipSaveRecord(timestamp);
  }

  return {
    id: 'current',
    snapshot: {
      mutualRelationships: readMutualRelationships(rawRecord.snapshot.mutualRelationships),
      relationshipRecords: readRelationshipRecords(rawRecord.snapshot.relationshipRecords),
    },
    updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
  };
}

export function normalizeCharacterRuntimeSaveRecords(
  rawRecords: readonly unknown[],
  options: { requireRuntimeShape?: boolean } = {},
): readonly CharacterRuntimeSaveRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (!isRecord(rawRecord) || typeof rawRecord.id !== 'string') {
      return [];
    }

    if (options.requireRuntimeShape && rawRecord.snapshot === undefined && rawRecord.seedId === undefined) {
      return [];
    }

    const defaultSnapshot = createDefaultCharacterRuntimeSnapshot(rawRecord.id);
    const snapshot = normalizeCharacterRuntimeSnapshot(rawRecord.snapshot, defaultSnapshot);

    return [{
      id: snapshot.id,
      seedId: snapshot.seedId,
      snapshot,
      updatedAt: readFiniteNumber(rawRecord.updatedAt, Date.now()),
    }];
  });
}

export function normalizeCharacterProfileRecords(
  rawRecords: readonly unknown[],
): readonly CharacterProfileRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (!isRecord(rawRecord) || typeof rawRecord.id !== 'string' || rawRecord.snapshot !== undefined) {
      return [];
    }

    const timestamp = Date.now();
    const source = readCharacterProfileSource(rawRecord.source);

    return [{
      id: rawRecord.id,
      source,
      ...(typeof rawRecord.templateId === 'string' ? { templateId: rawRecord.templateId } : {}),
      name: typeof rawRecord.name === 'string' && rawRecord.name.length > 0
        ? rawRecord.name
        : rawRecord.id,
      createdAt: readFiniteNumber(rawRecord.createdAt, timestamp),
      updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
      profile: isRecord(rawRecord.profile) ? rawRecord.profile : {},
    }];
  });
}

function readCharacterProfileSource(value: unknown): CharacterProfileRecord['source'] {
  return value === 'imported' || value === 'debug' ? value : 'playerCreated';
}

export function normalizeCharacterAvatarRecords(rawRecords: readonly unknown[]): readonly CharacterAvatarRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (
      !isRecord(rawRecord) ||
      typeof rawRecord.id !== 'string' ||
      typeof rawRecord.characterId !== 'string'
    ) {
      return [];
    }

    const normalizedRecord: CharacterAvatarRecord = {
      id: rawRecord.id,
      characterId: rawRecord.characterId,
      avatarSchemaVersion: readPositiveInteger(rawRecord.avatarSchemaVersion, 1),
      updatedAt: readFiniteNumber(rawRecord.updatedAt, Date.now()),
    };

    if (rawRecord.avatarState !== undefined) {
      normalizedRecord.avatarState = rawRecord.avatarState;
    }

    if (rawRecord.appearanceOverride !== undefined) {
      normalizedRecord.appearanceOverride = rawRecord.appearanceOverride;
    }

    return [normalizedRecord];
  });
}

export function normalizeCustomObjectRecords(rawRecords: readonly unknown[]): readonly CustomObjectRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (!isRecord(rawRecord) || typeof rawRecord.id !== 'string') {
      return [];
    }

    const timestamp = Date.now();
    const width = readPositiveInteger(rawRecord.width, 1);
    const height = readPositiveInteger(rawRecord.height, 1);

    return [{
      id: rawRecord.id,
      source: readCustomObjectSource(rawRecord.source),
      name: typeof rawRecord.name === 'string' && rawRecord.name.length > 0
        ? rawRecord.name
        : rawRecord.id,
      origin: readCustomObjectOrigin(rawRecord.origin),
      imageId: typeof rawRecord.imageId === 'string' && rawRecord.imageId.length > 0
        ? rawRecord.imageId
        : rawRecord.id,
      width,
      height,
      objectSchemaVersion: readPositiveInteger(rawRecord.objectSchemaVersion, 1),
      createdAt: readFiniteNumber(rawRecord.createdAt, timestamp),
      updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
      metadata: isRecord(rawRecord.metadata) ? rawRecord.metadata : {},
    }];
  });
}

export function normalizeCustomObjectImageRecords(rawRecords: readonly unknown[]): readonly CustomObjectImageRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (
      !isRecord(rawRecord) ||
      typeof rawRecord.id !== 'string' ||
      typeof rawRecord.objectId !== 'string' ||
      typeof rawRecord.dataUrl !== 'string'
    ) {
      return [];
    }

    return [{
      id: rawRecord.id,
      objectId: rawRecord.objectId,
      mimeType: typeof rawRecord.mimeType === 'string' && rawRecord.mimeType.length > 0
        ? rawRecord.mimeType
        : 'image/png',
      dataUrl: rawRecord.dataUrl,
      updatedAt: readFiniteNumber(rawRecord.updatedAt, Date.now()),
    }];
  });
}

export function normalizeOfflineRecapSaveRecords(rawRecords: readonly unknown[]): readonly OfflineRecapSaveRecord[] {
  return rawRecords.flatMap(rawRecord => {
    if (
      !isRecord(rawRecord) ||
      typeof rawRecord.id !== 'string' ||
      typeof rawRecord.simulationSeed !== 'string' ||
      typeof rawRecord.eventId !== 'string' ||
      typeof rawRecord.characterId !== 'string' ||
      typeof rawRecord.characterName !== 'string' ||
      typeof rawRecord.summary !== 'string'
    ) {
      return [];
    }

    const timestamp = Date.now();

    return [{
      id: rawRecord.id,
      simulationSeed: rawRecord.simulationSeed,
      eventId: rawRecord.eventId,
      characterId: rawRecord.characterId,
      characterName: rawRecord.characterName,
      participantIds: readStringArrayWithFallback(rawRecord.participantIds, [rawRecord.characterId]),
      participantNames: readStringArrayWithFallback(rawRecord.participantNames, [rawRecord.characterName]),
      timestamp: readFiniteNumber(rawRecord.timestamp, timestamp),
      displayIndex: readFiniteNumber(rawRecord.displayIndex, readDisplayIndexFromOfflineRecapId(rawRecord.id)),
      summary: rawRecord.summary,
      ...(typeof rawRecord.detail === 'string' ? { detail: rawRecord.detail } : {}),
      ...(typeof rawRecord.quote === 'string' ? { quote: rawRecord.quote } : {}),
      isRead: typeof rawRecord.isRead === 'boolean' ? rawRecord.isRead : false,
      createdAt: readFiniteNumber(rawRecord.createdAt, timestamp),
      updatedAt: readFiniteNumber(rawRecord.updatedAt, timestamp),
    }];
  });
}

function readDisplayIndexFromOfflineRecapId(id: string): number {
  const match = /-(\d+)$/.exec(id);

  return match ? Number(match[1]) : 0;
}

function readCustomObjectSource(value: unknown): CustomObjectRecord['source'] {
  return value === 'imported' || value === 'debug' ? value : 'playerCreated';
}

function readCustomObjectOrigin(value: unknown): CustomObjectRecord['origin'] {
  if (!isRecord(value)) {
    return {
      kind: 'blank',
      objectId: null,
    };
  }

  if (value.kind === 'staticObject' || value.kind === 'customObject') {
    return {
      kind: value.kind,
      objectId: typeof value.objectId === 'string' && value.objectId.length > 0
        ? value.objectId
        : null,
    };
  }

  return {
    kind: 'blank',
    objectId: null,
  };
}

function readItemInstances(value: unknown): readonly ItemInstance[] {
  if (!Array.isArray(value)) {
    return createDefaultItemSnapshot().itemInstances;
  }

  return value.flatMap(itemInstance => {
    if (!isRecord(itemInstance)) {
      return [];
    }

    if (
      typeof itemInstance.id !== 'string' ||
      typeof itemInstance.definitionId !== 'string' ||
      typeof itemInstance.quantity !== 'number' ||
      !Number.isInteger(itemInstance.quantity) ||
      itemInstance.quantity <= 0 ||
      typeof itemInstance.state !== 'string' ||
      !ITEM_STATES.has(itemInstance.state as ItemState)
    ) {
      return [];
    }

    return [{
      id: itemInstance.id,
      definitionId: itemInstance.definitionId,
      ...(typeof itemInstance.ownerActorId === 'string' ? { ownerActorId: itemInstance.ownerActorId } : {}),
      state: itemInstance.state as ItemState,
      quantity: itemInstance.quantity,
      ...(Array.isArray(itemInstance.transferHistory) ? { transferHistory: itemInstance.transferHistory as ItemInstance['transferHistory'] } : {}),
      ...(typeof itemInstance.customName === 'string' ? { customName: itemInstance.customName } : {}),
      ...(isRecord(itemInstance.metadata) ? { metadata: itemInstance.metadata } : {}),
    }];
  });
}

function readPlacedObjects(value: unknown): readonly PlacedObject[] {
  if (!Array.isArray(value)) {
    return createDefaultItemSnapshot().placedObjects ?? [];
  }

  return value.flatMap(placedObject => {
    if (!isRecord(placedObject)) {
      return [];
    }

    if (
      typeof placedObject.id !== 'string' ||
      typeof placedObject.itemInstanceId !== 'string' ||
      typeof placedObject.mapId !== 'string' ||
      typeof placedObject.surfaceType !== 'string'
    ) {
      return [];
    }

    const worldPosition = readPosition(placedObject.worldPosition);
    const localPosition = readPosition(placedObject.localPosition);

    return [{
      id: placedObject.id,
      itemInstanceId: placedObject.itemInstanceId,
      mapId: placedObject.mapId,
      ...(typeof placedObject.parentObjectId === 'string' ? { parentObjectId: placedObject.parentObjectId } : {}),
      surfaceType: placedObject.surfaceType,
      ...(worldPosition ? { worldPosition } : {}),
      ...(localPosition ? { localPosition } : {}),
      ...(typeof placedObject.layer === 'string' ? { layer: placedObject.layer } : {}),
    }];
  });
}

function readShopStockItems(value: unknown): readonly ShopStockItem[] {
  if (!Array.isArray(value)) {
    return createDefaultShopSnapshot().stockItems;
  }

  return value.flatMap(stockItem => {
    if (!isRecord(stockItem)) {
      return [];
    }

    if (
      typeof stockItem.id !== 'string' ||
      typeof stockItem.shopId !== 'string' ||
      typeof stockItem.definitionId !== 'string' ||
      typeof stockItem.stock !== 'number' ||
      !Number.isInteger(stockItem.stock) ||
      stockItem.stock < 0 ||
      typeof stockItem.generatedAtDay !== 'number' ||
      !Number.isInteger(stockItem.generatedAtDay) ||
      stockItem.generatedAtDay <= 0
    ) {
      return [];
    }

    return [{
      id: stockItem.id,
      shopId: stockItem.shopId,
      definitionId: stockItem.definitionId,
      ...(typeof stockItem.price === 'number' && Number.isFinite(stockItem.price) ? { price: stockItem.price } : {}),
      stock: stockItem.stock,
      generatedAtDay: stockItem.generatedAtDay,
    }];
  });
}

function readMutualRelationships(value: unknown): ReturnType<typeof createRelationshipStore>['mutualRelationships'] {
  if (!Array.isArray(value)) {
    return createRelationshipStore().mutualRelationships;
  }

  return value.flatMap(relationship => {
    if (!isRecord(relationship) || !Array.isArray(relationship.charIds)) {
      return [];
    }

    const [firstCharacterId, secondCharacterId] = relationship.charIds;
    const normalizedPair = typeof firstCharacterId === 'string' && typeof secondCharacterId === 'string'
      ? normalizeRelationshipPair(firstCharacterId, secondCharacterId)
      : null;

    if (
      !normalizedPair ||
      typeof relationship.status !== 'string' ||
      !SOCIAL_STATUSES.has(relationship.status) ||
      typeof relationship.timestamp !== 'number' ||
      !Number.isFinite(relationship.timestamp)
    ) {
      return [];
    }

    return [{
      charIds: normalizedPair,
      status: relationship.status as SocialStatus,
      timestamp: relationship.timestamp,
    }];
  });
}

function readRelationshipRecords(value: unknown): ReturnType<typeof createRelationshipStore>['relationshipRecords'] {
  if (!Array.isArray(value)) {
    return createRelationshipStore().relationshipRecords;
  }

  return value.flatMap(relationshipRecord => {
    if (!isRecord(relationshipRecord) || !Array.isArray(relationshipRecord.charIds)) {
      return [];
    }

    const [firstCharacterId, secondCharacterId] = relationshipRecord.charIds;
    const normalizedPair = typeof firstCharacterId === 'string' && typeof secondCharacterId === 'string'
      ? normalizeRelationshipPair(firstCharacterId, secondCharacterId)
      : null;

    if (!normalizedPair) {
      return [];
    }

    const records = readRelationshipStatusRecords(relationshipRecord.records);

    if (records.length === 0) {
      return [];
    }

    return [{
      charIds: normalizedPair,
      records,
    }];
  });
}

function readRelationshipStatusRecords(value: unknown): { status: SocialStatus; timestamp: number }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(record => {
    if (
      !isRecord(record) ||
      typeof record.status !== 'string' ||
      !SOCIAL_STATUSES.has(record.status) ||
      typeof record.timestamp !== 'number' ||
      !Number.isFinite(record.timestamp)
    ) {
      return [];
    }

    return [{
      status: record.status as SocialStatus,
      timestamp: record.timestamp,
    }];
  });
}

function normalizeCharacterRuntimeSnapshot(
  rawSnapshot: unknown,
  defaultSnapshot: CharacterRuntimeSnapshot,
): CharacterRuntimeSnapshot {
  if (!isRecord(rawSnapshot)) {
    return defaultSnapshot;
  }

  return {
    id: defaultSnapshot.id,
    seedId: typeof rawSnapshot.seedId === 'string' && rawSnapshot.seedId.length > 0
      ? rawSnapshot.seedId
      : defaultSnapshot.seedId,
    status: readCharacterStatus(rawSnapshot.status, defaultSnapshot.status),
    position: readPosition(rawSnapshot.position) ?? defaultSnapshot.position,
    presence: readCharacterPresence(rawSnapshot.presence, defaultSnapshot.presence),
    heldItem: readCharacterHeldItem(rawSnapshot.heldItem),
    activityCooldowns: readActivityCooldowns(rawSnapshot.activityCooldowns, defaultSnapshot.activityCooldowns),
    locks: readCharacterLocks(rawSnapshot.locks, defaultSnapshot.locks),
    relationships: readDirectedRelationships(rawSnapshot.relationships),
  };
}

function readCharacterStatus(
  value: unknown,
  fallback: CharacterRuntimeSnapshot['status'],
): CharacterRuntimeSnapshot['status'] {
  if (!isRecord(value)) {
    return fallback;
  }

  if (
    typeof value.mood !== 'string' ||
    !MOODS.has(value.mood) ||
    typeof value.expression !== 'string' ||
    !EXPRESSIONS.has(value.expression) ||
    typeof value.saturation !== 'number' ||
    !Number.isFinite(value.saturation) ||
    typeof value.moodValue !== 'number' ||
    !Number.isFinite(value.moodValue) ||
    typeof value.playNeed !== 'number' ||
    !Number.isFinite(value.playNeed) ||
    typeof value.hungerThreshold !== 'number' ||
    !Number.isFinite(value.hungerThreshold)
  ) {
    return fallback;
  }

  return {
    mood: value.mood as Mood,
    expression: value.expression as Expression,
    saturation: value.saturation,
    moodValue: value.moodValue,
    playNeed: value.playNeed,
    hungerThreshold: value.hungerThreshold,
  };
}

function readCharacterPresence(
  value: unknown,
  fallback: CharacterRuntimeSnapshot['presence'],
): CharacterRuntimeSnapshot['presence'] {
  if (!isRecord(value) || typeof value.kind !== 'string' || typeof value.spaceId !== 'string') {
    return fallback;
  }

  if (value.kind === 'contained') {
    return {
      kind: 'contained',
      spaceId: value.spaceId,
    };
  }

  if (value.kind === 'positioned') {
    const position = readPosition(value.position);

    if (!position) {
      return fallback;
    }

    return {
      kind: 'positioned',
      spaceId: value.spaceId,
      position,
    };
  }

  return fallback;
}

function readCharacterHeldItem(value: unknown): CharacterRuntimeSnapshot['heldItem'] {
  if (!isRecord(value)) {
    return null;
  }

  if (typeof value.itemInstanceId !== 'string' || typeof value.definitionId !== 'string') {
    return null;
  }

  return {
    itemInstanceId: value.itemInstanceId,
    definitionId: value.definitionId,
  };
}

function readActivityCooldowns(
  value: unknown,
  fallback: CharacterRuntimeSnapshot['activityCooldowns'],
): CharacterRuntimeSnapshot['activityCooldowns'] {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    categoryUntilByKey: readNumberRecord(value.categoryUntilByKey),
    pairUntilByKey: readNumberRecord(value.pairUntilByKey),
    repeatByKey: readActivityRepeatRecords(value.repeatByKey),
  };
}

function readCharacterLocks(
  value: unknown,
  fallback: CharacterRuntimeSnapshot['locks'],
): CharacterRuntimeSnapshot['locks'] {
  if (!isRecord(value)) {
    return fallback;
  }

  return {
    bodyAction: readStringArray(value.bodyAction),
    bodyMove: readStringArray(value.bodyMove),
    mind: readStringArray(value.mind),
    communication: readStringArray(value.communication),
  };
}

function readDirectedRelationships(value: unknown): CharacterRuntimeSnapshot['relationships'] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(relationship => {
    if (
      !isRecord(relationship) ||
      typeof relationship.charId !== 'string' ||
      typeof relationship.targetCharId !== 'string' ||
      typeof relationship.feeling !== 'string' ||
      !FEELINGS.has(relationship.feeling) ||
      typeof relationship.intimacy !== 'number' ||
      !Number.isFinite(relationship.intimacy)
    ) {
      return [];
    }

    return [{
      charId: relationship.charId,
      targetCharId: relationship.targetCharId,
      feeling: relationship.feeling as Feeling,
      intimacy: relationship.intimacy,
      memories: readMemoryValueMap(relationship.memories),
    }];
  });
}

function readMemoryValueMap(value: unknown): CharacterRuntimeSnapshot['relationships'][number]['memories'] {
  const memoryRecord = isRecord(value) ? value : {};

  return {
    [MemoryType.Impression]: readMemory(memoryRecord[MemoryType.Impression]),
    [MemoryType.Argument]: readMemoryData(memoryRecord[MemoryType.Argument]),
    [MemoryType.Fight]: readMemoryData(memoryRecord[MemoryType.Fight]),
  };
}

function readMemory(value: unknown): { counts: number; lastUpdate: number } {
  if (
    !isRecord(value) ||
    typeof value.counts !== 'number' ||
    !Number.isFinite(value.counts) ||
    typeof value.lastUpdate !== 'number' ||
    !Number.isFinite(value.lastUpdate)
  ) {
    return {
      counts: 0,
      lastUpdate: 0,
    };
  }

  return {
    counts: value.counts,
    lastUpdate: value.lastUpdate,
  };
}

function readMemoryData(value: unknown): { counts: number; lastUpdate: number; startedById: string } {
  const memory = readMemory(value);

  return {
    ...memory,
    startedById: isRecord(value) && typeof value.startedById === 'string'
      ? value.startedById
      : '',
  };
}

function readNumberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, number] => (
      typeof entry[1] === 'number' && Number.isFinite(entry[1])
    )),
  );
}

function readActivityRepeatRecords(value: unknown): CharacterRuntimeSnapshot['activityCooldowns']['repeatByKey'] {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, record]) => {
      if (
        !isRecord(record) ||
        typeof record.count !== 'number' ||
        !Number.isFinite(record.count) ||
        typeof record.lastAt !== 'number' ||
        !Number.isFinite(record.lastAt)
      ) {
        return [];
      }

      return [[key, {
        count: record.count,
        lastAt: record.lastAt,
      }]];
    }),
  );
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function readStringArrayWithFallback(value: unknown, fallback: readonly string[]): string[] {
  const strings = readStringArray(value);

  return strings.length > 0 ? strings : [...fallback];
}

function readPosition(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') {
    return null;
  }

  if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
    return null;
  }

  return {
    x: value.x,
    y: value.y,
  };
}

function readBooleanRecord(value: unknown): Record<string, boolean> {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, boolean] => typeof entry[1] === 'boolean'),
  );
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readOptionalFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
