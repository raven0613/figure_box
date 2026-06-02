import { Canvas } from 'fabric';

import { createDefaultAvatarState } from './avatarCanvas';
import type { AvatarState } from './avatarCanvas';
import { createMiniLayerImage } from './miniAvatar/miniAvatarAssets';
import { createMiniFrontIdleLayers } from './miniAvatar/miniAvatarLayerRenderer';
import {
  MINI_CANVAS_HEIGHT,
  MINI_CANVAS_WIDTH,
  MINI_DEFAULT_EYE_LIGHT_DISTANCE,
  MINI_FRONT_IDLE_RIG_LAYOUT,
} from './miniAvatar/miniAvatarRig';
import { bakeMiniFrontIdleSpriteSheet } from './miniAvatar/miniSpriteBaker';
import type { MiniSpriteSheet } from './miniAvatar/miniAvatarTypes';

export { MINI_DEFAULT_EYE_LIGHT_DISTANCE };
export type { MiniSpriteSheet };

interface MiniAvatarCanvasOptions {
  width?: number;
  height?: number;
  initialState?: AvatarState;
}

export class MiniAvatarCanvas {
  private readonly canvas: Canvas;
  private state: AvatarState;
  private renderVersion = 0;

  constructor(canvasElement: HTMLCanvasElement | string, options: MiniAvatarCanvasOptions = {}) {
    const width = options.width ?? MINI_CANVAS_WIDTH;
    const height = options.height ?? MINI_CANVAS_HEIGHT;
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
    void this.render();
  }

  static mount(container: HTMLElement, options?: MiniAvatarCanvasOptions): MiniAvatarCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new MiniAvatarCanvas(canvasElement, options);
  }

  setState(state: AvatarState): void {
    this.state = state;
    void this.render();
  }

  exportFrontIdleSpriteSheet(): Promise<MiniSpriteSheet> {
    return bakeMiniFrontIdleSpriteSheet(this.state);
  }

  destroy(): Promise<boolean> {
    return this.canvas.dispose();
  }

  private async render(): Promise<void> {
    const currentRenderVersion = this.renderVersion + 1;
    this.renderVersion = currentRenderVersion;
    this.canvas.remove(...this.canvas.getObjects());

    const images = await Promise.all(
      (await createMiniFrontIdleLayers(this.state))
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
