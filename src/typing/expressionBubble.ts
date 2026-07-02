export type ExpressionBubbleId = string;
export type ExpressionBubblePartId = string;
export type ExpressionBubbleEffectId = string;

export interface ExpressionBubblePartOffset {
  x?: number;
  y?: number;
}

export interface ExpressionBubblePartOffsets {
  frame?: ExpressionBubblePartOffset;
  face?: ExpressionBubblePartOffset;
  eyes?: ExpressionBubblePartOffset;
  mouth?: ExpressionBubblePartOffset;
  effects?: Readonly<Record<ExpressionBubbleEffectId, ExpressionBubblePartOffset | undefined>>;
}

export interface ExpressionBubbleParts {
  eyesId: ExpressionBubblePartId;
  mouthId: ExpressionBubblePartId;
  effectIds?: readonly ExpressionBubbleEffectId[];
  offsets?: ExpressionBubblePartOffsets;
}

export interface ExpressionBubbleDefinition {
  id: ExpressionBubbleId;
  label: string;
  parts: ExpressionBubbleParts;
}
