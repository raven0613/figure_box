import type { CSSProperties } from 'react';
import { getExpressionBubbleAnimationFrameDurationMs } from '~/widgets/expressionBubble/expressionBubbleAnimation';
import { EXPRESSION_BUBBLE_MAP_SOURCE_CROP } from '~/widgets/expressionBubble/expressionBubbleRig';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleSpriteSheet,
} from '~/widgets/expressionBubble/expressionBubbleTypes';

export const EXPRESSION_BUBBLE_PREVIEW_SCALE = 3;
export const EXPRESSION_BUBBLE_PREVIEW_TICK_MS = 50;

export function getExpressionBubblePreviewFrameIndex(
  animation: ExpressionBubbleAnimation,
  spriteSheet: ExpressionBubbleSpriteSheet,
  nowMs: number,
  animationStartedAt: number,
): number {
  const frameDurationMs = getExpressionBubbleAnimationFrameDurationMs(animation);
  const elapsedMs = Math.max(0, nowMs - animationStartedAt);
  const frameIndex = Math.floor(elapsedMs / frameDurationMs);

  return frameIndex % spriteSheet.frameCount;
}

export function createExpressionBubbleSpriteFrameStyle(
  spriteSheet: ExpressionBubbleSpriteSheet,
  frameIndex: number,
  scale = EXPRESSION_BUBBLE_PREVIEW_SCALE,
): CSSProperties {
  const column = frameIndex % spriteSheet.columns;
  const row = Math.floor(frameIndex / spriteSheet.columns);
  const sourceX = column * spriteSheet.frameWidth + EXPRESSION_BUBBLE_MAP_SOURCE_CROP.x;
  const sourceY = row * spriteSheet.frameHeight + EXPRESSION_BUBBLE_MAP_SOURCE_CROP.y;

  return {
    width: EXPRESSION_BUBBLE_MAP_SOURCE_CROP.width * scale,
    height: EXPRESSION_BUBBLE_MAP_SOURCE_CROP.height * scale,
    backgroundImage: `url(${spriteSheet.dataUrl})`,
    backgroundPosition: `-${sourceX * scale}px -${sourceY * scale}px`,
    backgroundSize: `${spriteSheet.sheetWidth * scale}px ${spriteSheet.sheetHeight * scale}px`,
  };
}
