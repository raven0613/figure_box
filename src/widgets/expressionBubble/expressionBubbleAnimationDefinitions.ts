import {
  DEFAULT_EXPRESSION_BUBBLE_ID,
  EXPRESSION_BUBBLE_DEFINITIONS,
  getExpressionBubbleDefinition,
} from '~/constants/expressionBubbleCatalog';
import type { ExpressionBubbleId } from '~/typing/expressionBubble';
import {
  createExpressionBubbleEffectFloatClip,
  createExpressionBubbleFaceShakeClip,
  createExpressionBubbleLaughClip,
} from './expressionBubbleAnimation';
import type {
  ExpressionBubbleAnimation,
  ExpressionBubbleAnimationClip,
} from './expressionBubbleTypes';

const SHAKE_EXPRESSION_BUBBLE_IDS = new Set<ExpressionBubbleId>([
  'angry',
  'sigh',
  'surprised',
]);
const EXPRESSION_BUBBLE_ANIMATION_DURATION_MS = 720;
const EXPRESSION_BUBBLE_ANIMATION_FRAME_COUNT = 6;
const EXPRESSION_BUBBLE_ANIMATION_FPS =
  EXPRESSION_BUBBLE_ANIMATION_FRAME_COUNT / (EXPRESSION_BUBBLE_ANIMATION_DURATION_MS / 1000);
const EXPRESSION_BUBBLE_ANIMATION_COLUMNS = 3;

export const EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS: readonly ExpressionBubbleAnimation[] =
  EXPRESSION_BUBBLE_DEFINITIONS.map(definition => createExpressionBubbleAnimation(definition.id));

export const EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS_BY_ID =
  EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS.reduce<Record<string, ExpressionBubbleAnimation>>(
    (catalog, animation) => ({
      ...catalog,
      [animation.id]: animation,
    }),
    {},
  );

export function getExpressionBubbleAnimationDefinition(
  expressionBubbleId: ExpressionBubbleId,
): ExpressionBubbleAnimation {
  return EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS_BY_ID[expressionBubbleId]
    ?? EXPRESSION_BUBBLE_ANIMATION_DEFINITIONS_BY_ID[DEFAULT_EXPRESSION_BUBBLE_ID];
}

function createExpressionBubbleAnimation(
  expressionBubbleId: ExpressionBubbleId,
): ExpressionBubbleAnimation {
  const definition = getExpressionBubbleDefinition(expressionBubbleId);
  const effectClips = (definition.parts.effectIds ?? [])
    .map(effectId => createExpressionBubbleEffectFloatClip(effectId));

  return {
    id: definition.id,
    label: definition.label,
    version: 7,
    bubbleId: definition.id,
    durationMs: EXPRESSION_BUBBLE_ANIMATION_DURATION_MS,
    fps: EXPRESSION_BUBBLE_ANIMATION_FPS,
    columns: EXPRESSION_BUBBLE_ANIMATION_COLUMNS,
    isLooping: true,
    clips: [
      ...createExpressionSpecificClips(definition.id),
      ...effectClips,
    ],
  };
}

function createExpressionSpecificClips(
  expressionBubbleId: ExpressionBubbleId,
): ExpressionBubbleAnimationClip[] {
  if (expressionBubbleId === 'laugh') {
    return [
      createExpressionBubbleLaughClip(),
    ];
  }

  if (!SHAKE_EXPRESSION_BUBBLE_IDS.has(expressionBubbleId)) {
    return [];
  }

  return [
    createExpressionBubbleFaceShakeClip(),
  ];
}
