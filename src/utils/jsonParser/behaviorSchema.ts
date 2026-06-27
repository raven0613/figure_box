import type {
  CharacterBehaviorDefinition,
  CharacterBehaviorTarget,
  CharacterBehaviorType,
} from '~/constants/characterBehaviorDefinitions';
import {
  readOptionalRuleClauses,
  readOptionalWeightModifiers,
} from './ruleSchema';
import {
  includesString,
  isRecord,
  readBucketId,
  readMotivation,
  readOptionalBoolean,
  readOptionalClauseMode,
  readOptionalMotivation,
  readOptionalNonNegativeNumber,
  readOptionalNumber,
  readOptionalStringList,
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_BEHAVIOR_TYPES = ['stroll', 'idleMoment', 'observe', 'sit'] as const;
const VALID_BEHAVIOR_TARGETS = ['randomMap', 'nearbyObservableObject'] as const;

export function loadCharacterBehaviorDefinitions(rawDefinitions: unknown): CharacterBehaviorDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Character behavior definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => (
    parseCharacterBehaviorDefinition(definition, index)
  ));
  assertUniqueDefinitionIds(definitions);

  return definitions;
}

function parseCharacterBehaviorDefinition(
  rawDefinition: unknown,
  index: number,
): CharacterBehaviorDefinition {
  if (!isRecord(rawDefinition)) {
    throw new Error(`Character behavior definition at index ${index} must be an object.`);
  }

  return {
    id: readRequiredString(rawDefinition, 'id', index),
    bucketId: readBucketId(rawDefinition, index),
    motivation: readMotivation(rawDefinition, index),
    type: readBehaviorType(rawDefinition, index),
    baseWeight: readRequiredNumber(rawDefinition, 'baseWeight', index),
    weightSource: readOptionalMotivation(rawDefinition, 'weightSource', index),
    addWeight: readOptionalNumber(rawDefinition, 'addWeight', index),
    maxWeight: readOptionalNumber(rawDefinition, 'maxWeight', index),
    tickable: readOptionalBoolean(rawDefinition, 'tickable', index) ?? true,
    durationMs: readOptionalNonNegativeNumber(rawDefinition, 'durationMs', index),
    target: readOptionalBehaviorTarget(rawDefinition, index),
    conditionMode: readOptionalClauseMode(rawDefinition, 'conditionMode', index),
    conditions: readOptionalRuleClauses(rawDefinition, 'conditions', index),
    weightModifiers: readOptionalWeightModifiers(rawDefinition, 'weightModifiers', index),
    presentationTags: readOptionalStringList(rawDefinition, 'presentationTags', index),
  };
}

function readBehaviorType(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterBehaviorType {
  const value = readRequiredString(definition, 'type', index);

  if (!includesString(VALID_BEHAVIOR_TYPES, value)) {
    throw new Error(`Character behavior definition at index ${index} has invalid type "${value}".`);
  }

  return value;
}

function readOptionalBehaviorTarget(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterBehaviorTarget | undefined {
  const value = definition.target;

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_BEHAVIOR_TARGETS, value)) {
    throw new Error(`Character behavior definition at index ${index} has invalid target.`);
  }

  return value;
}

function assertUniqueDefinitionIds(definitions: CharacterBehaviorDefinition[]): void {
  const seenIds = new Set<string>();

  definitions.forEach(definition => {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate character behavior definition id "${definition.id}".`);
    }

    seenIds.add(definition.id);
  });
}
