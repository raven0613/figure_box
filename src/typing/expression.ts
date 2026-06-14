import type { ExpressionBubbleId } from './expressionBubble';

export type ExpressionPresetId = string;
export type ExpressionMotionId = string;
export type ExpressionChannelKey =
  | 'face'
  | 'eyes'
  | 'upperEyelids'
  | 'eyeballs'
  | 'eyebrows'
  | 'mouth';

export type ExpressionEasing =
  | 'linear'
  | 'easeInOutSine'
  | 'easeOutCubic';

export interface ExpressionTransform {
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
  opacity?: number;
}

export interface ExpressionMotionKeyframe extends ExpressionTransform {
  atMs: number;
  easing?: ExpressionEasing;
}

export interface ExpressionMotionDefinition {
  id: ExpressionMotionId;
  durationMs: number;
  loop?: boolean;
  keyframes: readonly ExpressionMotionKeyframe[];
}

export interface ExpressionChannelDefinition {
  poseId?: string;
  transform?: ExpressionTransform;
  motionId?: ExpressionMotionId;
}

export interface ExpressionRenderProfile {
  face?: ExpressionChannelDefinition;
  eyes?: ExpressionChannelDefinition;
  upperEyelids?: ExpressionChannelDefinition;
  eyeballs?: ExpressionChannelDefinition;
  eyebrows?: ExpressionChannelDefinition;
  mouth?: ExpressionChannelDefinition;
  effectId?: string;
}

export interface MiniExpressionProfiles {
  expressionBubbleId?: ExpressionBubbleId;
  front?: ExpressionRenderProfile;
  side?: ExpressionRenderProfile;
  back?: ExpressionRenderProfile;
}

export interface ExpressionPresetDefinition {
  id: ExpressionPresetId;
  label: string;
  portrait: ExpressionRenderProfile;
  mini: MiniExpressionProfiles;
}
