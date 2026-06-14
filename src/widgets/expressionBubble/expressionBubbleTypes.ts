import type { ExpressionBubbleId } from '~/typing/expressionBubble';

export interface ExpressionBubbleSpriteSheet {
  dataUrl: string;
  frameWidth: number;
  frameHeight: number;
  sheetWidth: number;
  sheetHeight: number;
  columns: number;
  rows: number;
  frameCount: number;
}

export interface ExpressionBubbleSourceCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExpressionBubbleTransform {
  x?: number;
  y?: number;
  angle?: number;
  scale?: number;
  opacity?: number;
}

export interface ExpressionBubblePose {
  frame?: ExpressionBubbleTransform;
  face?: ExpressionBubbleTransform;
  expression?: ExpressionBubbleTransform;
  effects?: Readonly<Record<string, ExpressionBubbleTransform | undefined>>;
}

export interface ExpressionBubbleLayer {
  assetPath: string;
  x: number;
  y: number;
  zIndex: number;
  color?: string;
  angle?: number;
  scale?: number;
  opacity?: number;
}

export interface ExpressionBubbleAnimation {
  id: ExpressionBubbleId;
  label: string;
  version: number;
  bubbleId: ExpressionBubbleId;
  durationMs: number;
  fps: number;
  columns: number;
  isLooping: boolean;
  clips: ExpressionBubbleAnimationClip[];
}

export interface ExpressionBubbleAnimationClip {
  id: string;
  durationMs?: number;
  intervalMs?: number;
  startOffsetMs?: number;
  params?: Readonly<Record<string, unknown>>;
  sample: (
    elapsedMs: number,
    animation: ExpressionBubbleAnimation,
    clip: ExpressionBubbleAnimationClip,
  ) => ExpressionBubblePose;
}
