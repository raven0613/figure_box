import { FabricImage } from 'fabric';
import { TOWN_MAP_CHARACTER_RENDER_SCALE } from '~/constants/townMapWidgetConstants';
import type { MiniSpriteSheet } from './miniAvatar/miniAvatarTypes';

export type TownMapCharacterSpriteDirection = 'front' | 'back' | 'side-left' | 'side-right';

export interface TownMapCharacterSpriteAnimation {
  spriteSheet: MiniSpriteSheet;
  frameDurationMs: number;
}

export interface TownMapCharacterSpriteSet {
  front: TownMapCharacterSpriteAnimation;
  back: TownMapCharacterSpriteAnimation;
  side: TownMapCharacterSpriteAnimation;
}

export interface TownMapCharacterSpriteBody extends FabricImage {
  setTownMapSpriteDirection: (direction: TownMapCharacterSpriteDirection) => void;
  getTownMapSpriteDirection: () => TownMapCharacterSpriteDirection;
  setTownMapSpriteAnimationPaused: (isPaused: boolean) => void;
}

interface LoadedSpriteAnimation extends TownMapCharacterSpriteAnimation {
  image: HTMLImageElement;
}

interface TownMapCharacterSpriteRendererOptions {
  front: LoadedSpriteAnimation;
  back: LoadedSpriteAnimation;
  side: LoadedSpriteAnimation;
  renderSize: number;
}

export class TownMapCharacterSpriteRenderer {
  private readonly front: LoadedSpriteAnimation;
  private readonly back: LoadedSpriteAnimation;
  private readonly side: LoadedSpriteAnimation;
  private readonly renderSize: number;

  constructor(options: TownMapCharacterSpriteRendererOptions) {
    this.front = options.front;
    this.back = options.back;
    this.side = options.side;
    this.renderSize = options.renderSize;
  }

  createBody(initialDirection: TownMapCharacterSpriteDirection): TownMapCharacterSpriteBody {
    let direction = initialDirection;
    const desyncOffsetMs = Math.random() * this.front.spriteSheet.frameCount * this.front.frameDurationMs;
    const animationStartedAt = performance.now() - desyncOffsetMs;
    let pausedAt: number | null = null;
    let totalPausedDurationMs = 0;
    const spriteBody = new FabricImage(this.front.image, {
      width: this.renderSize,
      height: this.renderSize,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    });

    spriteBody._render = (context: CanvasRenderingContext2D) => {
      const animation = this.getAnimation(direction);
      const spriteSheet = animation.spriteSheet;
      const animationTimestamp = pausedAt ?? performance.now();
      const frameIndex = getSpriteFrameIndex(
        animation,
        animationStartedAt,
        animationTimestamp - totalPausedDurationMs,
      );
      const column = frameIndex % spriteSheet.columns;
      const row = Math.floor(frameIndex / spriteSheet.columns);
      const isMirrored = direction === 'side-right';
      const destination = -this.renderSize / 2;

      context.save();
      context.imageSmoothingEnabled = false;

      if (isMirrored) {
        context.scale(-1, 1);
      }

      context.drawImage(
        animation.image,
        column * spriteSheet.frameWidth,
        row * spriteSheet.frameHeight,
        spriteSheet.frameWidth,
        spriteSheet.frameHeight,
        destination,
        destination,
        this.renderSize,
        this.renderSize,
      );
      context.restore();
    };

    return Object.assign(spriteBody, {
      setTownMapSpriteDirection(nextDirection: TownMapCharacterSpriteDirection) {
        if (direction === nextDirection) {
          return;
        }

        direction = nextDirection;
        spriteBody.dirty = true;
      },
      getTownMapSpriteDirection() {
        return direction;
      },
      setTownMapSpriteAnimationPaused(isPaused: boolean) {
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

  private getAnimation(direction: TownMapCharacterSpriteDirection): LoadedSpriteAnimation {
    if (direction === 'front') {
      return this.front;
    }

    if (direction === 'back') {
      return this.back;
    }

    return this.side;
  }
}

export async function createTownMapCharacterSpriteRenderer(
  spriteSet: TownMapCharacterSpriteSet,
  cellSize: number,
): Promise<TownMapCharacterSpriteRenderer> {
  const [frontImage, backImage, sideImage] = await Promise.all([
    loadSpriteImage(spriteSet.front.spriteSheet.dataUrl),
    loadSpriteImage(spriteSet.back.spriteSheet.dataUrl),
    loadSpriteImage(spriteSet.side.spriteSheet.dataUrl),
  ]);

  return new TownMapCharacterSpriteRenderer({
    front: {
      ...spriteSet.front,
      image: frontImage,
    },
    back: {
      ...spriteSet.back,
      image: backImage,
    },
    side: {
      ...spriteSet.side,
      image: sideImage,
    },
    renderSize: cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE,
  });
}

function getSpriteFrameIndex(
  animation: LoadedSpriteAnimation,
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
    image.onerror = () => reject(new Error('Failed to load town map character sprite image.'));
    image.src = dataUrl;
  });
}
