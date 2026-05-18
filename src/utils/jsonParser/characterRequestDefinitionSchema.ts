import type {
  CharacterRequestDefinition,
  CharacterRequestKind,
  CharacterRequestLevel,
  CharacterRequestSatisfiedEffect,
  CharacterRequestTarget,
} from '~/services/characterRequests/types';
import { readOptionalRuleClauses } from './ruleSchema';
import {
  includesString,
  isRecord,
  readOptionalClauseMode,
  readOptionalProbability,
  readOptionalStringList,
  readRequiredNonNegativeNumber,
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_REQUEST_LEVELS = ['critical', 'social', 'minor'] as const;
const VALID_REQUEST_KINDS = [
  'food',
  'meetCharacter',
  'talkToCharacter',
  'relationshipMilestone',
  'item',
  'roomDecor',
  'mapObject',
] as const;
const VALID_SATISFIED_EFFECT_TYPES = [
  'characterMoodValueDelta',
  'characterSaturationDelta',
  'playerInventoryItem',
] as const;

export function loadCharacterRequestDefinitions(rawDefinitions: unknown): CharacterRequestDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Character request definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => parseCharacterRequestDefinition(definition, index));
  assertUniqueDefinitionIds(definitions);

  return definitions;
}

function parseCharacterRequestDefinition(rawDefinition: unknown, index: number): CharacterRequestDefinition {
  if (!isRecord(rawDefinition)) {
    throw new Error(`Character request definition at index ${index} must be an object.`);
  }

  return {
    id: readRequiredString(rawDefinition, 'id', index),
    level: readRequestLevel(rawDefinition, index),
    kind: readRequestKind(rawDefinition, index),
    label: readRequiredString(rawDefinition, 'label', index),
    baseChance: readRequestBaseChance(rawDefinition, index),
    conditions: readOptionalRuleClauses(rawDefinition, 'conditions', index),
    conditionMode: readOptionalClauseMode(rawDefinition, 'conditionMode', index),
    target: readOptionalRequestTarget(rawDefinition, index),
    satisfiedEffects: readOptionalSatisfiedEffects(rawDefinition, index),
  };
}

function readRequestLevel(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterRequestLevel {
  const value = readRequiredString(definition, 'level', index);

  if (!includesString(VALID_REQUEST_LEVELS, value)) {
    throw new Error(`Character request definition at index ${index} has invalid level "${value}".`);
  }

  return value;
}

function readRequestKind(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterRequestKind {
  const value = readRequiredString(definition, 'kind', index);

  if (!includesString(VALID_REQUEST_KINDS, value)) {
    throw new Error(`Character request definition at index ${index} has invalid kind "${value}".`);
  }

  return value;
}

function readRequestBaseChance(
  definition: CharacterEventDefinitionRecord,
  index: number,
): number {
  const value = readOptionalProbability(definition, 'baseChance', index);

  if (value === undefined) {
    throw new Error(`Character request definition at index ${index} must include baseChance.`);
  }

  return value;
}

function readOptionalSatisfiedEffects(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterRequestSatisfiedEffect[] | undefined {
  const value = definition.satisfiedEffects;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character request definition at index ${index} has invalid satisfiedEffects.`);
  }

  return value.map(effect => readSatisfiedEffect(effect, index));
}

function readOptionalRequestTarget(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterRequestTarget | undefined {
  const value = definition.target;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character request definition at index ${index} has invalid target.`);
  }

  return {
    targetCharacterId: readOptionalTargetCharacterId(value, index),
    acceptedItemIds: readOptionalStringList(value, 'acceptedItemIds', index),
    acceptedItemTypes: readOptionalStringList(value, 'acceptedItemTypes', index),
    acceptedItemTags: readOptionalStringList(value, 'acceptedItemTags', index),
  };
}

function readOptionalTargetCharacterId(
  target: CharacterEventDefinitionRecord,
  index: number,
): string | undefined {
  const value = target.targetCharacterId;

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character request definition at index ${index} has invalid target.targetCharacterId.`);
  }

  return value;
}

function readSatisfiedEffect(rawEffect: unknown, index: number): CharacterRequestSatisfiedEffect {
  if (!isRecord(rawEffect)) {
    throw new Error(`Character request definition at index ${index} has invalid satisfiedEffects item.`);
  }

  const type = readRequiredString(rawEffect, 'type', index);

  if (!includesString(VALID_SATISFIED_EFFECT_TYPES, type)) {
    throw new Error(`Character request definition at index ${index} has invalid satisfiedEffects.type "${type}".`);
  }

  switch (type) {
    case 'characterMoodValueDelta':
    case 'characterSaturationDelta':
      return {
        type,
        value: readRequiredNumber(rawEffect, 'value', index),
      };
    case 'playerInventoryItem':
      return {
        type,
        itemId: readRequiredString(rawEffect, 'itemId', index),
        amount: readRequiredNonNegativeNumber(rawEffect, 'amount', index),
      };
  }

  throw new Error(`Character request definition at index ${index} has unsupported satisfiedEffects.type "${type}".`);
}

function assertUniqueDefinitionIds(definitions: readonly CharacterRequestDefinition[]): void {
  const seenIds = new Set<string>();

  definitions.forEach(definition => {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate character request definition id "${definition.id}".`);
    }

    seenIds.add(definition.id);
  });
}
