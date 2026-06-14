import { Canvas } from 'fabric';
import { DEFAULT_EXPRESSION_BUBBLE_ID } from '~/constants/expressionBubbleCatalog';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import {
  getExpressionBubbleAnimationFrameDurationMs,
  sampleExpressionBubbleAnimation,
} from './expressionBubble/expressionBubbleAnimation';
import {
  getExpressionBubbleAnimationDefinition,
} from './expressionBubble/expressionBubbleAnimationDefinitions';
import { createExpressionBubbleLayerImages } from './expressionBubble/expressionBubbleAssets';
import { createExpressionBubbleLayers } from './expressionBubble/expressionBubbleLayerRenderer';
import {
  EXPRESSION_BUBBLE_CANVAS_HEIGHT,
  EXPRESSION_BUBBLE_CANVAS_WIDTH,
} from './expressionBubble/expressionBubbleRig';
import { bakeCachedExpressionBubbleSpriteSheet } from './expressionBubble/expressionBubbleSpriteBakeCache';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubblePose,
  ExpressionBubbleSpriteSheet,
} from './expressionBubble/expressionBubbleTypes';

export type { ExpressionBubbleSpriteSheet };

interface ExpressionBubbleCanvasOptions {
  width?: number;
  height?: number;
  animation?: ExpressionBubbleAnimation;
  expressionBubbleId?: ExpressionBubbleId;
  isAnimationEnabled?: boolean;
}

export class ExpressionBubbleCanvas {
  private readonly canvas: Canvas;
  private animation: ExpressionBubbleAnimation;
  private readonly isAnimationEnabled: boolean;
  private renderVersion = 0;
  private animationStartedAt = 0;
  private animationFrameId: number | null = null;
  private lastRenderedAnimationFrame = -1;

  constructor(
    canvasElement: HTMLCanvasElement | string,
    options: ExpressionBubbleCanvasOptions = {},
  ) {
    const width = options.width ?? EXPRESSION_BUBBLE_CANVAS_WIDTH;
    const height = options.height ?? EXPRESSION_BUBBLE_CANVAS_HEIGHT;
    this.animation = options.animation
      ?? getExpressionBubbleAnimationDefinition(
        options.expressionBubbleId ?? DEFAULT_EXPRESSION_BUBBLE_ID,
      );
    this.isAnimationEnabled = options.isAnimationEnabled === true;
    this.canvas = new Canvas(canvasElement, {
      width,
      height,
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
    void this.render(
      this.isAnimationEnabled
        ? sampleExpressionBubbleAnimation(this.animation, 0)
        : {},
    );

    if (this.isAnimationEnabled) {
      this.startAnimationPreview();
    }
  }

  static mount(
    container: HTMLElement,
    options?: ExpressionBubbleCanvasOptions,
  ): ExpressionBubbleCanvas {
    const canvasElement = document.createElement('canvas');
    container.appendChild(canvasElement);
    return new ExpressionBubbleCanvas(canvasElement, options);
  }

  setExpressionBubbleId(expressionBubbleId: ExpressionBubbleId): void {
    this.setAnimation(getExpressionBubbleAnimationDefinition(expressionBubbleId));
  }

  setAnimation(animation: ExpressionBubbleAnimation): void {
    this.animation = animation;
    this.animationStartedAt = typeof performance === 'undefined' ? 0 : performance.now();
    this.lastRenderedAnimationFrame = -1;

    if (!this.isAnimationEnabled) {
      void this.render();
      return;
    }

    void this.render(sampleExpressionBubbleAnimation(this.animation, 0));
  }

  exportAnimationSpriteSheet(): Promise<ExpressionBubbleSpriteSheet> {
    return bakeCachedExpressionBubbleSpriteSheet(this.animation);
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
      const frameDurationMs = getExpressionBubbleAnimationFrameDurationMs(this.animation);
      const elapsedMs = timestamp - this.animationStartedAt;
      const animationFrame = Math.floor((elapsedMs % this.animation.durationMs) / frameDurationMs);

      if (animationFrame !== this.lastRenderedAnimationFrame) {
        this.lastRenderedAnimationFrame = animationFrame;
        void this.render(sampleExpressionBubbleAnimation(this.animation, elapsedMs));
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

  private async render(pose: ExpressionBubblePose = {}): Promise<void> {
    const currentRenderVersion = this.renderVersion + 1;
    this.renderVersion = currentRenderVersion;
    this.canvas.remove(...this.canvas.getObjects());

    const layers = createExpressionBubbleLayers(this.animation.bubbleId, pose);
    const images = await createExpressionBubbleLayerImages(layers);

    if (currentRenderVersion !== this.renderVersion) {
      return;
    }

    this.canvas.add(...images);
    this.canvas.requestRenderAll();
  }
}
