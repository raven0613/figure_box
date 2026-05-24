import type {
  WorldEventAudienceDefinition,
  WorldEventDefinition,
} from '~/services/eventOccurrences/worldEventTypes';
import {
  includesString,
  isRecord,
  readRequiredNonNegativeNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_WORLD_EVENT_AUDIENCE_TYPES = ['nearbyCharacters'] as const;

export function loadWorldEventDefinitions(rawDefinitions: unknown): WorldEventDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('World event definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => parseWorldEventDefinition(definition, index));
  assertUniqueWorldEventIds(definitions);

  return definitions;
}

function parseWorldEventDefinition(rawDefinition: unknown, index: number): WorldEventDefinition {
  if (!isRecord(rawDefinition)) {
    throw new Error(`World event definition at index ${index} must be an object.`);
  }

  return {
    id: readRequiredString(rawDefinition, 'id', index),
    audience: readWorldEventAudience(rawDefinition, index),
    characterReaction: readWorldEventCharacterReaction(rawDefinition, index),
  };
}

function readWorldEventAudience(
  definition: CharacterEventDefinitionRecord,
  index: number,
): WorldEventAudienceDefinition {
  const value = definition.audience;

  if (!isRecord(value)) {
    throw new Error(`World event definition at index ${index} must include audience object.`);
  }

  const type = readRequiredString(value, 'type', index);

  if (!includesString(VALID_WORLD_EVENT_AUDIENCE_TYPES, type)) {
    throw new Error(`World event definition at index ${index} has invalid audience.type "${type}".`);
  }

  return {
    type,
    radius: readRequiredNonNegativeNumber(value, 'radius', index),
  };
}

function readWorldEventCharacterReaction(
  definition: CharacterEventDefinitionRecord,
  index: number,
): WorldEventDefinition['characterReaction'] {
  const value = definition.characterReaction;

  if (!isRecord(value)) {
    throw new Error(`World event definition at index ${index} must include characterReaction object.`);
  }

  return {
    performanceId: readRequiredString(value, 'performanceId', index),
  };
}

function assertUniqueWorldEventIds(definitions: readonly WorldEventDefinition[]): void {
  const seenIds = new Set<string>();

  definitions.forEach(definition => {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate world event definition id "${definition.id}".`);
    }

    seenIds.add(definition.id);
  });
}
