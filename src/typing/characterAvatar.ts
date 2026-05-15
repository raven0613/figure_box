import type { CharacterBaseSetting, Expression } from '~/constants/character';

export interface AvatarPartTransformPreset {
  offsetX?: number;
  offsetY?: number;
  rotate?: number;
  scale?: number;
}

export interface AvatarExpressionPreset {
  expression: Expression;
  face?: AvatarPartTransformPreset;
  eyes?: AvatarPartTransformPreset;
  mouth?: AvatarPartTransformPreset;
  label: string;
}

export type CharacterAppearanceCatalog = Record<string, CharacterBaseSetting>;
export type AvatarExpressionPresetCatalog = Record<Expression, AvatarExpressionPreset>;
