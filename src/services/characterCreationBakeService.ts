import type { CreatePlayerCharacterResult } from '~/services/characterCreationService';
import {
  preloadTownRequiredSpriteSheets,
  resolveTownSpriteAvatarState,
  type TownSpritePreloadCharacter,
} from '~/services/townSpritePreloadService';
import { bakeMiniFrontIdleSpriteSheet } from '~/widgets/miniAvatar/miniSpriteBaker';

export interface CharacterCreationBakeProgress {
  label: string;
  completed: number;
  total: number;
}

interface BakeCreatedCharacterSpritesOptions {
  creationResult: CreatePlayerCharacterResult;
  onProgress?: (progress: CharacterCreationBakeProgress) => void;
}

const MINI_IDLE_BAKE_STEP_COUNT = 1;
const DEFAULT_PLAYER_CHARACTER_COLOR = '#f0cc5f';

export async function bakeCreatedCharacterSprites({
  creationResult,
  onProgress,
}: BakeCreatedCharacterSpritesOptions): Promise<void> {
  const character = createBakeCharacter(creationResult);
  let spritePreloadTotal = 0;
  let spritePreloadCompleted = 0;

  onProgress?.({
    label: `${character.name} / Preparing sprites`,
    completed: 0,
    total: 0,
  });

  const preloadResult = await preloadTownRequiredSpriteSheets({
    characters: [character],
    onProgress: progress => {
      spritePreloadTotal = progress.total;
      spritePreloadCompleted = progress.completed;

      onProgress?.({
        label: progress.currentLabel,
        completed: progress.completed,
        total: progress.total + MINI_IDLE_BAKE_STEP_COUNT,
      });
    },
  });

  if (preloadResult.failed > 0) {
    throw new Error('角色精靈圖烘焙失敗。');
  }

  onProgress?.({
    label: `${character.name} / Mini idle`,
    completed: spritePreloadCompleted,
    total: spritePreloadTotal + MINI_IDLE_BAKE_STEP_COUNT,
  });

  await bakeMiniFrontIdleSpriteSheet(resolveTownSpriteAvatarState(character));

  onProgress?.({
    label: `${character.name} / Sprites ready`,
    completed: spritePreloadTotal + MINI_IDLE_BAKE_STEP_COUNT,
    total: spritePreloadTotal + MINI_IDLE_BAKE_STEP_COUNT,
  });
}

function createBakeCharacter(
  creationResult: CreatePlayerCharacterResult,
): TownSpritePreloadCharacter {
  return {
    id: creationResult.characterId,
    name: creationResult.profileRecord.name,
    color: readCharacterColor(creationResult),
  };
}

function readCharacterColor(creationResult: CreatePlayerCharacterResult): string {
  const profileColor = creationResult.profileRecord.profile.color;

  return typeof profileColor === 'string' && profileColor.length > 0
    ? profileColor
    : DEFAULT_PLAYER_CHARACTER_COLOR;
}
