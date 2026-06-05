import { Canvas } from 'fabric';

import { createDefaultAvatarState } from './avatarCanvas';
import type { AvatarState } from './avatarCanvas';
import {
  sampleMiniAnimation,
} from './miniAvatar/miniAvatarAnimation';
import { MINI_WAVE_BLINK_ANIMATION } from './miniAvatar/miniAvatarAnimationDefinitions';
import { createMiniLayerImages } from './miniAvatar/miniAvatarAssets';
import { createMiniFrontIdleLayers, createMiniSideIdleLayers } from './miniAvatar/miniAvatarLayerRenderer';
import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
} from './miniAvatar/miniAvatarRig';
import {
  bakeMiniFrontIdleSpriteSheet,
} from './miniAvatar/miniSpriteBaker';
import { bakeCachedMiniAnimationSpriteSheet } from './miniAvatar/miniSpriteBakeCache';
import type { MiniAnimation, MiniAvatarDirection, MiniPose, MiniSpriteSheet } from './miniAvatar/miniAvatarTypes';

export { MINI_DEFAULT_EYE_LIGHT_DISTANCE };
export type { MiniSpriteSheet };

interface MiniAvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: AvatarState;
  animation?: MiniAnimation;
  isAnimationEnabled?: boolean;
  direction?: MiniAvatarDirection;
}

export class MiniAvatarCanvas {
  private readonly canvas: Canvas;
  private animation: MiniAnimation;
  private readonly isAnimationEnabled: boolean;
  private direction: MiniAvatarDirection;
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
    this.direction = options.direction ?? (this.isAnimationEnabled ? this.animation.direction : 'front');
    this.state = options.initialState ?? createDefaultAvatarState();
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
      backgroundColor: MINI_FRONT_IDLE_RIG_LAYOUT.colors.canvasBackground,
      imageSmoothingEnabled: false,
      allowTouchScrolling: true,
      selection: false,
      preserveObjectStacking: true,
    });

    this.canvas.wrapperEl.style.touchAction = 'pan-y';
    this.canvas.lowerCanvasEl.style.touchAction = 'pan-y';
    this.canvas.upperCanvasEl.style.touchAction = 'pan-y';
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

  setAnimation(animation: MiniAnimation): void {
    this.animation = animation;
    this.direction = this.isAnimationEnabled ? animation.direction : this.direction;
    this.animationStartedAt = typeof performance === 'undefined' ? 0 : performance.now();
    this.lastRenderedAnimationFrame = -1;

    if (!this.isAnimationEnabled) {
      return;
    }

    void this.render(sampleMiniAnimation(this.animation, 0));
  }

  exportFrontIdleSpriteSheet(): Promise<MiniSpriteSheet> {
    return bakeMiniFrontIdleSpriteSheet(this.state);
  }

  exportAnimationSpriteSheet(): Promise<MiniSpriteSheet> {
    return bakeCachedMiniAnimationSpriteSheet(this.state, this.animation);
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

    const layers = this.direction === 'side'
      ? await createMiniSideIdleLayers(this.state, pose)
      : await createMiniFrontIdleLayers(this.state, pose);
    const images = await createMiniLayerImages(
      [...layers].sort((first, second) => first.zIndex - second.zIndex),
    );

    if (currentRenderVersion !== this.renderVersion) {
      return;
    }

    this.canvas.add(...images);
    this.canvas.requestRenderAll();
  }
}
