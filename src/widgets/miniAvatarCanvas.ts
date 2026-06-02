import { Canvas } from 'fabric';

import { createDefaultAvatarState } from './avatarCanvas';
import type { AvatarState } from './avatarCanvas';
import {
  MINI_WAVE_BLINK_ANIMATION,
  sampleMiniAnimation,
} from './miniAvatar/miniAvatarAnimation';
import { createMiniLayerImage } from './miniAvatar/miniAvatarAssets';
import { createMiniFrontIdleLayers } from './miniAvatar/miniAvatarLayerRenderer';
import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
} from './miniAvatar/miniAvatarRig';
import {
  bakeMiniAnimationSpriteSheet,
  bakeMiniFrontIdleSpriteSheet,
} from './miniAvatar/miniSpriteBaker';
import type { MiniAnimation, MiniPose, MiniSpriteSheet } from './miniAvatar/miniAvatarTypes';

export { MINI_DEFAULT_EYE_LIGHT_DISTANCE };
export type { MiniSpriteSheet };

interface MiniAvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: AvatarState;
  animation?: MiniAnimation;
  isAnimationEnabled?: boolean;
}

export class MiniAvatarCanvas {
  private readonly canvas: Canvas;
  private readonly animation: MiniAnimation;
  private readonly isAnimationEnabled: boolean;
  private state: AvatarState;
  private renderVersion = 0;
  private animationStartedAt = 0;
  private animationFrameId: number | null = null;
  private lastRenderedAnimationFrame = -1;

  constructor(canvasElement: HTMLCanvasElement | string, options: MiniAvatarCanvasOptions = {}) {
    const width = options.width ?? MINI_CANVAS_WIDTH;
    const height = options.height ?? MINI_CANVAS_HEIGHT;
    this.animation = options.animation ?? MINI_WAVE_BLINK_ANIMATION;
    this.isAnimationEnabled = options.isAnimationEnabled === true;
    this.state = options.initialState ?? createDefaultAvatarState();
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: MINI_FRONT_IDLE_RIG_LAYOUT.colors.canvasBackground,
      imageSmoothingEnabled: false,
      selection: false,
      preserveObjectStacking: true,
    });

    this.canvas.wrapperEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.touchAction = 'none';
    this.canvas.lowerCanvasEl.style.imageRendering = 'pixelated';
    this.canvas.upperCanvasEl.style.imageRendering = 'pixelated';
    void this.render(this.isAnimationEnabled ? sampleMiniAnimation(this.animation, 0) : {});

    if (this.isAnimationEnabled) {
      this.startAnimationPreview();
    }
  }

  static mount(container: HTMLElement, options?: MiniAvatarCanvasOptions): MiniAvatarCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new MiniAvatarCanvas(canvasElement, options);
  }

  setState(state: AvatarState): void {
    this.state = state;
    this.lastRenderedAnimationFrame = -1;

    if (!this.isAnimationEnabled) {
      void this.render();
    }
  }

  exportFrontIdleSpriteSheet(): Promise<MiniSpriteSheet> {
    return bakeMiniFrontIdleSpriteSheet(this.state);
  }

  exportAnimationSpriteSheet(): Promise<MiniSpriteSheet> {
    return bakeMiniAnimationSpriteSheet(this.state, this.animation);
  }

  destroy(): Promise<boolean> {
    this.stopAnimationPreview();
    return this.canvas.dispose();
  }

  private startAnimationPreview(): void {
    if (typeof window === 'undefined') {
      return;
    }

    this.animationStartedAt = performance.now();

    const tick = (timestamp: number) => {
      const frameDurationMs = 1000 / this.animation.fps;
      const elapsedMs = timestamp - this.animationStartedAt;
      const animationFrame = Math.floor((elapsedMs % this.animation.durationMs) / frameDurationMs);

      if (animationFrame !== this.lastRenderedAnimationFrame) {
        this.lastRenderedAnimationFrame = animationFrame;
        void this.render(sampleMiniAnimation(this.animation, elapsedMs));
      }

      this.animationFrameId = window.requestAnimationFrame(tick);
    };

    this.animationFrameId = window.requestAnimationFrame(tick);
  }

  private stopAnimationPreview(): void {
    if (this.animationFrameId === null || typeof window === 'undefined') {
      return;
    }

    window.cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private async render(pose: MiniPose = {}): Promise<void> {
    const currentRenderVersion = this.renderVersion + 1;
    this.renderVersion = currentRenderVersion;
    this.canvas.remove(...this.canvas.getObjects());

    const images = await Promise.all(
      (await createMiniFrontIdleLayers(this.state, pose))
        .sort((first, second) => first.zIndex - second.zIndex)
        .map(layer => createMiniLayerImage(layer)),
    );

    if (currentRenderVersion !== this.renderVersion) {
      return;
    }

    this.canvas.add(...images);
    this.canvas.requestRenderAll();
  }
}
