import { exportDB, importInto, peakImportFile } from 'dexie-export-import';
import type { Table } from 'dexie';

import { saveDb, SAVE_TABLES } from './saveDb';
import {
  normalizeCharacterAvatarRecords,
  normalizeCharacterProfileRecords,
  normalizeCustomObjectImageRecords,
  normalizeCustomObjectRecords,
} from './saveNormalizer';
import {
  SAVE_DATABASE_NAME,
  SAVE_DATABASE_VERSION,
  SAVE_SCHEMA_VERSION,
  type CharacterAvatarRecord,
  type CharacterProfileRecord,
  type CustomObjectImageRecord,
  type CustomObjectRecord,
  type SaveTableName,
} from './saveTypes';

const SAVE_PACKAGE_PREFIX = 'FIGURE_BOX_SAVE_V1:';
const SAVE_PACKAGE_FORMAT = 'figureBoxSavePackage';
const SAVE_PACKAGE_FORMAT_VERSION = 1;
const FULL_SAVE_PACKAGE_TYPE = 'fullSave';
const CONTENT_PACK_PACKAGE_TYPE = 'contentPack';
const CONTENT_PACK_KIND = 'content';
const CHARACTER_CONTENT_PACK_KIND = 'characters';
const CUSTOM_OBJECT_CONTENT_PACK_KIND = 'customObjects';
const PAYLOAD_ENCODING = 'base64';
const DEXIE_JSON_MIME_TYPE = 'application/json';
const BASE64_CHUNK_SIZE = 0x8000;

type SaveTransferPackageType = typeof FULL_SAVE_PACKAGE_TYPE | typeof CONTENT_PACK_PACKAGE_TYPE;
export type ContentPackConflictResolution = 'overwrite' | 'newId';

export interface FullSavePackageSummary {
  packageType: typeof FULL_SAVE_PACKAGE_TYPE;
  exportedAt: number;
  includedTables: readonly SaveTableName[];
  databaseName: string;
  databaseVersion: number;
  rowCount: number;
}

export interface ContentPackPackageSummary {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  includedTables: readonly SaveTableName[];
  characterCount: number;
  avatarCount: number;
}

export interface ObjectContentPackPackageSummary {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  includedTables: readonly SaveTableName[];
  objectCount: number;
  imageCount: number;
}

export interface CombinedContentPackPackageSummary {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  includedTables: readonly SaveTableName[];
  characterCount: number;
  avatarCount: number;
  objectCount: number;
  imageCount: number;
}

export interface CharacterContentPackPreviewCharacter {
  id: string;
  name: string;
  source: CharacterProfileRecord['source'];
  hasAvatar: boolean;
  hasConflict: boolean;
}

export interface CustomObjectContentPackPreviewObject {
  id: string;
  name: string;
  source: CustomObjectRecord['source'];
  originKind: CustomObjectRecord['origin']['kind'];
  hasImage: boolean;
  hasConflict: boolean;
}

export interface CharacterContentPackPreview {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  characters: readonly CharacterContentPackPreviewCharacter[];
}

export interface CustomObjectContentPackPreview {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  objects: readonly CustomObjectContentPackPreviewObject[];
}

export interface CombinedContentPackPreview {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  characters: readonly CharacterContentPackPreviewCharacter[];
  objects: readonly CustomObjectContentPackPreviewObject[];
}

export interface ImportCharacterContentPackOptions {
  characterIds?: readonly string[];
  conflictResolutions?: Record<string, ContentPackConflictResolution>;
}

export interface ExportCharacterContentPackOptions {
  characterIds?: readonly string[];
}

export interface ImportObjectContentPackOptions {
  objectIds?: readonly string[];
  conflictResolutions?: Record<string, ContentPackConflictResolution>;
}

export interface ExportObjectContentPackOptions {
  objectIds?: readonly string[];
}

export interface ImportContentPackOptions {
  characterIds?: readonly string[];
  objectIds?: readonly string[];
  characterConflictResolutions?: Record<string, ContentPackConflictResolution>;
  objectConflictResolutions?: Record<string, ContentPackConflictResolution>;
}

export interface ExportContentPackOptions {
  characterIds?: readonly string[];
  objectIds?: readonly string[];
}

interface SaveTransferPackageEnvelope {
  format: typeof SAVE_PACKAGE_FORMAT;
  formatVersion: typeof SAVE_PACKAGE_FORMAT_VERSION;
  packageType: SaveTransferPackageType;
  appSchemaVersion: number;
  databaseName: string;
  databaseVersion: number;
  exportedAt: number;
  includedTables: readonly SaveTableName[];
  payloadEncoding: typeof PAYLOAD_ENCODING;
  payloadMimeType: string;
  payload: string;
}

interface CombinedContentPackPayload {
  kind: typeof CONTENT_PACK_KIND | typeof CHARACTER_CONTENT_PACK_KIND | typeof CUSTOM_OBJECT_CONTENT_PACK_KIND;
  schemaVersion: number;
  characters: readonly CharacterProfileRecord[];
  characterAvatars: readonly CharacterAvatarRecord[];
  customObjects: readonly CustomObjectRecord[];
  customObjectImages: readonly CustomObjectImageRecord[];
}

export async function exportFullSavePackageString(): Promise<string> {
  const databaseBlob = await exportDB(saveDb);
  const databaseMeta = await peakImportFile(databaseBlob);
  const includedTables = databaseMeta.data.tables
    .map(table => table.name)
    .filter(isSaveTableName);
  const envelope: SaveTransferPackageEnvelope = {
    format: SAVE_PACKAGE_FORMAT,
    formatVersion: SAVE_PACKAGE_FORMAT_VERSION,
    packageType: FULL_SAVE_PACKAGE_TYPE,
    appSchemaVersion: SAVE_SCHEMA_VERSION,
    databaseName: SAVE_DATABASE_NAME,
    databaseVersion: SAVE_DATABASE_VERSION,
    exportedAt: Date.now(),
    includedTables,
    payloadEncoding: PAYLOAD_ENCODING,
    payloadMimeType: databaseBlob.type || DEXIE_JSON_MIME_TYPE,
    payload: bytesToBase64(new Uint8Array(await databaseBlob.arrayBuffer())),
  };

  return serializeSavePackageEnvelope(envelope);
}

export async function importFullSavePackageString(packageString: string): Promise<FullSavePackageSummary> {
  const envelope = parseSavePackageEnvelope(packageString);

  if (envelope.packageType !== FULL_SAVE_PACKAGE_TYPE) {
    throw new Error('這不是完整存檔匯出包。');
  }

  const payloadBlob = new Blob([toArrayBuffer(base64ToBytes(envelope.payload))], {
    type: envelope.payloadMimeType || DEXIE_JSON_MIME_TYPE,
  });
  const databaseMeta = await peakImportFile(payloadBlob);

  if (databaseMeta.data.databaseName !== SAVE_DATABASE_NAME) {
    throw new Error('匯入包不是這個遊戲的存檔資料。');
  }

  const includedTables = databaseMeta.data.tables
    .map(table => table.name)
    .filter(isSaveTableName);

  if (includedTables.length === 0) {
    throw new Error('匯入包沒有可用的存檔資料表。');
  }

  await importInto(saveDb, payloadBlob, {
    acceptVersionDiff: true,
    clearTablesBeforeImport: true,
    overwriteValues: true,
  });

  return {
    packageType: FULL_SAVE_PACKAGE_TYPE,
    exportedAt: envelope.exportedAt,
    includedTables,
    databaseName: databaseMeta.data.databaseName,
    databaseVersion: databaseMeta.data.databaseVersion,
    rowCount: databaseMeta.data.tables.reduce((totalRows, table) => totalRows + table.rowCount, 0),
  };
}

export async function exportCharacterContentPackString(
  options: ExportCharacterContentPackOptions = {},
): Promise<string> {
  return exportContentPackString({
    characterIds: options.characterIds,
    objectIds: [],
  });
}

export async function previewExportableCharacterContentPack(): Promise<CharacterContentPackPreview> {
  const preview = await previewExportableContentPack();

  if (preview.characters.length === 0) {
    throw new Error('目前沒有可匯出的角色。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: preview.exportedAt,
    characters: preview.characters,
  };
}

export async function importCharacterContentPackString(
  packageString: string,
  options: ImportCharacterContentPackOptions = {},
): Promise<ContentPackPackageSummary> {
  const summary = await importContentPackString(packageString, {
    characterIds: options.characterIds,
    objectIds: [],
    characterConflictResolutions: options.conflictResolutions,
  });

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: summary.exportedAt,
    includedTables: ['characters', 'characterAvatars'],
    characterCount: summary.characterCount,
    avatarCount: summary.avatarCount,
  };
}

export async function previewCharacterContentPackString(packageString: string): Promise<CharacterContentPackPreview> {
  const preview = await previewContentPackString(packageString);
  const { characters } = preview;

  if (characters.length === 0) {
    throw new Error('角色內容包沒有可匯入的角色。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: preview.exportedAt,
    characters,
  };
}

export async function exportObjectContentPackString(
  options: ExportObjectContentPackOptions = {},
): Promise<string> {
  return exportContentPackString({
    characterIds: [],
    objectIds: options.objectIds,
  });
}

export async function previewExportableObjectContentPack(): Promise<CustomObjectContentPackPreview> {
  const preview = await previewExportableContentPack();

  if (preview.objects.length === 0) {
    throw new Error('目前沒有可匯出的物件。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: preview.exportedAt,
    objects: preview.objects,
  };
}

export async function importObjectContentPackString(
  packageString: string,
  options: ImportObjectContentPackOptions = {},
): Promise<ObjectContentPackPackageSummary> {
  const summary = await importContentPackString(packageString, {
    characterIds: [],
    objectIds: options.objectIds,
    objectConflictResolutions: options.conflictResolutions,
  });

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: summary.exportedAt,
    includedTables: ['customObjects', 'customObjectImages'],
    objectCount: summary.objectCount,
    imageCount: summary.imageCount,
  };
}

export async function previewObjectContentPackString(packageString: string): Promise<CustomObjectContentPackPreview> {
  const preview = await previewContentPackString(packageString);
  const { objects } = preview;

  if (objects.length === 0) {
    throw new Error('物件內容包沒有可匯入的物件。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: preview.exportedAt,
    objects,
  };
}

export async function exportContentPackString(
  options: ExportContentPackOptions = {},
): Promise<string> {
  const selectedCharacterIds = options.characterIds ? new Set(options.characterIds) : null;
  const selectedObjectIds = options.objectIds ? new Set(options.objectIds) : null;
  const [characters, allCharacterAvatars, customObjects, allCustomObjectImages] = await Promise.all([
    saveDb.characters.toArray(),
    saveDb.characterAvatars.toArray(),
    saveDb.customObjects.toArray(),
    saveDb.customObjectImages.toArray(),
  ]);
  const selectedCharacters = characters
    .filter(character => selectedCharacterIds === null || selectedCharacterIds.has(character.id));
  const selectedObjects = customObjects
    .filter(customObject => selectedObjectIds === null || selectedObjectIds.has(customObject.id));

  if (selectedCharacters.length === 0 && selectedObjects.length === 0) {
    throw new Error('目前沒有可匯出的角色或物件。');
  }

  const characterIds = new Set(selectedCharacters.map(character => character.id));
  const objectIds = new Set(selectedObjects.map(customObject => customObject.id));
  const characterAvatars = allCharacterAvatars.filter(avatar => characterIds.has(avatar.characterId));
  const customObjectImages = allCustomObjectImages.filter(image => objectIds.has(image.objectId));
  const payload: CombinedContentPackPayload = {
    kind: CONTENT_PACK_KIND,
    schemaVersion: SAVE_SCHEMA_VERSION,
    characters: selectedCharacters,
    characterAvatars,
    customObjects: selectedObjects,
    customObjectImages,
  };
  const payloadBytes = new TextEncoder().encode(JSON.stringify(payload));
  const envelope: SaveTransferPackageEnvelope = {
    format: SAVE_PACKAGE_FORMAT,
    formatVersion: SAVE_PACKAGE_FORMAT_VERSION,
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    appSchemaVersion: SAVE_SCHEMA_VERSION,
    databaseName: SAVE_DATABASE_NAME,
    databaseVersion: SAVE_DATABASE_VERSION,
    exportedAt: Date.now(),
    includedTables: getIncludedContentTables(selectedCharacters.length, selectedObjects.length),
    payloadEncoding: PAYLOAD_ENCODING,
    payloadMimeType: DEXIE_JSON_MIME_TYPE,
    payload: bytesToBase64(payloadBytes),
  };

  return serializeSavePackageEnvelope(envelope);
}

export async function previewExportableContentPack(): Promise<CombinedContentPackPreview> {
  const [characters, allCharacterAvatars, customObjects, allCustomObjectImages] = await Promise.all([
    saveDb.characters.toArray(),
    saveDb.characterAvatars.toArray(),
    saveDb.customObjects.toArray(),
    saveDb.customObjectImages.toArray(),
  ]);

  if (characters.length === 0 && customObjects.length === 0) {
    throw new Error('目前沒有可匯出的角色或物件。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: Date.now(),
    characters: createCharacterContentPreview(characters, allCharacterAvatars, new Set()),
    objects: createObjectContentPreview(customObjects, allCustomObjectImages, new Set()),
  };
}

export async function previewContentPackString(packageString: string): Promise<CombinedContentPackPreview> {
  const envelope = parseSavePackageEnvelope(packageString);

  if (envelope.packageType !== CONTENT_PACK_PACKAGE_TYPE) {
    throw new Error('這不是內容包。');
  }

  const payload = parseContentPackPayload(envelope.payload);
  const [existingCharacterIds, existingObjectIds] = await Promise.all([
    getExistingIds(saveDb.characters, payload.characters.map(character => character.id)),
    getExistingIds(saveDb.customObjects, payload.customObjects.map(customObject => customObject.id)),
  ]);
  const characters = createCharacterContentPreview(
    payload.characters,
    payload.characterAvatars,
    existingCharacterIds,
  );
  const objects = createObjectContentPreview(
    payload.customObjects,
    payload.customObjectImages,
    existingObjectIds,
  );

  if (characters.length === 0 && objects.length === 0) {
    throw new Error('內容包沒有可匯入的角色或物件。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: envelope.exportedAt,
    characters,
    objects,
  };
}

export async function importContentPackString(
  packageString: string,
  options: ImportContentPackOptions = {},
): Promise<CombinedContentPackPackageSummary> {
  const envelope = parseSavePackageEnvelope(packageString);

  if (envelope.packageType !== CONTENT_PACK_PACKAGE_TYPE) {
    throw new Error('這不是內容包。');
  }

  const payload = parseContentPackPayload(envelope.payload);
  const selectedCharacterIds = options.characterIds ? new Set(options.characterIds) : null;
  const selectedObjectIds = options.objectIds ? new Set(options.objectIds) : null;
  const selectedCharacterRecords = payload.characters
    .filter(character => selectedCharacterIds === null || selectedCharacterIds.has(character.id));
  const selectedCharacterIdsForAvatars = new Set(selectedCharacterRecords.map(character => character.id));
  const selectedAvatarRecords = payload.characterAvatars
    .filter(avatar => selectedCharacterIdsForAvatars.has(avatar.characterId));
  const selectedObjectRecords = payload.customObjects
    .filter(customObject => selectedObjectIds === null || selectedObjectIds.has(customObject.id));
  const selectedObjectIdsForImages = new Set(selectedObjectRecords.map(customObject => customObject.id));
  const selectedImageRecords = payload.customObjectImages
    .filter(image => selectedObjectIdsForImages.has(image.objectId));
  const [{ characterRecords, avatarRecords }, { objectRecords, imageRecords }] = await Promise.all([
    resolveCharacterImportRecords(
      selectedCharacterRecords,
      selectedAvatarRecords,
      options.characterConflictResolutions ?? {},
    ),
    resolveObjectImportRecords(
      selectedObjectRecords,
      selectedImageRecords,
      options.objectConflictResolutions ?? {},
    ),
  ]);

  if (characterRecords.length === 0 && objectRecords.length === 0) {
    throw new Error('內容包沒有勾選任何可匯入的角色或物件。');
  }

  await saveDb.transaction('rw', [
    saveDb.characters,
    saveDb.characterAvatars,
    saveDb.customObjects,
    saveDb.customObjectImages,
  ], async () => {
    if (characterRecords.length > 0) {
      await saveDb.characters.bulkPut(characterRecords);
    }

    if (avatarRecords.length > 0) {
      await saveDb.characterAvatars.bulkPut(avatarRecords);
    }

    if (objectRecords.length > 0) {
      await saveDb.customObjects.bulkPut(objectRecords);
    }

    if (imageRecords.length > 0) {
      await saveDb.customObjectImages.bulkPut(imageRecords);
    }
  });

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: envelope.exportedAt,
    includedTables: getIncludedContentTables(characterRecords.length, objectRecords.length),
    characterCount: characterRecords.length,
    avatarCount: avatarRecords.length,
    objectCount: objectRecords.length,
    imageCount: imageRecords.length,
  };
}

function serializeSavePackageEnvelope(envelope: SaveTransferPackageEnvelope): string {
  const envelopeBytes = new TextEncoder().encode(JSON.stringify(envelope));

  return `${SAVE_PACKAGE_PREFIX}${bytesToBase64(envelopeBytes)}`;
}

function parseSavePackageEnvelope(packageString: string): SaveTransferPackageEnvelope {
  const trimmedPackageString = packageString.trim();
  const encodedEnvelope = trimmedPackageString.startsWith(SAVE_PACKAGE_PREFIX)
    ? trimmedPackageString.slice(SAVE_PACKAGE_PREFIX.length)
    : trimmedPackageString;
  let parsedEnvelope: unknown;

  try {
    parsedEnvelope = JSON.parse(new TextDecoder().decode(base64ToBytes(encodedEnvelope)));
  } catch {
    throw new Error('存檔字串格式錯誤，無法匯入。');
  }

  if (!isRecord(parsedEnvelope)) {
    throw new Error('存檔字串內容不是有效的匯出包。');
  }

  if (
    parsedEnvelope.format !== SAVE_PACKAGE_FORMAT ||
    parsedEnvelope.formatVersion !== SAVE_PACKAGE_FORMAT_VERSION ||
    !isSupportedPackageType(parsedEnvelope.packageType) ||
    parsedEnvelope.payloadEncoding !== PAYLOAD_ENCODING ||
    typeof parsedEnvelope.payload !== 'string' ||
    typeof parsedEnvelope.exportedAt !== 'number'
  ) {
    throw new Error('存檔字串版本或內容不支援。');
  }

  return {
    format: SAVE_PACKAGE_FORMAT,
    formatVersion: SAVE_PACKAGE_FORMAT_VERSION,
    packageType: parsedEnvelope.packageType,
    appSchemaVersion: readFiniteNumber(parsedEnvelope.appSchemaVersion, SAVE_SCHEMA_VERSION),
    databaseName: typeof parsedEnvelope.databaseName === 'string'
      ? parsedEnvelope.databaseName
      : SAVE_DATABASE_NAME,
    databaseVersion: readFiniteNumber(parsedEnvelope.databaseVersion, SAVE_DATABASE_VERSION),
    exportedAt: parsedEnvelope.exportedAt,
    includedTables: Array.isArray(parsedEnvelope.includedTables)
      ? parsedEnvelope.includedTables.filter(isSaveTableName)
      : [],
    payloadEncoding: PAYLOAD_ENCODING,
    payloadMimeType: typeof parsedEnvelope.payloadMimeType === 'string'
      ? parsedEnvelope.payloadMimeType
      : DEXIE_JSON_MIME_TYPE,
    payload: parsedEnvelope.payload,
  };
}

function parseContentPackPayload(encodedPayload: string): CombinedContentPackPayload {
  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(new TextDecoder().decode(base64ToBytes(encodedPayload)));
  } catch {
    throw new Error('內容包格式錯誤，無法匯入。');
  }

  if (!isRecord(parsedPayload)) {
    throw new Error('內容包內容不支援。');
  }

  if (
    parsedPayload.kind === CONTENT_PACK_KIND &&
    Array.isArray(parsedPayload.characters) &&
    Array.isArray(parsedPayload.characterAvatars) &&
    Array.isArray(parsedPayload.customObjects) &&
    Array.isArray(parsedPayload.customObjectImages)
  ) {
    return {
      kind: CONTENT_PACK_KIND,
      schemaVersion: readFiniteNumber(parsedPayload.schemaVersion, SAVE_SCHEMA_VERSION),
      characters: normalizeCharacterProfileRecords(parsedPayload.characters),
      characterAvatars: normalizeCharacterAvatarRecords(parsedPayload.characterAvatars),
      customObjects: normalizeCustomObjectRecords(parsedPayload.customObjects),
      customObjectImages: normalizeCustomObjectImageRecords(parsedPayload.customObjectImages),
    };
  }

  if (
    parsedPayload.kind === CHARACTER_CONTENT_PACK_KIND &&
    Array.isArray(parsedPayload.characters) &&
    Array.isArray(parsedPayload.characterAvatars)
  ) {
    return {
      kind: CHARACTER_CONTENT_PACK_KIND,
      schemaVersion: readFiniteNumber(parsedPayload.schemaVersion, SAVE_SCHEMA_VERSION),
      characters: normalizeCharacterProfileRecords(parsedPayload.characters),
      characterAvatars: normalizeCharacterAvatarRecords(parsedPayload.characterAvatars),
      customObjects: [],
      customObjectImages: [],
    };
  }

  if (
    parsedPayload.kind === CUSTOM_OBJECT_CONTENT_PACK_KIND &&
    Array.isArray(parsedPayload.customObjects) &&
    Array.isArray(parsedPayload.customObjectImages)
  ) {
    return {
      kind: CUSTOM_OBJECT_CONTENT_PACK_KIND,
      schemaVersion: readFiniteNumber(parsedPayload.schemaVersion, SAVE_SCHEMA_VERSION),
      characters: [],
      characterAvatars: [],
      customObjects: normalizeCustomObjectRecords(parsedPayload.customObjects),
      customObjectImages: normalizeCustomObjectImageRecords(parsedPayload.customObjectImages),
    };
  }

  throw new Error('內容包內容不支援。');
}

function createCharacterContentPreview(
  characters: readonly CharacterProfileRecord[],
  characterAvatars: readonly CharacterAvatarRecord[],
  conflictingCharacterIds: ReadonlySet<string>,
): readonly CharacterContentPackPreviewCharacter[] {
  const avatarCharacterIds = new Set(characterAvatars.map(avatar => avatar.characterId));

  return characters.map(character => ({
    id: character.id,
    name: character.name,
    source: character.source,
    hasAvatar: avatarCharacterIds.has(character.id),
    hasConflict: conflictingCharacterIds.has(character.id),
  }));
}

function createObjectContentPreview(
  customObjects: readonly CustomObjectRecord[],
  customObjectImages: readonly CustomObjectImageRecord[],
  conflictingObjectIds: ReadonlySet<string>,
): readonly CustomObjectContentPackPreviewObject[] {
  const imageObjectIds = new Set(customObjectImages.map(image => image.objectId));

  return customObjects.map(customObject => ({
    id: customObject.id,
    name: customObject.name,
    source: customObject.source,
    originKind: customObject.origin.kind,
    hasImage: imageObjectIds.has(customObject.id),
    hasConflict: conflictingObjectIds.has(customObject.id),
  }));
}

function getIncludedContentTables(
  characterCount: number,
  objectCount: number,
): readonly SaveTableName[] {
  return [
    ...(characterCount > 0 ? ['characters', 'characterAvatars'] as const : []),
    ...(objectCount > 0 ? ['customObjects', 'customObjectImages'] as const : []),
  ];
}

async function resolveCharacterImportRecords(
  selectedCharacterRecords: readonly CharacterProfileRecord[],
  selectedAvatarRecords: readonly CharacterAvatarRecord[],
  conflictResolutions: Record<string, ContentPackConflictResolution>,
): Promise<{
  characterRecords: readonly CharacterProfileRecord[];
  avatarRecords: readonly CharacterAvatarRecord[];
}> {
  const existingCharacterIds = await getExistingIds(
    saveDb.characters,
    selectedCharacterRecords.map(character => character.id),
  );
  const existingAvatarIds = await getExistingIds(
    saveDb.characterAvatars,
    selectedAvatarRecords.map(avatar => avatar.id),
  );
  const reservedCharacterIds = new Set([
    ...existingCharacterIds,
    ...selectedCharacterRecords.map(character => character.id),
  ]);
  const reservedAvatarIds = new Set([
    ...existingAvatarIds,
    ...selectedAvatarRecords.map(avatar => avatar.id),
  ]);
  const characterIdMap = new Map<string, string>();
  const timestamp = Date.now();
  const characterRecords = selectedCharacterRecords.map(character => {
    const shouldCreateNewId = existingCharacterIds.has(character.id) &&
      (conflictResolutions[character.id] ?? 'newId') === 'newId';

    if (!shouldCreateNewId) {
      characterIdMap.set(character.id, character.id);
      return character;
    }

    const nextCharacterId = createUniqueImportedId(character.id, reservedCharacterIds);

    reservedCharacterIds.add(nextCharacterId);
    characterIdMap.set(character.id, nextCharacterId);

    return {
      ...character,
      id: nextCharacterId,
      source: 'imported' as const,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  const avatarRecords = selectedAvatarRecords.map(avatar => {
    const nextCharacterId = characterIdMap.get(avatar.characterId);

    if (!nextCharacterId) {
      return null;
    }

    if (nextCharacterId === avatar.characterId) {
      return avatar;
    }

    const nextAvatarId = createUniqueImportedId(`${nextCharacterId}-avatar`, reservedAvatarIds);

    reservedAvatarIds.add(nextAvatarId);

    return {
      ...avatar,
      id: nextAvatarId,
      characterId: nextCharacterId,
      updatedAt: timestamp,
    };
  }).filter((avatar): avatar is CharacterAvatarRecord => avatar !== null);

  return {
    characterRecords,
    avatarRecords,
  };
}

async function resolveObjectImportRecords(
  selectedObjectRecords: readonly CustomObjectRecord[],
  selectedImageRecords: readonly CustomObjectImageRecord[],
  conflictResolutions: Record<string, ContentPackConflictResolution>,
): Promise<{
  objectRecords: readonly CustomObjectRecord[];
  imageRecords: readonly CustomObjectImageRecord[];
}> {
  const existingObjectIds = await getExistingIds(
    saveDb.customObjects,
    selectedObjectRecords.map(customObject => customObject.id),
  );
  const existingImageIds = await getExistingIds(
    saveDb.customObjectImages,
    selectedImageRecords.map(image => image.id),
  );
  const reservedObjectIds = new Set([
    ...existingObjectIds,
    ...selectedObjectRecords.map(customObject => customObject.id),
  ]);
  const reservedImageIds = new Set([
    ...existingImageIds,
    ...selectedImageRecords.map(image => image.id),
  ]);
  const objectIdMap = new Map<string, string>();
  const imageIdByObjectId = new Map<string, string>();
  const timestamp = Date.now();
  const objectRecords = selectedObjectRecords.map(customObject => {
    const shouldCreateNewId = existingObjectIds.has(customObject.id) &&
      (conflictResolutions[customObject.id] ?? 'newId') === 'newId';

    if (!shouldCreateNewId) {
      objectIdMap.set(customObject.id, customObject.id);
      imageIdByObjectId.set(customObject.id, customObject.imageId);
      return customObject;
    }

    const nextObjectId = createUniqueImportedId(customObject.id, reservedObjectIds);
    const nextImageId = createUniqueImportedId(`${nextObjectId}-image`, reservedImageIds);

    reservedObjectIds.add(nextObjectId);
    reservedImageIds.add(nextImageId);
    objectIdMap.set(customObject.id, nextObjectId);
    imageIdByObjectId.set(customObject.id, nextImageId);

    return {
      ...customObject,
      id: nextObjectId,
      source: 'imported' as const,
      imageId: nextImageId,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });
  const imageRecords = selectedImageRecords.map(image => {
    const nextObjectId = objectIdMap.get(image.objectId);

    if (!nextObjectId) {
      return null;
    }

    const nextImageId = imageIdByObjectId.get(image.objectId) ?? image.id;

    if (nextObjectId === image.objectId && nextImageId === image.id) {
      return image;
    }

    return {
      ...image,
      id: nextImageId,
      objectId: nextObjectId,
      updatedAt: timestamp,
    };
  }).filter((image): image is CustomObjectImageRecord => image !== null);

  return {
    objectRecords,
    imageRecords,
  };
}

async function getExistingIds<TRecord, TKey extends string>(
  table: Table<TRecord, TKey>,
  ids: readonly string[],
): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set();
  }

  const records = await table.bulkGet(ids as TKey[]);

  return new Set(ids.filter((_, index) => records[index] !== undefined));
}

function createUniqueImportedId(originalId: string, reservedIds: Set<string>): string {
  let index = 1;
  let nextId = `${originalId}-imported-${String(index)}`;

  while (reservedIds.has(nextId)) {
    index += 1;
    nextId = `${originalId}-imported-${String(index)}`;
  }

  return nextId;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(index, index + BASE64_CHUNK_SIZE));
  }

  return btoa(binary);
}

function base64ToBytes(encodedValue: string): Uint8Array {
  const binary = atob(encodedValue);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(buffer).set(bytes);

  return buffer;
}

function isSaveTableName(value: string): value is SaveTableName {
  return (SAVE_TABLES as readonly string[]).includes(value);
}

function isSupportedPackageType(value: unknown): value is SaveTransferPackageType {
  return value === FULL_SAVE_PACKAGE_TYPE || value === CONTENT_PACK_PACKAGE_TYPE;
}

function readFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
