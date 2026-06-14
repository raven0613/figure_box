export type ExpressionBubbleId = string;
export type ExpressionBubblePartId = string;
export type ExpressionBubbleEffectId = string;

export interface ExpressionBubbleParts {
  eyesId: ExpressionBubblePartId;
  mouthId: ExpressionBubblePartId;
  effectIds?: readonly ExpressionBubbleEffectId[];
}

export interface ExpressionBubbleDefinition {
  id: ExpressionBubbleId;
  label: string;
  parts: ExpressionBubbleParts;
}
