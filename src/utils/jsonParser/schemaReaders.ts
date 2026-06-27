import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleValue,
} from '../../services/characterEvents/rules';

export type CharacterEventDefinitionRecord = Record<string, unknown>;

const VALID_BUCKET_IDS = ['baseline', 'need', 'environment', 'global'] as const;
const VALID_MOTIVATIONS = ['idle', 'findFood', 'play', 'chat'] as const;
const VALID_CLAUSE_MODES = ['all', 'some'] as const;

// 共用 readRequiredString、readOptionalNumber、isRecord、enum includes 等基礎 reader
export function readBucketId(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventBucketId {
  const bucketId = readRequiredString(definition, 'bucketId', index);

  if (!includesString(VALID_BUCKET_IDS, bucketId)) {
    throw new Error(`Character event definition at index ${index} has invalid bucketId "${bucketId}".`);
  }

  return bucketId;
}

export function readMotivation(
  definition: CharacterEventDefinitionRecord,
  index: number,
): UtilityDrivenMotivation {
  const motivation = readRequiredString(definition, 'motivation', index);

  if (!isUtilityDrivenMotivation(motivation)) {
    throw new Error(`Character event definition at index ${index} has invalid motivation "${motivation}".`);
  }

  return motivation;
}

export function readOptionalMotivation(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): UtilityDrivenMotivation | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !isUtilityDrivenMotivation(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readRequiredString(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string {
  const value = definition[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character event definition at index ${index} must include string ${key}.`);
  }

  return value;
}

export function readRequiredNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number {
  const value = definition[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Character event definition at index ${index} must include finite number ${key}.`);
  }

  return value;
}

export function readRequiredNonNegativeNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number {
  const value = readRequiredNumber(definition, key, index);

  if (value < 0) {
    throw new Error(`Character event definition at index ${index} must include non-negative number ${key}.`);
  }

  return value;
}

export function readOptionalNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readOptionalNonNegativeNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = readOptionalNumber(definition, key, index);

  if (value !== undefined && value < 0) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readOptionalProbability(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = readOptionalNonNegativeNumber(definition, key, index);

  if (value !== undefined && value > 1) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}; expected 0 to 1.`);
  }

  return value;
}

export function readOptionalBoolean(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): boolean | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readOptionalClauseMode(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventClauseMode | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_CLAUSE_MODES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readOptionalStringList(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function readOptionalString(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

export function isRecord(value: unknown): value is CharacterEventDefinitionRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isRuleValue(value: unknown): value is CharacterEventRuleValue {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  ) {
    return true;
  }

  return Array.isArray(value) && value.every(isRuleValue);
}

export function includesString<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.some(validValue => validValue === value);
}

function isUtilityDrivenMotivation(value: string): value is UtilityDrivenMotivation {
  return includesString(VALID_MOTIVATIONS, value);
}
