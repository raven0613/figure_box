import { CHARACTER_APPEARANCES } from '~/constants/characterAppearances';
import { AVATAR_EXPRESSION_PRESETS } from '~/constants/expressionPresets';
import { Expression, type CharacterBaseSetting } from '~/constants/character';
import type { AvatarExpressionPreset } from '~/typing/characterAvatar';

export function getCharacterAppearance(characterId: string): CharacterBaseSetting | null {
  return CHARACTER_APPEARANCES[characterId] ?? null;
}

export function getAvatarExpressionPreset(expression: Expression): AvatarExpressionPreset {
  return AVATAR_EXPRESSION_PRESETS[expression] ?? AVATAR_EXPRESSION_PRESETS[Expression.Normal];
}
