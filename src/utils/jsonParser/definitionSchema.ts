import type {
  CharacterEventAcceptance,
  CharacterEventCooldowns,
  CharacterEventDefinition,
  CharacterEventInterruptPolicy,
  CharacterEventInteractionPresentation,
} from '../../constants/charactarEventsDefinitions';
import { readCharacterEventAction } from './actionSchema';
import {
  readOptionalRuleClauses,
  readOptionalWeightModifiers,
} from './ruleSchema';
import {
  readOptionalPresentationVariants,
  readOptionalTransitionPresentations,
} from './presentationSchema';
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
  readOptionalProbability,
  readOptionalString,
  readRequiredNonNegativeNumber,
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_INTERRUPT_POLICIES = ['none', 'soft', 'always', 'critical'] as const;

// 把 characterEvents.json 轉成強型別 CharacterEventDefinition[] 的 parser + validator
export function loadCharacterEventDefinitions(rawDefinitions: unknown): CharacterEventDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Character event definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => parseCharacterEventDefinition(definition, index));
  assertUniqueDefinitionIds(definitions);

  return definitions;
}

function parseCharacterEventDefinition(
  rawDefinition: unknown,
  index: number,
): CharacterEventDefinition {
  if (!isRecord(rawDefinition)) {
    throw new Error(`Character event definition at index ${index} must be an object.`);
  }

  const id = readRequiredString(rawDefinition, 'id', index);
  const bucketId = readBucketId(rawDefinition, index);
  const motivation = readMotivation(rawDefinition, index);
  const characterEvent = readCharacterEventAction(rawDefinition, index);
  const baseWeight = readRequiredNumber(rawDefinition, 'baseWeight', index);
  const weightSource = readOptionalMotivation(rawDefinition, 'weightSource', index);
  const addWeight = readOptionalNumber(rawDefinition, 'addWeight', index);
  const maxWeight = readOptionalNumber(rawDefinition, 'maxWeight', index);
  const requiresNearbyCharacter = readOptionalBoolean(rawDefinition, 'requiresNearbyCharacter', index);
  const conditionMode = readOptionalClauseMode(rawDefinition, 'conditionMode', index);
  const conditions = readOptionalRuleClauses(rawDefinition, 'conditions', index);
  const weightModifiers = readOptionalWeightModifiers(rawDefinition, 'weightModifiers', index);
  const presentationVariants = readOptionalPresentationVariants(rawDefinition, index);
  const interactionPresentation = readOptionalInteractionPresentation(rawDefinition, index);
  const acceptance = readOptionalAcceptance(rawDefinition, index);
  const cooldowns = readOptionalCooldowns(rawDefinition, index);
  const interruptPolicy = readOptionalInterruptPolicy(rawDefinition, 'interruptPolicy', index);
  const commitment = readOptionalNumber(rawDefinition, 'commitment', index);
  const onInterrupted = readOptionalTransitionPresentations(rawDefinition, 'onInterrupted', index);
  const onInterruptRejected = readOptionalTransitionPresentations(rawDefinition, 'onInterruptRejected', index);

  return {
    id,
    bucketId,
    motivation,
    characterEvent,
    baseWeight,
    weightSource,
    addWeight,
    maxWeight,
    requiresNearbyCharacter,
    conditionMode,
    conditions,
    weightModifiers,
    presentationVariants,
    interactionPresentation,
    acceptance,
    cooldowns,
    interruptPolicy,
    commitment,
    onInterrupted,
    onInterruptRejected,
  };
}

function readOptionalInteractionPresentation(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventInteractionPresentation | undefined {
  const value = definition.interactionPresentation;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid interactionPresentation.`);
  }

  return {
    proposalLine: readOptionalString(value, 'proposalLine', index),
    acceptedLine: readOptionalString(value, 'acceptedLine', index),
    rejectedLine: readOptionalString(value, 'rejectedLine', index),
    endLine: readOptionalString(value, 'endLine', index),
  };
}

function readOptionalAcceptance(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventAcceptance | undefined {
  const value = definition.acceptance;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid acceptance.`);
  }

  return {
    minMoodValue: readOptionalNonNegativeNumber(value, 'minMoodValue', index),
    fallbackChance: readOptionalProbability(value, 'fallbackChance', index),
  };
}

function readOptionalCooldowns(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventCooldowns | undefined {
  const value = definition.cooldowns;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid cooldowns.`);
  }

  return {
    selfMs: readOptionalNonNegativeNumber(value, 'selfMs', index),
    targetMs: readOptionalNonNegativeNumber(value, 'targetMs', index),
    pairMs: readOptionalNonNegativeNumber(value, 'pairMs', index),
    category: readOptionalString(value, 'category', index),
    repeatPenalty: readOptionalRepeatPenalty(value, index),
  };
}

function readOptionalRepeatPenalty(
  cooldowns: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventCooldowns['repeatPenalty'] {
  const value = cooldowns.repeatPenalty;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid cooldowns.repeatPenalty.`);
  }

  const weightMultiplierPerRepeat = readRequiredNonNegativeNumber(value, 'weightMultiplierPerRepeat', index);

  if (weightMultiplierPerRepeat > 1) {
    throw new Error(
      `Character event definition at index ${index} must include cooldowns.repeatPenalty.weightMultiplierPerRepeat <= 1.`,
    );
  }

  return {
    windowMs: readRequiredNonNegativeNumber(value, 'windowMs', index),
    weightMultiplierPerRepeat,
    maxRepeats: readOptionalNonNegativeNumber(value, 'maxRepeats', index),
  };
}

function readOptionalInterruptPolicy(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventInterruptPolicy | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_INTERRUPT_POLICIES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function assertUniqueDefinitionIds(definitions: CharacterEventDefinition[]): void {
  const seenIds = new Set<string>();

  definitions.forEach(definition => {
    if (seenIds.has(definition.id)) {
      throw new Error(`Duplicate character event definition id "${definition.id}".`);
    }

    seenIds.add(definition.id);
  });
}
