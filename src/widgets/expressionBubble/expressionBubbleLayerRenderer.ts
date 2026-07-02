import { UI_COLORS } from '~/constants/ui';
import { getExpressionBubbleDefinition } from '~/constants/expressionBubbleCatalog';
import type {
  ExpressionBubbleId,
  ExpressionBubblePartOffset,
  ExpressionBubblePartOffsets,
} from '~/typing/expressionBubble';
import { hasExpressionBubbleAsset } from './expressionBubbleAssets';
import {
  EXPRESSION_BUBBLE_ASSET_CENTER,
  EXPRESSION_BUBBLE_PART_OFFSETS_BY_ID,
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
  const offsets = mergeExpressionBubblePartOffsets(
    EXPRESSION_BUBBLE_PART_OFFSETS_BY_ID[expressionBubbleId],
    definition.parts.offsets,
  );

  return [
    ...createFrameLayers(pose.frame, offsets?.frame),
    ...createFaceLayers(pose.face, offsets?.face),
    ...createExpressionLayers('eyes', definition.parts.eyesId, pose.expression, offsets?.eyes),
    ...createExpressionLayers('mouth', definition.parts.mouthId, pose.expression, offsets?.mouth),
    ...(definition.parts.effectIds ?? []).flatMap(effectId => createEffectLayers(
      effectId,
      pose.effects?.[effectId],
      offsets?.effects?.[effectId],
    )),
  ].sort((first, second) => first.zIndex - second.zIndex);
}

function createFrameLayers(
  transform: ExpressionBubbleTransform | undefined,
  offset: ExpressionBubblePartOffset | undefined,
): ExpressionBubbleLayer[] {
  return [
    createLayer(
      'frame_color.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameColor,
      BUBBLE_COLORS.frame,
      transform,
      offset,
    ),
    createLayer(
      'frame_shadow.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameShadow,
      BUBBLE_COLORS.frameShadow,
      transform,
      offset,
    ),
    createLayer(
      'frame_line.png',
      EXPRESSION_BUBBLE_Z_INDEX.frameLine,
      BUBBLE_COLORS.line,
      transform,
      offset,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createFaceLayers(
  transform: ExpressionBubbleTransform | undefined,
  offset: ExpressionBubblePartOffset | undefined,
): ExpressionBubbleLayer[] {
  return [
    createLayer(
      'face_color.png',
      EXPRESSION_BUBBLE_Z_INDEX.faceColor,
      BUBBLE_COLORS.face,
      transform,
      offset,
    ),
    createLayer(
      'face_line.png',
      EXPRESSION_BUBBLE_Z_INDEX.faceLine,
      BUBBLE_COLORS.line,
      transform,
      offset,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createExpressionLayers(
  partType: 'eyes' | 'mouth',
  partId: string,
  transform: ExpressionBubbleTransform | undefined,
  offset: ExpressionBubblePartOffset | undefined,
): ExpressionBubbleLayer[] {
  const color = getExpressionPartColor(partType, partId);

  return [
    createLayer(
      `express/${partType}_${partId}_color.png`,
      EXPRESSION_BUBBLE_Z_INDEX.expressionColor,
      color,
      transform,
      offset,
    ),
    createLayer(
      `express/${partType}_${partId}_line.png`,
      EXPRESSION_BUBBLE_Z_INDEX.expressionLine,
      BUBBLE_COLORS.line,
      transform,
      offset,
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
  offset: ExpressionBubblePartOffset | undefined,
): ExpressionBubbleLayer[] {
  return [
    createLayer(
      `effect/${effectId}_color.png`,
      EXPRESSION_BUBBLE_Z_INDEX.effectColor,
      getEffectColor(effectId),
      transform,
      offset,
    ),
    createLayer(
      `effect/${effectId}_line.png`,
      EXPRESSION_BUBBLE_Z_INDEX.effectLine,
      BUBBLE_COLORS.line,
      transform,
      offset,
    ),
  ].filter((layer): layer is ExpressionBubbleLayer => layer !== null);
}

function createLayer(
  assetPath: string,
  zIndex: number,
  color: string,
  transform: ExpressionBubbleTransform | undefined,
  offset: ExpressionBubblePartOffset | undefined,
): ExpressionBubbleLayer | null {
  if (!hasExpressionBubbleAsset(assetPath)) {
    return null;
  }

  return {
    assetPath,
    zIndex,
    color,
    x: EXPRESSION_BUBBLE_ASSET_CENTER.x + (offset?.x ?? 0) + (transform?.x ?? 0),
    y: EXPRESSION_BUBBLE_ASSET_CENTER.y + (offset?.y ?? 0) + (transform?.y ?? 0),
    angle: transform?.angle,
    scale: transform?.scale,
    opacity: transform?.opacity,
  };
}

function mergeExpressionBubblePartOffsets(
  rigOffsets: ExpressionBubblePartOffsets | undefined,
  definitionOffsets: ExpressionBubblePartOffsets | undefined,
): ExpressionBubblePartOffsets | undefined {
  if (!rigOffsets) {
    return definitionOffsets;
  }

  if (!definitionOffsets) {
    return rigOffsets;
  }

  return {
    frame: mergeExpressionBubblePartOffset(rigOffsets.frame, definitionOffsets.frame),
    face: mergeExpressionBubblePartOffset(rigOffsets.face, definitionOffsets.face),
    eyes: mergeExpressionBubblePartOffset(rigOffsets.eyes, definitionOffsets.eyes),
    mouth: mergeExpressionBubblePartOffset(rigOffsets.mouth, definitionOffsets.mouth),
    effects: mergeExpressionBubbleEffectOffsets(rigOffsets.effects, definitionOffsets.effects),
  };
}

function mergeExpressionBubbleEffectOffsets(
  rigEffectOffsets: ExpressionBubblePartOffsets['effects'],
  definitionEffectOffsets: ExpressionBubblePartOffsets['effects'],
): ExpressionBubblePartOffsets['effects'] {
  const effectIds = new Set([
    ...Object.keys(rigEffectOffsets ?? {}),
    ...Object.keys(definitionEffectOffsets ?? {}),
  ]);

  if (effectIds.size === 0) {
    return undefined;
  }

  return [...effectIds].reduce<Record<string, ExpressionBubblePartOffset | undefined>>(
    (mergedOffsets, effectId) => ({
      ...mergedOffsets,
      [effectId]: mergeExpressionBubblePartOffset(
        rigEffectOffsets?.[effectId],
        definitionEffectOffsets?.[effectId],
      ),
    }),
    {},
  );
}

function mergeExpressionBubblePartOffset(
  rigOffset: ExpressionBubblePartOffset | undefined,
  definitionOffset: ExpressionBubblePartOffset | undefined,
): ExpressionBubblePartOffset | undefined {
  if (!rigOffset) {
    return definitionOffset;
  }

  if (!definitionOffset) {
    return rigOffset;
  }

  return {
    x: addOptionalNumbers(rigOffset.x, definitionOffset.x),
    y: addOptionalNumbers(rigOffset.y, definitionOffset.y),
  };
}

function addOptionalNumbers(firstValue: number | undefined, secondValue: number | undefined): number | undefined {
  if (firstValue === undefined) {
    return secondValue;
  }

  if (secondValue === undefined) {
    return firstValue;
  }

  return firstValue + secondValue;
}

function getEffectColor(effectId: string): string {
  if (effectId === 'sweat') {
    return BUBBLE_COLORS.sweat;
  }

  return BUBBLE_COLORS.face;
}
