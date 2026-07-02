import { UI_COLORS } from '~/constants/ui';
import { getExpressionBubbleDefinition } from '~/constants/expressionBubbleCatalog';
import { expressionBubbleSpriteSheetCacheService } from '~/services/save/expressionBubbleSpriteSheetCacheService';
import {
  EXPRESSION_BUBBLE_ASSET_CENTER,
  EXPRESSION_BUBBLE_CANVAS_HEIGHT,
  EXPRESSION_BUBBLE_CANVAS_WIDTH,
  EXPRESSION_BUBBLE_MAP_SOURCE_CROP,
  EXPRESSION_BUBBLE_PART_OFFSETS_BY_ID,
  EXPRESSION_BUBBLE_Z_INDEX,
} from './expressionBubbleRig';
import { bakeExpressionBubbleSpriteSheet } from './expressionBubbleSpriteBaker';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleSpriteSheet,
} from './expressionBubbleTypes';

const EXPRESSION_BUBBLE_SPRITE_BAKE_CACHE_SCHEMA_VERSION = 3;
const MAX_EXPRESSION_BUBBLE_SPRITE_BAKE_CACHE_SIZE = 32;
const expressionBubbleSpriteBakeCache =
  new Map<string, Promise<ExpressionBubbleSpriteSheet>>();

export function bakeCachedExpressionBubbleSpriteSheet(
  animation: ExpressionBubbleAnimation,
): Promise<ExpressionBubbleSpriteSheet> {
  const cacheKey = createExpressionBubbleSpriteBakeCacheKey(animation);
  const cachedSpriteSheet = expressionBubbleSpriteBakeCache.get(cacheKey);

  if (cachedSpriteSheet) {
    expressionBubbleSpriteBakeCache.delete(cacheKey);
    expressionBubbleSpriteBakeCache.set(cacheKey, cachedSpriteSheet);
    return cachedSpriteSheet;
  }

  trimExpressionBubbleSpriteBakeCache();
  const spriteSheetPromise = loadOrBakeExpressionBubbleSpriteSheet(cacheKey, animation)
    .catch(error => {
      expressionBubbleSpriteBakeCache.delete(cacheKey);
      throw error;
    });
  expressionBubbleSpriteBakeCache.set(cacheKey, spriteSheetPromise);
  return spriteSheetPromise;
}

export function clearExpressionBubbleSpriteBakeCache(): void {
  expressionBubbleSpriteBakeCache.clear();
}

export async function clearPersistedExpressionBubbleSpriteBakeCache(): Promise<void> {
  expressionBubbleSpriteBakeCache.clear();
  await expressionBubbleSpriteSheetCacheService.clear();
}

export function createExpressionBubbleSpriteBakeCacheKey(
  animation: ExpressionBubbleAnimation,
): string {
  const definition = getExpressionBubbleDefinition(animation.bubbleId);
  const animationSnapshot = stableStringify({
    animation,
    colors: UI_COLORS.expressionBubble,
    definition,
    rig: {
      assetCenter: EXPRESSION_BUBBLE_ASSET_CENTER,
      mapSourceCrop: EXPRESSION_BUBBLE_MAP_SOURCE_CROP,
      partOffsetsById: EXPRESSION_BUBBLE_PART_OFFSETS_BY_ID,
      zIndex: EXPRESSION_BUBBLE_Z_INDEX,
    },
  });
  const animationHash = `${hashStableString(animationSnapshot)}:${animationSnapshot.length}`;

  return [
    `schema:${EXPRESSION_BUBBLE_SPRITE_BAKE_CACHE_SCHEMA_VERSION}`,
    `animation:${animation.id}`,
    `version:${animation.version}`,
    `bubble:${animation.bubbleId}`,
    `duration:${animation.durationMs}`,
    `fps:${animation.fps}`,
    `columns:${animation.columns}`,
    `loop:${animation.isLooping}`,
    `frame:${EXPRESSION_BUBBLE_CANVAS_WIDTH}x${EXPRESSION_BUBBLE_CANVAS_HEIGHT}`,
    `snapshot:${animationHash}`,
  ].join('|');
}

async function loadOrBakeExpressionBubbleSpriteSheet(
  cacheKey: string,
  animation: ExpressionBubbleAnimation,
): Promise<ExpressionBubbleSpriteSheet> {
  const persistedSpriteSheet = await loadPersistedExpressionBubbleSpriteSheet(cacheKey);

  if (persistedSpriteSheet) {
    return persistedSpriteSheet;
  }

  const spriteSheet = await bakeExpressionBubbleSpriteSheet(animation);
  await persistExpressionBubbleSpriteSheet(cacheKey, spriteSheet);
  return spriteSheet;
}

async function loadPersistedExpressionBubbleSpriteSheet(
  cacheKey: string,
): Promise<ExpressionBubbleSpriteSheet | null> {
  try {
    return await expressionBubbleSpriteSheetCacheService.get(cacheKey);
  } catch (error) {
    console.error('Failed to read expression bubble sprite sheet cache:', error);
    return null;
  }
}

async function persistExpressionBubbleSpriteSheet(
  cacheKey: string,
  spriteSheet: ExpressionBubbleSpriteSheet,
): Promise<void> {
  try {
    await expressionBubbleSpriteSheetCacheService.put(cacheKey, spriteSheet);
  } catch (error) {
    console.error('Failed to persist expression bubble sprite sheet cache:', error);
  }
}

function trimExpressionBubbleSpriteBakeCache(): void {
  while (expressionBubbleSpriteBakeCache.size >= MAX_EXPRESSION_BUBBLE_SPRITE_BAKE_CACHE_SIZE) {
    const oldestCacheKey = expressionBubbleSpriteBakeCache.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    expressionBubbleSpriteBakeCache.delete(oldestCacheKey);
  }
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'function') {
    return value.toString();
  }

  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'undefined';
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(key => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`)
    .join(',')}}`;
}

function hashStableString(value: string): string {
  let hash = 5381;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 33) ^ value.charCodeAt(index);
  }

  return (hash >>> 0).toString(36);
}
