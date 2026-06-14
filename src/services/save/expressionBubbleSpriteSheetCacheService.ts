import Dexie, { type Table } from 'dexie';
import type { ExpressionBubbleSpriteSheet } from '~/widgets/expressionBubble/expressionBubbleTypes';

export const EXPRESSION_BUBBLE_SPRITE_SHEET_CACHE_DATABASE_NAME =
  'figureBoxExpressionBubbleSpriteSheetCacheDb';
export const EXPRESSION_BUBBLE_SPRITE_SHEET_CACHE_DATABASE_VERSION = 1;

interface ExpressionBubbleSpriteSheetCacheRecord extends ExpressionBubbleSpriteSheet {
  id: string;
  updatedAt: number;
}

class ExpressionBubbleSpriteSheetCacheDatabase extends Dexie {
  expressionBubbleSpriteSheets!: Table<ExpressionBubbleSpriteSheetCacheRecord, string>;

  constructor() {
    super(EXPRESSION_BUBBLE_SPRITE_SHEET_CACHE_DATABASE_NAME);
    this.version(EXPRESSION_BUBBLE_SPRITE_SHEET_CACHE_DATABASE_VERSION).stores({
      expressionBubbleSpriteSheets: 'id, updatedAt',
    });
  }
}

const expressionBubbleSpriteSheetCacheDb = new ExpressionBubbleSpriteSheetCacheDatabase();

class ExpressionBubbleSpriteSheetCacheService {
  async get(cacheKey: string): Promise<ExpressionBubbleSpriteSheet | null> {
    const record = await expressionBubbleSpriteSheetCacheDb.expressionBubbleSpriteSheets.get(cacheKey);

    if (!record || !isExpressionBubbleSpriteSheetCacheRecord(record)) {
      return null;
    }

    return cloneExpressionBubbleSpriteSheet(record);
  }

  async put(cacheKey: string, spriteSheet: ExpressionBubbleSpriteSheet): Promise<void> {
    await expressionBubbleSpriteSheetCacheDb.expressionBubbleSpriteSheets.put({
      id: cacheKey,
      ...cloneExpressionBubbleSpriteSheet(spriteSheet),
      updatedAt: Date.now(),
    });
  }

  async clear(): Promise<void> {
    await expressionBubbleSpriteSheetCacheDb.expressionBubbleSpriteSheets.clear();
  }

  close(): void {
    expressionBubbleSpriteSheetCacheDb.close();
  }
}

export async function deleteExpressionBubbleSpriteSheetCacheDatabase(): Promise<void> {
  expressionBubbleSpriteSheetCacheService.close();
  await Dexie.delete(EXPRESSION_BUBBLE_SPRITE_SHEET_CACHE_DATABASE_NAME);
}

export const expressionBubbleSpriteSheetCacheService =
  new ExpressionBubbleSpriteSheetCacheService();

function cloneExpressionBubbleSpriteSheet(
  spriteSheet: ExpressionBubbleSpriteSheet,
): ExpressionBubbleSpriteSheet {
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

function isExpressionBubbleSpriteSheetCacheRecord(
  value: unknown,
): value is ExpressionBubbleSpriteSheetCacheRecord {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === 'string'
    && typeof value.dataUrl === 'string'
    && isPositiveNumber(value.frameWidth)
    && isPositiveNumber(value.frameHeight)
    && isPositiveNumber(value.sheetWidth)
    && isPositiveNumber(value.sheetHeight)
    && isPositiveNumber(value.columns)
    && isPositiveNumber(value.rows)
    && isPositiveNumber(value.frameCount)
    && isNonNegativeNumber(value.updatedAt)
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
