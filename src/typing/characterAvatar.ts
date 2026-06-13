import type { CharacterBaseSetting } from '~/constants/character';
import type {
  ExpressionPresetDefinition,
  ExpressionPresetId,
} from './expression';

export type CharacterAppearanceCatalog = Record<string, CharacterBaseSetting>;
export type AvatarExpressionPresetCatalog = Record<ExpressionPresetId, ExpressionPresetDefinition>;
