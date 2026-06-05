import Dexie, { type Table } from 'dexie';
import type { MiniSpriteSheet } from '~/widgets/miniAvatar/miniAvatarTypes';

export const MINI_SPRITE_SHEET_CACHE_DATABASE_NAME = 'figureBoxMiniSpriteSheetCacheDb';
export const MINI_SPRITE_SHEET_CACHE_DATABASE_VERSION = 1;

interface MiniSpriteSheetCacheRecord extends MiniSpriteSheet {
  id: string;
  updatedAt: number;
}

class MiniSpriteSheetCacheDatabase extends Dexie {
  miniSpriteSheets!: Table<MiniSpriteSheetCacheRecord, string>;

  constructor() {
    super(MINI_SPRITE_SHEET_CACHE_DATABASE_NAME);
    this.version(MINI_SPRITE_SHEET_CACHE_DATABASE_VERSION).stores({
      miniSpriteSheets: 'id, updatedAt',
    });
  }
}

const miniSpriteSheetCacheDb = new MiniSpriteSheetCacheDatabase();

class MiniSpriteSheetCacheService {
  async get(cacheKey: string): Promise<MiniSpriteSheet | null> {
    const record = await miniSpriteSheetCacheDb.miniSpriteSheets.get(cacheKey);

    if (!record || !isMiniSpriteSheetCacheRecord(record)) {
      return null;
    }

    return cloneMiniSpriteSheet(record);
  }

  async put(cacheKey: string, spriteSheet: MiniSpriteSheet): Promise<void> {
    await miniSpriteSheetCacheDb.miniSpriteSheets.put({
      id: cacheKey,
      ...cloneMiniSpriteSheet(spriteSheet),
      updatedAt: Date.now(),
    });
  }

  async clear(): Promise<void> {
    await miniSpriteSheetCacheDb.miniSpriteSheets.clear();
  }

  close(): void {
    miniSpriteSheetCacheDb.close();
  }
}

export async function deleteMiniSpriteSheetCacheDatabase(): Promise<void> {
  miniSpriteSheetCacheService.close();
  await Dexie.delete(MINI_SPRITE_SHEET_CACHE_DATABASE_NAME);
}

export const miniSpriteSheetCacheService = new MiniSpriteSheetCacheService();

function cloneMiniSpriteSheet(spriteSheet: MiniSpriteSheet): MiniSpriteSheet {
  return {
    dataUrl: spriteSheet.dataUrl,
    frameWidth: spriteSheet.frameWidth,
    frameHeight: spriteSheet.frameHeight,
    sheetWidth: spriteSheet.sheetWidth,
    sheetHeight: spriteSheet.sheetHeight,
    columns: spriteSheet.columns,
    rows: spriteSheet.rows,
    frameCount: spriteSheet.frameCount,
  };
}

function isMiniSpriteSheetCacheRecord(value: unknown): value is MiniSpriteSheetCacheRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.dataUrl === 'string' &&
    isPositiveNumber(value.frameWidth) &&
    isPositiveNumber(value.frameHeight) &&
    isPositiveNumber(value.sheetWidth) &&
    isPositiveNumber(value.sheetHeight) &&
    isPositiveNumber(value.columns) &&
    isPositiveNumber(value.rows) &&
    isPositiveNumber(value.frameCount) &&
    isNonNegativeNumber(value.updatedAt)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}
