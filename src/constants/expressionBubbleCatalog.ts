import type {
  ExpressionBubbleDefinition,
  ExpressionBubbleId,
} from '~/typing/expressionBubble';

export const DEFAULT_EXPRESSION_BUBBLE_ID: ExpressionBubbleId = 'surprised';

export const EXPRESSION_BUBBLE_DEFINITIONS: readonly ExpressionBubbleDefinition[] = [
  {
    id: 'surprised',
    label: '!',
    parts: {
      eyesId: 'lookup',
      mouthId: 'pout',
      effectIds: ['sweat'],
    },
  },
  {
    id: 'angry',
    label: '怒',
    parts: {
      eyesId: 'angry',
      mouthId: 'angry',
    },
  },
  {
    id: 'laugh',
    label: '大笑',
    parts: {
      eyesId: 'laugh',
      mouthId: 'laugh',
    },
  },
  {
    id: 'sigh',
    label: '...',
    parts: {
      eyesId: 'frown',
      mouthId: 'pout',
    },
  },
  {
    id: 'play',
    label: '玩',
    parts: {
      eyesId: 'love',
      mouthId: 'smile',
    },
  },
  {
    id: 'sad',
    label: '難過',
    parts: {
      eyesId: 'frown',
      mouthId: 'pout',
    },
  },
  {
    id: 'question',
    label: '?',
    parts: {
      eyesId: 'lookup',
      mouthId: 'normal',
    },
  },
  {
    id: 'sparkle_light',
    label: '閃亮',
    parts: {
      eyesId: 'love',
      mouthId: 'smile',
    },
  },
  {
    id: 'determined',
    label: '決定',
    parts: {
      eyesId: 'angry',
      mouthId: 'smile',
    },
  },
  {
    id: 'hungry',
    label: '餓',
    parts: {
      eyesId: 'frown',
      mouthId: 'normal',
    },
  },
];

export const EXPRESSION_BUBBLE_DEFINITIONS_BY_ID = createDefinitionCatalog(
  EXPRESSION_BUBBLE_DEFINITIONS,
);

if (!EXPRESSION_BUBBLE_DEFINITIONS_BY_ID[DEFAULT_EXPRESSION_BUBBLE_ID]) {
  throw new Error(
    `Default expression bubble "${DEFAULT_EXPRESSION_BUBBLE_ID}" is not defined.`,
  );
}

export function getExpressionBubbleDefinition(
  expressionBubbleId: ExpressionBubbleId,
): ExpressionBubbleDefinition {
  return EXPRESSION_BUBBLE_DEFINITIONS_BY_ID[expressionBubbleId]
    ?? EXPRESSION_BUBBLE_DEFINITIONS_BY_ID[DEFAULT_EXPRESSION_BUBBLE_ID];
}

export function isExpressionBubbleId(value: unknown): value is ExpressionBubbleId {
  return typeof value === 'string'
    && EXPRESSION_BUBBLE_DEFINITIONS_BY_ID[value] !== undefined;
}

function createDefinitionCatalog<T extends { id: string }>(
  definitions: readonly T[],
): Readonly<Record<string, T>> {
  return definitions.reduce<Record<string, T>>((catalog, definition) => ({
    ...catalog,
    [definition.id]: definition,
  }), {});
}
