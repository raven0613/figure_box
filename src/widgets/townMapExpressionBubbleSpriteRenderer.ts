import { FabricImage } from 'fabric';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import {
  getExpressionBubbleAnimationFrameDurationMs,
} from './expressionBubble/expressionBubbleAnimation';
import {
  getExpressionBubbleAnimationDefinition,
} from './expressionBubble/expressionBubbleAnimationDefinitions';
import { EXPRESSION_BUBBLE_MAP_SOURCE_CROP } from './expressionBubble/expressionBubbleRig';
import {
  bakeCachedExpressionBubbleSpriteSheet,
  createExpressionBubbleSpriteBakeCacheKey,
} from './expressionBubble/expressionBubbleSpriteBakeCache';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleSourceCrop,
  ExpressionBubbleSpriteSheet,
} from './expressionBubble/expressionBubbleTypes';

export interface TownMapExpressionBubbleSpriteAnimation {
  spriteSheet: ExpressionBubbleSpriteSheet;
  frameDurationMs: number;
}

export interface TownMapExpressionBubbleSpriteBody extends FabricImage {
  restartExpressionBubbleAnimation: () => void;
  setExpressionBubbleAnimationPaused: (isPaused: boolean) => void;
}

export interface TownMapExpressionBubbleSpriteRenderOptions {
  renderWidth: number;
  renderHeight: number;
  sourceCrop?: ExpressionBubbleSourceCrop;
}

interface LoadedExpressionBubbleSpriteAnimation extends TownMapExpressionBubbleSpriteAnimation {
  image: HTMLImageElement;
}

const loadedExpressionBubbleAnimations =
  new Map<string, Promise<LoadedExpressionBubbleSpriteAnimation>>();

export async function createTownMapExpressionBubbleSpriteBody(
  expressionBubbleId: ExpressionBubbleId,
  options: TownMapExpressionBubbleSpriteRenderOptions,
): Promise<TownMapExpressionBubbleSpriteBody> {
  const animation = await loadExpressionBubbleSpriteAnimation(expressionBubbleId);

  return createExpressionBubbleSpriteBody(animation, options);
}

async function loadExpressionBubbleSpriteAnimation(
  expressionBubbleId: ExpressionBubbleId,
): Promise<LoadedExpressionBubbleSpriteAnimation> {
  const animationDefinition = getExpressionBubbleAnimationDefinition(expressionBubbleId);
  const cacheKey = createExpressionBubbleSpriteBakeCacheKey(animationDefinition);
  const cachedAnimation = loadedExpressionBubbleAnimations.get(cacheKey);

  if (cachedAnimation) {
    return cachedAnimation;
  }

  const animationPromise = loadExpressionBubbleSpriteAnimationImage(animationDefinition);
  loadedExpressionBubbleAnimations.set(cacheKey, animationPromise);
  return animationPromise;
}

async function loadExpressionBubbleSpriteAnimationImage(
  animationDefinition: ExpressionBubbleAnimation,
): Promise<LoadedExpressionBubbleSpriteAnimation> {
  const spriteSheet = await bakeCachedExpressionBubbleSpriteSheet(animationDefinition);
  const image = await loadSpriteImage(spriteSheet.dataUrl);

  return {
    spriteSheet,
    frameDurationMs: getExpressionBubbleAnimationFrameDurationMs(animationDefinition),
    image,
  };
}

function createExpressionBubbleSpriteBody(
  animation: LoadedExpressionBubbleSpriteAnimation,
  options: TownMapExpressionBubbleSpriteRenderOptions,
): TownMapExpressionBubbleSpriteBody {
  let animationStartedAt = performance.now();
  let pausedAt: number | null = null;
  let totalPausedDurationMs = 0;
  const sourceCrop = options.sourceCrop ?? EXPRESSION_BUBBLE_MAP_SOURCE_CROP;
  const spriteBody = new FabricImage(animation.image, {
    width: options.renderWidth,
    height: options.renderHeight,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    objectCaching: false,
  });

  spriteBody._render = (context: CanvasRenderingContext2D) => {
    const spriteSheet = animation.spriteSheet;
    const animationTimestamp = pausedAt ?? performance.now();
    const frameIndex = getSpriteFrameIndex(
      animation,
      animationStartedAt,
      animationTimestamp - totalPausedDurationMs,
    );
    const column = frameIndex % spriteSheet.columns;
    const row = Math.floor(frameIndex / spriteSheet.columns);
    const sourceX = column * spriteSheet.frameWidth + sourceCrop.x;
    const sourceY = row * spriteSheet.frameHeight + sourceCrop.y;

    context.save();
    context.imageSmoothingEnabled = false;
    context.drawImage(
      animation.image,
      sourceX,
      sourceY,
      sourceCrop.width,
      sourceCrop.height,
      -options.renderWidth / 2,
      -options.renderHeight / 2,
      options.renderWidth,
      options.renderHeight,
    );
    context.restore();
  };

  return Object.assign(spriteBody, {
    restartExpressionBubbleAnimation() {
      animationStartedAt = performance.now();
      pausedAt = null;
      totalPausedDurationMs = 0;
      spriteBody.dirty = true;
    },
    setExpressionBubbleAnimationPaused(isPaused: boolean) {
      if (isPaused) {
        pausedAt ??= performance.now();
        return;
      }

      if (pausedAt === null) {
        return;
      }

      totalPausedDurationMs += performance.now() - pausedAt;
      pausedAt = null;
      spriteBody.dirty = true;
    },
  });
}

function getSpriteFrameIndex(
  animation: LoadedExpressionBubbleSpriteAnimation,
  animationStartedAt: number,
  animationTimestamp: number,
): number {
  const elapsedMs = Math.max(0, animationTimestamp - animationStartedAt);
  const frameIndex = Math.floor(elapsedMs / animation.frameDurationMs);

  return frameIndex % animation.spriteSheet.frameCount;
}

function loadSpriteImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load expression bubble sprite image.'));
    image.src = dataUrl;
  });
}
