import { MemoryType } from '~/constants/character';
import { isExpressionPresetId } from '~/constants/expressionCatalog';
import type {
  GossipMemoryTopicDefinition,
  GossipTopicDefinition,
} from '~/typing/gossipTopic';
import {
  includesString,
  isRecord,
  readRequiredNonNegativeNumber,
  readRequiredString,
} from './schemaReaders';

const VALID_MEMORY_TYPES = Object.values(MemoryType);

export function loadGossipTopicDefinitions(rawDefinitions: unknown): GossipTopicDefinition[] {
  return loadDefinitions(rawDefinitions, readGossipTopicDefinition, 'gossip topic');
}

export function loadGossipMemoryTopicDefinitions(
  rawDefinitions: unknown,
): GossipMemoryTopicDefinition[] {
  return loadDefinitions(rawDefinitions, readGossipMemoryTopicDefinition, 'gossip memory topic');
}

function loadDefinitions<T extends { id: string }>(
  rawDefinitions: unknown,
  readDefinition: (value: unknown, index: number) => T,
  label: string,
): T[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error(`${label} definitions must be an array.`);
  }

  const definitions = rawDefinitions.map(readDefinition);
  const ids = new Set<string>();

  definitions.forEach(definition => {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate ${label} id "${definition.id}".`);
    }

    ids.add(definition.id);
  });

  return definitions;
}

function readGossipTopicDefinition(
  value: unknown,
  index: number,
): GossipTopicDefinition {
  const definition = readBaseDefinition(value, index, 'gossip topic');

  return definition;
}

function readGossipMemoryTopicDefinition(
  value: unknown,
  index: number,
): GossipMemoryTopicDefinition {
  const definition = readBaseDefinition(value, index, 'gossip memory topic');

  if (!isRecord(value)) {
    throw new Error(`Gossip memory topic definition at index ${index} must be an object.`);
  }

  const memoryType = readRequiredString(value, 'memoryType', index);

  if (!includesString(VALID_MEMORY_TYPES, memoryType)) {
    throw new Error(
      `Gossip memory topic definition at index ${index} has invalid memoryType.`,
    );
  }

  return {
    ...definition,
    memoryType,
    maxAgeMs: readRequiredNonNegativeNumber(value, 'maxAgeMs', index),
  };
}

function readBaseDefinition(
  value: unknown,
  index: number,
  label: string,
): GossipTopicDefinition {
  if (!isRecord(value)) {
    throw new Error(`${label} definition at index ${index} must be an object.`);
  }

  const expressionPresetId = readRequiredString(value, 'expressionPresetId', index);

  if (!isExpressionPresetId(expressionPresetId)) {
    throw new Error(`${label} definition at index ${index} has invalid expressionPresetId.`);
  }

  return {
    id: readRequiredString(value, 'id', index),
    baseWeight: readRequiredNonNegativeNumber(value, 'baseWeight', index),
    text: readRequiredString(value, 'text', index),
    expressionPresetId,
  };
}
