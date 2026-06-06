import { CHARACTER_SEEDS } from '~/constants/character';
import {
  MINI_AVATAR_ANIMATION_DEFINITIONS,
  MINI_WALK_BACK_ANIMATION,
  MINI_WALK_FRONT_ANIMATION,
  MINI_WALK_SIDE_ANIMATION,
} from '~/widgets/miniAvatar/miniAvatarAnimationDefinitions';
import { bakeCachedMiniAnimationSpriteSheet } from '~/widgets/miniAvatar/miniSpriteBakeCache';
import type { MiniAnimation } from '~/widgets/miniAvatar/miniAvatarTypes';
import {
  resolveTownSpriteAvatarState,
  type TownSpritePreloadCharacter,
} from './townSpritePreloadService';

export interface TownSpriteBackgroundBakeProgress {
  completed: number;
  total: number;
  failed: number;
  currentLabel: string;
}

export interface TownSpriteBackgroundBakeOptions {
  characters?: readonly TownSpritePreloadCharacter[];
  animations?: readonly MiniAnimation[];
  initialDelayMs?: number;
  jobDelayMs?: number;
  onProgress?: (progress: TownSpriteBackgroundBakeProgress) => void;
}

export interface TownSpriteBackgroundBakeController {
  cancel: () => void;
}

interface TownSpriteBackgroundBakeJob {
  character: TownSpritePreloadCharacter;
  animation: MiniAnimation;
}

type IdleSchedulerWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout?: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

const REQUIRED_TOWN_SPRITE_ANIMATION_IDS = new Set([
  MINI_WALK_BACK_ANIMATION.id,
  MINI_WALK_FRONT_ANIMATION.id,
  MINI_WALK_SIDE_ANIMATION.id,
]);
const DEFAULT_BACKGROUND_INITIAL_DELAY_MS = 1200;
const DEFAULT_BACKGROUND_JOB_DELAY_MS = 120;
const IDLE_CALLBACK_TIMEOUT_MS = 1600;

export function startTownSpriteBackgroundBake(
  options: TownSpriteBackgroundBakeOptions = {},
): TownSpriteBackgroundBakeController {
  const characters = options.characters ?? CHARACTER_SEEDS;
  const animations = options.animations ?? getDefaultBackgroundBakeAnimations();
  const jobs = createBackgroundBakeJobs(characters, animations);
  const total = jobs.length;
  const initialDelayMs = options.initialDelayMs ?? DEFAULT_BACKGROUND_INITIAL_DELAY_MS;
  const jobDelayMs = options.jobDelayMs ?? DEFAULT_BACKGROUND_JOB_DELAY_MS;
  let completed = 0;
  let failed = 0;
  let nextJobIndex = 0;
  let isCancelled = false;
  let timeoutId: number | null = null;
  let idleCallbackId: number | null = null;

  const notifyProgress = (currentLabel: string) => {
    options.onProgress?.({
      completed,
      total,
      failed,
      currentLabel,
    });
  };

  const clearScheduledRun = () => {
    if (timeoutId !== null) {
      window.clearTimeout(timeoutId);
      timeoutId = null;
    }

    if (idleCallbackId !== null) {
      const schedulerWindow = window as IdleSchedulerWindow;

      schedulerWindow.cancelIdleCallback?.(idleCallbackId);
      idleCallbackId = null;
    }
  };

  const scheduleRun = (callback: () => void, delayMs: number) => {
    if (isCancelled) {
      return;
    }

    clearScheduledRun();
    timeoutId = window.setTimeout(() => {
      timeoutId = null;

      if (isCancelled) {
        return;
      }

      const schedulerWindow = window as IdleSchedulerWindow;

      if (schedulerWindow.requestIdleCallback) {
        idleCallbackId = schedulerWindow.requestIdleCallback(() => {
          idleCallbackId = null;
          callback();
        }, { timeout: IDLE_CALLBACK_TIMEOUT_MS });
        return;
      }

      callback();
    }, delayMs);
  };

  const runNextJob = () => {
    if (isCancelled) {
      return;
    }

    const job = jobs[nextJobIndex];
    nextJobIndex += 1;

    if (!job) {
      notifyProgress(total > 0 ? 'Background sprites ready' : 'No background sprites needed');
      return;
    }

    notifyProgress(`${job.character.name} / ${job.animation.label}`);

    void bakeBackgroundSpriteSheet(job)
      .catch(error => {
        failed += 1;
        console.error('Failed to bake background town sprite sheet:', error);
      })
      .finally(() => {
        if (isCancelled) {
          return;
        }

        completed += 1;
        notifyProgress(`${job.character.name} / ${job.animation.label}`);
        scheduleRun(runNextJob, jobDelayMs);
      });
  };

  notifyProgress(total > 0 ? 'Background sprites queued' : 'No background sprites needed');
  scheduleRun(runNextJob, initialDelayMs);

  return {
    cancel: () => {
      isCancelled = true;
      clearScheduledRun();
    },
  };
}

function getDefaultBackgroundBakeAnimations(): MiniAnimation[] {
  return MINI_AVATAR_ANIMATION_DEFINITIONS.filter(animation => (
    !REQUIRED_TOWN_SPRITE_ANIMATION_IDS.has(animation.id)
  ));
}

function createBackgroundBakeJobs(
  characters: readonly TownSpritePreloadCharacter[],
  animations: readonly MiniAnimation[],
): TownSpriteBackgroundBakeJob[] {
  return characters.flatMap(character => (
    animations.map(animation => ({
      character,
      animation,
    }))
  ));
}

async function bakeBackgroundSpriteSheet(job: TownSpriteBackgroundBakeJob): Promise<void> {
  await bakeCachedMiniAnimationSpriteSheet(
    resolveTownSpriteAvatarState(job.character),
    job.animation,
  );
}
