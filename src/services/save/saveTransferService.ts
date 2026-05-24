import { exportDB, importInto, peakImportFile } from 'dexie-export-import';

import { saveDb, SAVE_TABLES } from './saveDb';
import {
  normalizeCharacterAvatarRecords,
  normalizeCharacterProfileRecords,
} from './saveNormalizer';
import {
  SAVE_DATABASE_NAME,
  SAVE_DATABASE_VERSION,
  SAVE_SCHEMA_VERSION,
  type CharacterAvatarRecord,
  type CharacterProfileRecord,
  type SaveTableName,
} from './saveTypes';

const SAVE_PACKAGE_PREFIX = 'FIGURE_BOX_SAVE_V1:';
const SAVE_PACKAGE_FORMAT = 'figureBoxSavePackage';
const SAVE_PACKAGE_FORMAT_VERSION = 1;
const FULL_SAVE_PACKAGE_TYPE = 'fullSave';
const CONTENT_PACK_PACKAGE_TYPE = 'contentPack';
const CHARACTER_CONTENT_PACK_KIND = 'characters';
const PAYLOAD_ENCODING = 'base64';
const DEXIE_JSON_MIME_TYPE = 'application/json';
const BASE64_CHUNK_SIZE = 0x8000;

type SaveTransferPackageType = typeof FULL_SAVE_PACKAGE_TYPE | typeof CONTENT_PACK_PACKAGE_TYPE;

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

export interface CharacterContentPackPreviewCharacter {
  id: string;
  name: string;
  source: CharacterProfileRecord['source'];
  hasAvatar: boolean;
}

export interface CharacterContentPackPreview {
  packageType: typeof CONTENT_PACK_PACKAGE_TYPE;
  exportedAt: number;
  characters: readonly CharacterContentPackPreviewCharacter[];
}

export interface ImportCharacterContentPackOptions {
  characterIds?: readonly string[];
}

export interface ExportCharacterContentPackOptions {
  characterIds?: readonly string[];
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

interface CharacterContentPackPayload {
  kind: typeof CHARACTER_CONTENT_PACK_KIND;
  schemaVersion: number;
  characters: readonly CharacterProfileRecord[];
  characterAvatars: readonly CharacterAvatarRecord[];
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
  const selectedCharacterIds = options.characterIds ? new Set(options.characterIds) : null;
  const [characters, allCharacterAvatars] = await Promise.all([
    saveDb.characters.toArray(),
    saveDb.characterAvatars.toArray(),
  ]);
  const selectedCharacters = characters
    .filter(character => selectedCharacterIds === null || selectedCharacterIds.has(character.id));

  if (selectedCharacters.length === 0) {
    throw new Error('目前沒有可匯出的角色。');
  }

  const characterIds = new Set(selectedCharacters.map(character => character.id));
  const characterAvatars = allCharacterAvatars.filter(avatar => characterIds.has(avatar.characterId));
  const payload: CharacterContentPackPayload = {
    kind: CHARACTER_CONTENT_PACK_KIND,
    schemaVersion: SAVE_SCHEMA_VERSION,
    characters: selectedCharacters,
    characterAvatars,
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
    includedTables: ['characters', 'characterAvatars'],
    payloadEncoding: PAYLOAD_ENCODING,
    payloadMimeType: DEXIE_JSON_MIME_TYPE,
    payload: bytesToBase64(payloadBytes),
  };

  return serializeSavePackageEnvelope(envelope);
}

export async function previewExportableCharacterContentPack(): Promise<CharacterContentPackPreview> {
  const [characters, allCharacterAvatars] = await Promise.all([
    saveDb.characters.toArray(),
    saveDb.characterAvatars.toArray(),
  ]);

  if (characters.length === 0) {
    throw new Error('目前沒有可匯出的角色。');
  }

  const avatarCharacterIds = new Set(allCharacterAvatars.map(avatar => avatar.characterId));

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: Date.now(),
    characters: characters.map(character => ({
      id: character.id,
      name: character.name,
      source: character.source,
      hasAvatar: avatarCharacterIds.has(character.id),
    })),
  };
}

export async function importCharacterContentPackString(
  packageString: string,
  options: ImportCharacterContentPackOptions = {},
): Promise<ContentPackPackageSummary> {
  const envelope = parseSavePackageEnvelope(packageString);

  if (envelope.packageType !== CONTENT_PACK_PACKAGE_TYPE) {
    throw new Error('這不是角色內容包。');
  }

  const payload = parseCharacterContentPackPayload(envelope.payload);
  const selectedCharacterIds = options.characterIds ? new Set(options.characterIds) : null;
  const characterRecords = normalizeCharacterProfileRecords(payload.characters)
    .filter(character => selectedCharacterIds === null || selectedCharacterIds.has(character.id));
  const characterIds = new Set(characterRecords.map(character => character.id));
  const avatarRecords = normalizeCharacterAvatarRecords(payload.characterAvatars)
    .filter(avatar => characterIds.has(avatar.characterId));

  if (characterRecords.length === 0) {
    throw new Error('角色內容包沒有可匯入的角色。');
  }

  await saveDb.transaction('rw', [
    saveDb.characters,
    saveDb.characterAvatars,
  ], async () => {
    await saveDb.characters.bulkPut(characterRecords);

    if (avatarRecords.length > 0) {
      await saveDb.characterAvatars.bulkPut(avatarRecords);
    }
  });

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: envelope.exportedAt,
    includedTables: ['characters', 'characterAvatars'],
    characterCount: characterRecords.length,
    avatarCount: avatarRecords.length,
  };
}

export function previewCharacterContentPackString(packageString: string): CharacterContentPackPreview {
  const envelope = parseSavePackageEnvelope(packageString);

  if (envelope.packageType !== CONTENT_PACK_PACKAGE_TYPE) {
    throw new Error('這不是角色內容包。');
  }

  const payload = parseCharacterContentPackPayload(envelope.payload);
  const avatarCharacterIds = new Set(payload.characterAvatars.map(avatar => avatar.characterId));
  const characters = payload.characters.map(character => ({
    id: character.id,
    name: character.name,
    source: character.source,
    hasAvatar: avatarCharacterIds.has(character.id),
  }));

  if (characters.length === 0) {
    throw new Error('角色內容包沒有可匯入的角色。');
  }

  return {
    packageType: CONTENT_PACK_PACKAGE_TYPE,
    exportedAt: envelope.exportedAt,
    characters,
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

function parseCharacterContentPackPayload(encodedPayload: string): CharacterContentPackPayload {
  let parsedPayload: unknown;

  try {
    parsedPayload = JSON.parse(new TextDecoder().decode(base64ToBytes(encodedPayload)));
  } catch {
    throw new Error('角色內容包格式錯誤，無法匯入。');
  }

  if (
    !isRecord(parsedPayload) ||
    parsedPayload.kind !== CHARACTER_CONTENT_PACK_KIND ||
    !Array.isArray(parsedPayload.characters) ||
    !Array.isArray(parsedPayload.characterAvatars)
  ) {
    throw new Error('角色內容包內容不支援。');
  }

  return {
    kind: CHARACTER_CONTENT_PACK_KIND,
    schemaVersion: readFiniteNumber(parsedPayload.schemaVersion, SAVE_SCHEMA_VERSION),
    characters: normalizeCharacterProfileRecords(parsedPayload.characters),
    characterAvatars: normalizeCharacterAvatarRecords(parsedPayload.characterAvatars),
  };
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
