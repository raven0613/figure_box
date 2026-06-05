import { CHARACTER_SEEDS } from '~/constants/character';
import { characterAvatarSaveService } from '~/services/save/characterAvatarSaveService';
import {
  createDefaultAvatarState,
  normalizeAvatarState,
  type AvatarState,
} from '~/widgets/avatarCanvas';
import {
  getMiniAnimationFrameDurationMs,
} from '~/widgets/miniAvatar/miniAvatarAnimation';
import {
  MINI_WALK_FRONT_ANIMATION,
  MINI_WALK_SIDE_ANIMATION,
} from '~/widgets/miniAvatar/miniAvatarAnimationDefinitions';
import { bakeCachedMiniAnimationSpriteSheet } from '~/widgets/miniAvatar/miniSpriteBakeCache';
import type { MiniAnimation } from '~/widgets/miniAvatar/miniAvatarTypes';
import type { TownMapCharacterSpriteSet } from '~/widgets/townMapCharacterSpriteRenderer';

export interface TownSpritePreloadCharacter {
  id: string;
  name: string;
  color: string;
}

export interface TownSpritePreloadProgress {
  completed: number;
  total: number;
  currentLabel: string;
}

export interface TownSpritePreloadResult {
  completed: number;
  total: number;
  failed: number;
}

export interface TownSpritePreloadOptions {
  characters?: readonly TownSpritePreloadCharacter[];
  animations?: readonly MiniAnimation[];
  concurrency?: number;
  onProgress?: (progress: TownSpritePreloadProgress) => void;
}

interface TownSpritePreloadJob {
  character: TownSpritePreloadCharacter;
  animation: MiniAnimation;
}

const DEFAULT_PRELOAD_CONCURRENCY = 1;
const DEFAULT_CHARACTER_COLOR = '#f0cc5f';
const DEFAULT_SKIN_SOURCE_RGB = { red: 240, green: 204, blue: 95 };
const DEFAULT_BOTTOM_RGB = { red: 47, green: 71, blue: 95 };
const SKIN_LINE_COLOR = '#5e463f';
const CLOTHING_BOTTOM_MIX_COLOR = '#2f475f';
const WHITE_COLOR = '#ffffff';
const CLOTHING_BOTTOM_MIX_WEIGHT = 0.72;
const CLOTHING_BOTTOM_DECO_MIX_WEIGHT = 0.28;
const SKIN_RED_WEIGHT = 0.16;
const SKIN_GREEN_WEIGHT = 0.12;
const SKIN_BLUE_WEIGHT = 0.1;
const SKIN_TARGET_RED = 232;
const SKIN_TARGET_GREEN = 196;
const SKIN_TARGET_BLUE = 170;

export async function preloadTownRequiredSpriteSheets(
  options: TownSpritePreloadOptions = {},
): Promise<TownSpritePreloadResult> {
  const characters = options.characters ?? CHARACTER_SEEDS;
  const animations = options.animations ?? [
    MINI_WALK_FRONT_ANIMATION,
    MINI_WALK_SIDE_ANIMATION,
  ];
  const jobs = createPreloadJobs(characters, animations);
  const total = jobs.length;
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? DEFAULT_PRELOAD_CONCURRENCY));
  let completed = 0;
  let failed = 0;
  let nextJobIndex = 0;

  options.onProgress?.({
    completed,
    total,
    currentLabel: total > 0 ? 'Preparing sprites' : 'Sprites ready',
  });

  async function runNextJob(): Promise<void> {
    const job = jobs[nextJobIndex];
    nextJobIndex += 1;

    if (!job) {
      return;
    }

    options.onProgress?.({
      completed,
      total,
      currentLabel: `${job.character.name} / ${job.animation.label}`,
    });

    try {
      await preloadTownSpriteSheet(job);
    } catch (error) {
      failed += 1;
      console.error('Failed to preload town sprite sheet:', error);
    } finally {
      completed += 1;
      options.onProgress?.({
        completed,
        total,
        currentLabel: `${job.character.name} / ${job.animation.label}`,
      });
    }

    await runNextJob();
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, total) }, () => runNextJob()),
  );

  return {
    completed,
    total,
    failed,
  };
}

export function resolveTownSpriteAvatarState(character: TownSpritePreloadCharacter): AvatarState {
  const savedAvatarState = characterAvatarSaveService.getRecord(character.id)?.avatarState;

  if (isAvatarStateInput(savedAvatarState)) {
    return normalizeAvatarState(savedAvatarState);
  }

  return createSeedColorMiniAvatarState(character);
}

export async function loadTownCharacterSpriteSet(
  character: TownSpritePreloadCharacter,
): Promise<TownMapCharacterSpriteSet> {
  const avatarState = resolveTownSpriteAvatarState(character);
  const [frontSpriteSheet, sideSpriteSheet] = await Promise.all([
    bakeCachedMiniAnimationSpriteSheet(avatarState, MINI_WALK_FRONT_ANIMATION),
    bakeCachedMiniAnimationSpriteSheet(avatarState, MINI_WALK_SIDE_ANIMATION),
  ]);

  return {
    front: {
      spriteSheet: frontSpriteSheet,
      frameDurationMs: getMiniAnimationFrameDurationMs(MINI_WALK_FRONT_ANIMATION),
    },
    side: {
      spriteSheet: sideSpriteSheet,
      frameDurationMs: getMiniAnimationFrameDurationMs(MINI_WALK_SIDE_ANIMATION),
    },
  };
}

function createPreloadJobs(
  characters: readonly TownSpritePreloadCharacter[],
  animations: readonly MiniAnimation[],
): TownSpritePreloadJob[] {
  return characters.flatMap(character => (
    animations.map(animation => ({
      character,
      animation,
    }))
  ));
}

async function preloadTownSpriteSheet(job: TownSpritePreloadJob): Promise<void> {
  await bakeCachedMiniAnimationSpriteSheet(
    resolveTownSpriteAvatarState(job.character),
    job.animation,
  );
}

function createSeedColorMiniAvatarState(character: TownSpritePreloadCharacter): AvatarState {
  const defaultState = createDefaultAvatarState();
  const characterColor = character.color || DEFAULT_CHARACTER_COLOR;
  const skinColor = createSkinColor(characterColor);
  const clothingBottomColor = mixHexColors(
    characterColor,
    CLOTHING_BOTTOM_MIX_COLOR,
    CLOTHING_BOTTOM_MIX_WEIGHT,
  );

  return normalizeAvatarState({
    ...defaultState,
    face: {
      ...defaultState.face,
      color: skinColor,
      lineColor: SKIN_LINE_COLOR,
    },
    'face.color': {
      ...defaultState['face.color'],
      color: skinColor,
    },
    ear: {
      ...defaultState.ear,
      color: skinColor,
      lineColor: SKIN_LINE_COLOR,
    },
    'eyes.color': {
      ...defaultState['eyes.color'],
      color: characterColor,
    },
    'hair.bangs': {
      ...defaultState['hair.bangs'],
      color: characterColor,
    },
    'hair.topHair': {
      ...defaultState['hair.topHair'],
      color: characterColor,
    },
    'hair.backHair': {
      ...defaultState['hair.backHair'],
      color: characterColor,
    },
    'mini.clothingTop': {
      ...defaultState['mini.clothingTop'],
      color: characterColor,
    },
    'mini.clothingBottom': {
      ...defaultState['mini.clothingBottom'],
      color: clothingBottomColor,
      secondaryColor: mixHexColors(clothingBottomColor, WHITE_COLOR, CLOTHING_BOTTOM_DECO_MIX_WEIGHT),
    },
    accessories: defaultState.accessories.map(accessory => ({
      ...accessory,
      instanceId: `${character.id}:${accessory.category}:${accessory.order}`,
    })),
  });
}

function isAvatarStateInput(value: unknown): value is Partial<AvatarState> {
  return typeof value === 'object' && value !== null;
}

function createSkinColor(sourceColor: string): string {
  const sourceRgb = parseHexColor(sourceColor) ?? DEFAULT_SKIN_SOURCE_RGB;

  return formatHexColor({
    red: Math.round(sourceRgb.red * SKIN_RED_WEIGHT + SKIN_TARGET_RED * (1 - SKIN_RED_WEIGHT)),
    green: Math.round(sourceRgb.green * SKIN_GREEN_WEIGHT + SKIN_TARGET_GREEN * (1 - SKIN_GREEN_WEIGHT)),
    blue: Math.round(sourceRgb.blue * SKIN_BLUE_WEIGHT + SKIN_TARGET_BLUE * (1 - SKIN_BLUE_WEIGHT)),
  });
}

function mixHexColors(firstColor: string, secondColor: string, secondColorWeight: number): string {
  const firstRgb = parseHexColor(firstColor) ?? DEFAULT_SKIN_SOURCE_RGB;
  const secondRgb = parseHexColor(secondColor) ?? DEFAULT_BOTTOM_RGB;
  const firstColorWeight = 1 - secondColorWeight;

  return formatHexColor({
    red: Math.round(firstRgb.red * firstColorWeight + secondRgb.red * secondColorWeight),
    green: Math.round(firstRgb.green * firstColorWeight + secondRgb.green * secondColorWeight),
    blue: Math.round(firstRgb.blue * firstColorWeight + secondRgb.blue * secondColorWeight),
  });
}

function parseHexColor(color: string): { red: number; green: number; blue: number } | null {
  if (!/^#[0-9a-f]{6}$/i.test(color)) {
    return null;
  }

  return {
    red: Number.parseInt(color.slice(1, 3), 16),
    green: Number.parseInt(color.slice(3, 5), 16),
    blue: Number.parseInt(color.slice(5, 7), 16),
  };
}

function formatHexColor(color: { red: number; green: number; blue: number }): string {
  return `#${formatHexChannel(color.red)}${formatHexChannel(color.green)}${formatHexChannel(color.blue)}`;
}

function formatHexChannel(value: number): string {
  return Math.max(0, Math.min(255, value)).toString(16).padStart(2, '0');
}
