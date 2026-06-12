import rawExpressionMotions from './expressionMotions.json';
import rawExpressionPresets from './expressionPresets.json';
import {
  loadExpressionMotionDefinitions,
  loadExpressionPresetDefinitions,
} from '~/utils/jsonParser/expressionSchema';
import type {
  ExpressionMotionDefinition,
  ExpressionMotionId,
  ExpressionPresetDefinition,
  ExpressionPresetId,
} from '~/typing/expression';

export const DEFAULT_EXPRESSION_PRESET_ID: ExpressionPresetId = 'normal';

export const EXPRESSION_MOTION_DEFINITIONS: readonly ExpressionMotionDefinition[] =
  loadExpressionMotionDefinitions(rawExpressionMotions);

export const EXPRESSION_MOTION_DEFINITIONS_BY_ID = createDefinitionCatalog(
  EXPRESSION_MOTION_DEFINITIONS,
);

export const EXPRESSION_PRESET_DEFINITIONS: readonly ExpressionPresetDefinition[] =
  loadExpressionPresetDefinitions(
    rawExpressionPresets,
    new Set(Object.keys(EXPRESSION_MOTION_DEFINITIONS_BY_ID)),
  );

export const EXPRESSION_PRESET_DEFINITIONS_BY_ID = createDefinitionCatalog(
  EXPRESSION_PRESET_DEFINITIONS,
);

if (!EXPRESSION_PRESET_DEFINITIONS_BY_ID[DEFAULT_EXPRESSION_PRESET_ID]) {
  throw new Error(
    `Default expression preset "${DEFAULT_EXPRESSION_PRESET_ID}" is not defined.`,
  );
}

export function getExpressionPresetDefinition(
  presetId: ExpressionPresetId,
): ExpressionPresetDefinition {
  return EXPRESSION_PRESET_DEFINITIONS_BY_ID[presetId]
    ?? EXPRESSION_PRESET_DEFINITIONS_BY_ID[DEFAULT_EXPRESSION_PRESET_ID];
}

export function getExpressionMotionDefinition(
  motionId: ExpressionMotionId,
): ExpressionMotionDefinition | null {
  return EXPRESSION_MOTION_DEFINITIONS_BY_ID[motionId] ?? null;
}

export function isExpressionPresetId(value: unknown): value is ExpressionPresetId {
  return typeof value === 'string' && EXPRESSION_PRESET_DEFINITIONS_BY_ID[value] !== undefined;
}

function createDefinitionCatalog<T extends { id: string }>(
  definitions: readonly T[],
): Readonly<Record<string, T>> {
  return definitions.reduce<Record<string, T>>((catalog, definition) => ({
    ...catalog,
    [definition.id]: definition,
  }), {});
}
