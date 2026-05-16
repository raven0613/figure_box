import type { ComparisonOperator } from '~/constants/event';
import type {
  CharacterEventRuleClause,
  CharacterEventRulePath,
  CharacterEventWeightModifier,
} from '../../services/characterEvents/rules';
import {
  includesString,
  isRecord,
  isRuleValue,
  readOptionalNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'includes'] as const;

// conditions / weightModifiers / rule clause parser
export function readOptionalRuleClauses(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventRuleClause[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value.map((clause, clauseIndex) => readRuleClause(clause, `${key}[${clauseIndex}]`, index));
}

export function readOptionalWeightModifiers(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventWeightModifier[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value.map((modifier, modifierIndex) => {
    const clause = readRuleClause(modifier, `${key}[${modifierIndex}]`, index);

    if (!isRecord(modifier)) {
      throw new Error(`Character event definition at index ${index} has invalid ${key}[${modifierIndex}].`);
    }

    return {
      ...clause,
      add: readOptionalNumber(modifier, 'add', index),
      multiplier: readOptionalNumber(modifier, 'multiplier', index),
    };
  });
}

function readRuleClause(
  rawClause: unknown,
  label: string,
  index: number,
): CharacterEventRuleClause {
  if (!isRecord(rawClause)) {
    throw new Error(`Character event definition at index ${index} has invalid ${label}.`);
  }

  return {
    path: readRulePath(rawClause, 'path', index),
    operator: readOperator(rawClause, 'operator', index),
    value: readRuleValue(rawClause, 'value', index),
  };
}

function readRulePath(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventRulePath {
  const value = readRequiredString(definition, key, index);

  if (!value.startsWith('character.') && !value.startsWith('utility.') && !value.startsWith('input.')) {
    throw new Error(`Character event definition at index ${index} has invalid rule path "${value}".`);
  }

  return value as CharacterEventRulePath;
}

function readOperator(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): ComparisonOperator {
  const value = readRequiredString(definition, key, index);

  if (!includesString(VALID_OPERATORS, value)) {
    throw new Error(`Character event definition at index ${index} has invalid operator "${value}".`);
  }

  return value;
}

function readRuleValue(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
) {
  const value = definition[key];

  if (!isRuleValue(value)) {
    throw new Error(`Character event definition at index ${index} has invalid rule value.`);
  }

  return value;
}

