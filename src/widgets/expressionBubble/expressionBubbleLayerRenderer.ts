import { UI_COLORS } from '~/constants/ui';
import { getExpressionBubbleDefinition } from '~/constants/expressionBubbleCatalog';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import { hasExpressionBubbleAsset } from './expressionBubbleAssets';
import {
  EXPRESSION_BUBBLE_ASSET_CENTER,
  EXPRESSION_BUBBLE_Z_INDEX,
} from './expressionBubbleRig';
import type {
  ExpressionBubbleLayer,
  ExpressionBubblePose,
  ExpressionBubbleTransform,
} from './expressionBubbleTypes';

const BUBBLE_COLORS = UI_COLORS.expressionBubble;
const BUBBLE_COLORS_BY_KEY: Readonly<Record<string, string | undefined>> = BUBBLE_COLORS;

export function createExpressionBubbleLayers(
  expressionBubbleId: ExpressionBubbleId,
  pose: ExpressionBubblePose = {},
): ExpressionBubbleLayer[] {
  const definition = getExpressionBubbleDefinition(expressionBubbleId);

  return [
    ...createFrameLayers(pose.frame),
    ...createFaceLayers(pose.face),
    ...createExpressionLayers('eyes', definition.parts.eyesId, pose.expression),
    ...createExpressionLayers('mouth', definition.parts.mouthId, pose.expression),
    ...(definition.parts.effectIds ?? []).flatMap(effectId => createEffectLayers(
      effectId,
      pose.effects?.[effectId],
    )),
  ].sort((first, second) => first.zIndex - second.zIndex);
}

function createFrameLayers(transform: ExpressionBubbleTransform | undefined): ExpressionBubbleLayer[] {
  return [
    createLayer(
      'frame_color.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameColor,
      BUBBLE_COLORS.frame,
      transform,
    ),
    createLayer(
      'frame_shadow.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameShadow,
      BUBBLE_COLORS.frameShadow,
      transform,
    ),
    createLayer(
      'frame_line.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameLine,
      BUBBLE_COLORS.line,
      transform,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createFaceLayers(transform: ExpressionBubbleTransform | undefined): ExpressionBubbleLayer[] {
  return [
    createLayer(
      'face_color.png',
      EXPRESSION_BUBBLE_Z_INDEX.faceColor,
      BUBBLE_COLORS.face,
      transform,
    ),
    createLayer(
      'face_line.png',
      EXPRESSION_BUBBLE_Z_INDEX.faceLine,
      BUBBLE_COLORS.line,
      transform,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createExpressionLayers(
  partType: 'eyes' | 'mouth',
  partId: string,
  transform: ExpressionBubbleTransform | undefined,
): ExpressionBubbleLayer[] {
  const color = getExpressionPartColor(partType, partId);

  return [
    createLayer(
      `express/${partType}_${partId}_color.png`,
      EXPRESSION_BUBBLE_Z_INDEX.expressionColor,
      color,
      transform,
    ),
    createLayer(
      `express/${partType}_${partId}_line.png`,
      EXPRESSION_BUBBLE_Z_INDEX.expressionLine,
      BUBBLE_COLORS.line,
      transform,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function getExpressionPartColor(
  partType: 'eyes' | 'mouth',
  partId: string,
): string {
  if (partType === 'mouth') {
    return BUBBLE_COLORS.mouth;
  }
  // eyes_love_color 就讀取 eyesLove
  return BUBBLE_COLORS_BY_KEY[`eyes${toPascalCase(partId)}`] ?? BUBBLE_COLORS.eyes;
}

function toPascalCase(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

function createEffectLayers(
  effectId: string,
  transform: ExpressionBubbleTransform | undefined,
): ExpressionBubbleLayer[] {
  return [
    createLayer(
      `effect/${effectId}_color.png`,
      EXPRESSION_BUBBLE_Z_INDEX.effectColor,
      getEffectColor(effectId),
      transform,
    ),
    createLayer(
      `effect/${effectId}_line.png`,
      EXPRESSION_BUBBLE_Z_INDEX.effectLine,
      BUBBLE_COLORS.line,
      transform,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createLayer(
  assetPath: string,
  zIndex: number,
  color: string,
  transform: ExpressionBubbleTransform | undefined,
): ExpressionBubbleLayer | null {
  if (!hasExpressionBubbleAsset(assetPath)) {
    return null;
  }

  return {
    assetPath,
    zIndex,
    color,
    x: EXPRESSION_BUBBLE_ASSET_CENTER.x + (transform?.x ?? 0),
    y: EXPRESSION_BUBBLE_ASSET_CENTER.y + (transform?.y ?? 0),
    angle: transform?.angle,
    scale: transform?.scale,
    opacity: transform?.opacity,
  };
}

function getEffectColor(effectId: string): string {
  if (effectId === 'sweat') {
    return BUBBLE_COLORS.sweat;
  }

  return BUBBLE_COLORS.face;
}
