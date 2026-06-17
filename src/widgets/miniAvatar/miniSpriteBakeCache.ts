import type { AvatarState } from '../avatar/avatarTypes';
import { MINI_CANVAS_HEIGHT, MINI_CANVAS_WIDTH } from './miniAvatarRig';
import { bakeMiniAnimationSpriteSheet } from './miniSpriteBaker';
import type { MiniAnimation, MiniSpriteSheet } from './miniAvatarTypes';
import { miniSpriteSheetCacheService } from '~/services/save/miniSpriteSheetCacheService';

const SPRITE_BAKE_CACHE_SCHEMA_VERSION = 1;
const MAX_MINI_SPRITE_BAKE_CACHE_SIZE = 32;
const miniSpriteBakeCache = new Map<string, Promise<MiniSpriteSheet>>();

export function bakeCachedMiniAnimationSpriteSheet(
  state: AvatarState,
  animation: MiniAnimation,
): Promise<MiniSpriteSheet> {
  const cacheKey = createMiniSpriteBakeCacheKey(state, animation);
  const cachedSpriteSheet = miniSpriteBakeCache.get(cacheKey);

  if (cachedSpriteSheet) {
    miniSpriteBakeCache.delete(cacheKey);
    miniSpriteBakeCache.set(cacheKey, cachedSpriteSheet);
    return cachedSpriteSheet;
  }

  trimMiniSpriteBakeCache();
  const spriteSheetPromise = loadOrBakeMiniAnimationSpriteSheet(cacheKey, state, animation)
    .catch(error => {
      miniSpriteBakeCache.delete(cacheKey);
      throw error;
    });
  miniSpriteBakeCache.set(cacheKey, spriteSheetPromise);
  return spriteSheetPromise;
}

export function clearMiniSpriteBakeCache(): void {
  miniSpriteBakeCache.clear();
}

export async function clearPersistedMiniSpriteBakeCache(): Promise<void> {
  miniSpriteBakeCache.clear();
  await miniSpriteSheetCacheService.clear();
}

export function createMiniSpriteBakeCacheKey(state: AvatarState, animation: MiniAnimation): string {
  const appearanceSnapshot = stableStringify(state);
  const appearanceHash = `${hashStableString(appearanceSnapshot)}:${appearanceSnapshot.length}`;
  const animationFingerprint = [
    `schema:${SPRITE_BAKE_CACHE_SCHEMA_VERSION}`,
    `appearance:${appearanceHash}`,
    `animation:${animation.id}`,
    `version:${animation.version}`,
    `direction:${animation.direction}`,
    `duration:${animation.durationMs}`,
    `fps:${animation.fps}`,
    `columns:${animation.columns}`,
    `loop:${animation.isLooping}`,
    `frame:${MINI_CANVAS_WIDTH}x${MINI_CANVAS_HEIGHT}`,
  ];

  return animationFingerprint.join('|');
}

function stableStringify(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
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

async function loadOrBakeMiniAnimationSpriteSheet(
  cacheKey: string,
  state: AvatarState,
  animation: MiniAnimation,
): Promise<MiniSpriteSheet> {
  const persistedSpriteSheet = await loadPersistedMiniSpriteSheet(cacheKey);

  if (persistedSpriteSheet) {
    return persistedSpriteSheet;
  }

  const spriteSheet = await bakeMiniAnimationSpriteSheet(state, animation);
  await persistMiniSpriteSheet(cacheKey, spriteSheet);
  return spriteSheet;
}

async function loadPersistedMiniSpriteSheet(cacheKey: string): Promise<MiniSpriteSheet | null> {
  try {
    return await miniSpriteSheetCacheService.get(cacheKey);
  } catch (error) {
    console.error('Failed to read mini sprite sheet cache:', error);
    return null;
  }
}

async function persistMiniSpriteSheet(cacheKey: string, spriteSheet: MiniSpriteSheet): Promise<void> {
  try {
    await miniSpriteSheetCacheService.put(cacheKey, spriteSheet);
  } catch (error) {
    console.error('Failed to persist mini sprite sheet cache:', error);
  }
}

function trimMiniSpriteBakeCache(): void {
  while (miniSpriteBakeCache.size >= MAX_MINI_SPRITE_BAKE_CACHE_SIZE) {
    const oldestCacheKey = miniSpriteBakeCache.keys().next().value;

    if (!oldestCacheKey) {
      return;
    }

    miniSpriteBakeCache.delete(oldestCacheKey);
  }
}
