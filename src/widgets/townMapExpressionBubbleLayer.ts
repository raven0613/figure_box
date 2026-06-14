import { Canvas } from 'fabric';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import {
  FLOATING_UI_LAYER_RANK,
  TOWN_MAP_CHARACTER_RENDER_SCALE,
  TOWN_MAP_EXPRESSION_BUBBLE_OFFSET_X_RATIO,
  TOWN_MAP_EXPRESSION_BUBBLE_OFFSET_Y_RATIO,
  TOWN_MAP_EXPRESSION_BUBBLE_RENDER_SCALE,
} from '../constants/townMapWidgetConstants';
import { EXPRESSION_BUBBLE_MAP_SOURCE_CROP } from './expressionBubble/expressionBubbleRig';
import {
  createTownMapExpressionBubbleSpriteBody,
  type TownMapExpressionBubbleSpriteBody,
} from './townMapExpressionBubbleSpriteRenderer';
import type { GridCoordinate } from './townMapGrid';

interface TownMapExpressionBubbleLayerOptions {
  canvas: Canvas;
  cellSize: number;
  getCharacterCenter: (characterId: string) => GridCoordinate | null;
  startAnimationLoop: () => void;
}

export class TownMapExpressionBubbleLayer {
  private readonly canvas: Canvas;
  private readonly cellSize: number;
  private readonly getCharacterCenter: (characterId: string) => GridCoordinate | null;
  private readonly startAnimationLoop: () => void;
  private readonly characterExpressionBubbles = new Map<string, TownMapExpressionBubbleSpriteBody>();
  private readonly loadVersions = new Map<string, number>();

  constructor(options: TownMapExpressionBubbleLayerOptions) {
    this.canvas = options.canvas;
    this.cellSize = options.cellSize;
    this.getCharacterCenter = options.getCharacterCenter;
    this.startAnimationLoop = options.startAnimationLoop;
  }

  dispose(): void {
    const hasExpressionBubbles = this.characterExpressionBubbles.size > 0;

    this.loadVersions.clear();
    this.characterExpressionBubbles.forEach(sprite => {
      this.canvas.remove(sprite);
    });
    this.characterExpressionBubbles.clear();

    if (hasExpressionBubbles) {
      this.canvas.requestRenderAll();
    }
  }

  hasActiveAnimations(): boolean {
    return this.characterExpressionBubbles.size > 0;
  }

  setPaused(isPaused: boolean): void {
    this.characterExpressionBubbles.forEach(sprite => {
      sprite.setExpressionBubbleAnimationPaused(isPaused);
    });
  }

  syncViewportZoom(_zoom: number): void {
    this.characterExpressionBubbles.forEach(sprite => {
      sprite.setCoords();
    });
  }

  show(characterId: string, expressionBubbleId: ExpressionBubbleId): void {
    this.removeObject(characterId);
    const loadVersion = this.incrementLoadVersion(characterId);

    void this.showSprite(characterId, expressionBubbleId, loadVersion);
  }

  remove(characterId: string): void {
    this.incrementLoadVersion(characterId);
    this.removeObject(characterId);
  }

  markSpritesDirty(): void {
    this.characterExpressionBubbles.forEach(sprite => {
      sprite.dirty = true;
    });
  }

  private async showSprite(
    characterId: string,
    expressionBubbleId: ExpressionBubbleId,
    loadVersion: number,
  ): Promise<void> {
    try {
      const renderWidth = this.cellSize * TOWN_MAP_EXPRESSION_BUBBLE_RENDER_SCALE;
      const renderHeight = renderWidth * (
        EXPRESSION_BUBBLE_MAP_SOURCE_CROP.height / EXPRESSION_BUBBLE_MAP_SOURCE_CROP.width
      );
      const expressionBubble = await createTownMapExpressionBubbleSpriteBody(
        expressionBubbleId,
        {
          renderWidth,
          renderHeight,
          sourceCrop: EXPRESSION_BUBBLE_MAP_SOURCE_CROP,
        },
      );

      if (this.loadVersions.get(characterId) !== loadVersion) {
        return;
      }

      const anchor = this.getCharacterCenter(characterId);

      if (!anchor) {
        return;
      }

      expressionBubble.set('sortBottomY', Number.POSITIVE_INFINITY);
      expressionBubble.set('entityLayerRank', FLOATING_UI_LAYER_RANK);
      this.positionExpressionBubble(expressionBubble, anchor);
      expressionBubble.restartExpressionBubbleAnimation();
      this.characterExpressionBubbles.set(characterId, expressionBubble);
      this.canvas.add(expressionBubble);
      this.canvas.bringObjectToFront(expressionBubble);
      this.startAnimationLoop();
      this.canvas.requestRenderAll();
    } catch (error) {
      console.error('Failed to show expression bubble sprite:', error);
    }
  }

  private positionExpressionBubble(
    expressionBubble: TownMapExpressionBubbleSpriteBody,
    anchor: GridCoordinate,
  ): void {
    const characterRenderSize = this.cellSize * TOWN_MAP_CHARACTER_RENDER_SCALE;

    expressionBubble.set({
      left: anchor.x + characterRenderSize * TOWN_MAP_EXPRESSION_BUBBLE_OFFSET_X_RATIO,
      top: anchor.y + characterRenderSize * TOWN_MAP_EXPRESSION_BUBBLE_OFFSET_Y_RATIO,
      opacity: 1,
    });
    expressionBubble.setCoords();
  }

  private removeObject(characterId: string): void {
    const currentExpressionBubble = this.characterExpressionBubbles.get(characterId);

    if (!currentExpressionBubble) {
      return;
    }

    this.canvas.remove(currentExpressionBubble);
    this.characterExpressionBubbles.delete(characterId);
    this.canvas.requestRenderAll();
  }

  private incrementLoadVersion(characterId: string): number {
    const nextVersion = (this.loadVersions.get(characterId) ?? 0) + 1;

    this.loadVersions.set(characterId, nextVersion);
    return nextVersion;
  }
}
