import { FabricImage } from 'fabric';
import { TOWN_MAP_CHARACTER_RENDER_SCALE } from '~/constants/townMapWidgetConstants';
import type { MiniSpriteSheet } from './miniAvatar/miniAvatarTypes';

export type TownMapCharacterSpriteDirection = 'front' | 'side-left' | 'side-right';

export interface TownMapCharacterSpriteAnimation {
  spriteSheet: MiniSpriteSheet;
  frameDurationMs: number;
}

export interface TownMapCharacterSpriteSet {
  front: TownMapCharacterSpriteAnimation;
  side: TownMapCharacterSpriteAnimation;
}

export interface TownMapCharacterSpriteBody extends FabricImage {
  setTownMapSpriteDirection: (direction: TownMapCharacterSpriteDirection) => void;
  getTownMapSpriteDirection: () => TownMapCharacterSpriteDirection;
}

interface LoadedSpriteAnimation extends TownMapCharacterSpriteAnimation {
  image: HTMLImageElement;
}

interface TownMapCharacterSpriteRendererOptions {
  front: LoadedSpriteAnimation;
  side: LoadedSpriteAnimation;
  renderSize: number;
}

export class TownMapCharacterSpriteRenderer {
  private readonly front: LoadedSpriteAnimation;
  private readonly side: LoadedSpriteAnimation;
  private readonly renderSize: number;

  constructor(options: TownMapCharacterSpriteRendererOptions) {
    this.front = options.front;
    this.side = options.side;
    this.renderSize = options.renderSize;
  }

  createBody(initialDirection: TownMapCharacterSpriteDirection): TownMapCharacterSpriteBody {
    let direction = initialDirection;
    const desyncOffsetMs = Math.random() * this.front.spriteSheet.frameCount * this.front.frameDurationMs;
    const animationStartedAt = performance.now() - desyncOffsetMs;
    const spriteBody = new FabricImage(this.front.image, {
      width: this.renderSize,
      height: this.renderSize,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      objectCaching: false,
    }) as TownMapCharacterSpriteBody;

    spriteBody._render = (context: CanvasRenderingContext2D) => {
      const animation = direction === 'front' ? this.front : this.side;
      const spriteSheet = animation.spriteSheet;
      const frameIndex = getSpriteFrameIndex(animation, animationStartedAt);
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

    spriteBody.setTownMapSpriteDirection = (nextDirection: TownMapCharacterSpriteDirection) => {
      if (direction === nextDirection) {
        return;
      }

      direction = nextDirection;
      spriteBody.dirty = true;
    };
    spriteBody.getTownMapSpriteDirection = () => direction;

    return spriteBody;
  }
}

export async function createTownMapCharacterSpriteRenderer(
  spriteSet: TownMapCharacterSpriteSet,
  cellSize: number,
): Promise<TownMapCharacterSpriteRenderer> {
  const [frontImage, sideImage] = await Promise.all([
    loadSpriteImage(spriteSet.front.spriteSheet.dataUrl),
    loadSpriteImage(spriteSet.side.spriteSheet.dataUrl),
  ]);

  return new TownMapCharacterSpriteRenderer({
    front: {
      ...spriteSet.front,
      image: frontImage,
    },
    side: {
      ...spriteSet.side,
      image: sideImage,
    },
    renderSize: cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE,
  });
}

function getSpriteFrameIndex(animation: LoadedSpriteAnimation, animationStartedAt: number): number {
  const elapsedMs = Math.max(0, performance.now() - animationStartedAt);
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
