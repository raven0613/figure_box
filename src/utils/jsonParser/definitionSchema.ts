import type {
  CharacterEventAcceptance,
  CharacterEventCardDefinition,
  CharacterEventCardParticipantMode,
  CharacterEventDefinition,
  CharacterEventInterruptPolicy,
} from '../../constants/charactarEventsDefinitions';
import { Feeling, Mood, SocialStatus } from '../../constants/character';
import { readCharacterEventAction } from './actionSchema';
import { readOptionalOfflineRecap } from './offlineRecapSchema';
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
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_INTERRUPT_POLICIES = ['none', 'soft', 'always', 'critical'] as const;
const VALID_CARD_PARTICIPANT_MODES = ['initiatorTarget'] as const;
const VALID_MOODS = Object.values(Mood) as Mood[];
const VALID_FEELINGS = Object.values(Feeling) as Feeling[];
const VALID_SOCIAL_STATUSES = Object.values(SocialStatus) as SocialStatus[];

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
  const acceptance = readOptionalAcceptance(rawDefinition, index);
  const interruptPolicy = readOptionalInterruptPolicy(rawDefinition, 'interruptPolicy', index);
  const commitment = readOptionalNumber(rawDefinition, 'commitment', index);
  const card = readOptionalCard(rawDefinition, index);
  const offlineRecap = readOptionalOfflineRecap(rawDefinition, index, 'offlineRecap');
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
    acceptance,
    interruptPolicy,
    commitment,
    card,
    offlineRecap,
    onInterrupted,
    onInterruptRejected,
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
    allowedMoods: readOptionalMoodList(value, 'allowedMoods', index),
    relationships: readOptionalRelationshipAcceptanceList(value, index),
    baseChance: readOptionalProbability(value, 'baseChance', index),
    fallbackChance: readOptionalProbability(value, 'fallbackChance', index),
    weightModifiers: readOptionalWeightModifiers(value, 'weightModifiers', index),
  };
}

function readOptionalCard(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventCardDefinition | undefined {
  const value = definition.card;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid card.`);
  }

  return {
    label: readRequiredString(value, 'label', index),
    promptTemplate: readRequiredString(value, 'promptTemplate', index),
    participantMode: readCardParticipantMode(value, index),
    performanceId: readRequiredString(value, 'performanceId', index),
  };
}

function readCardParticipantMode(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventCardParticipantMode {
  const value = readRequiredString(definition, 'participantMode', index);

  if (!includesString(VALID_CARD_PARTICIPANT_MODES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid card.participantMode.`);
  }

  return value;
}

function readOptionalRelationshipAcceptanceList(
  acceptance: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventAcceptance['relationships'] {
  const value = acceptance.relationships;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Character event definition at index ${index} has invalid acceptance.relationships.`);
  }

  return value.map(relationship => ({
    minIntimacy: readOptionalNumber(relationship, 'minIntimacy', index),
    maxIntimacy: readOptionalNumber(relationship, 'maxIntimacy', index),
    allowedFeelings: readOptionalFeelingList(relationship, 'allowedFeelings', index),
    allowedSocialStatuses: readOptionalSocialStatusList(relationship, 'allowedSocialStatuses', index),
  }));
}

function readOptionalMoodList(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): Mood[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every(item => typeof item === 'string' && includesString(VALID_MOODS, item))
  ) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalFeelingList(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): Feeling[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every(item => typeof item === 'string' && includesString(VALID_FEELINGS, item))
  ) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalSocialStatusList(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): SocialStatus[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (
    !Array.isArray(value) ||
    !value.every(item => typeof item === 'string' && includesString(VALID_SOCIAL_STATUSES, item))
  ) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
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
