import { CHARACTER_APPEARANCES } from '~/constants/characterAppearances';
import { getExpressionPresetDefinition } from '~/constants/expressionCatalog';
import type { CharacterBaseSetting } from '~/constants/character';
import type { ExpressionPresetDefinition, ExpressionPresetId } from '~/typing/expression';

export function getCharacterAppearance(characterId: string): CharacterBaseSetting | null {
  return CHARACTER_APPEARANCES[characterId] ?? null;
}

export function getAvatarExpressionPreset(
  presetId: ExpressionPresetId,
): ExpressionPresetDefinition {
  return getExpressionPresetDefinition(presetId);
}
