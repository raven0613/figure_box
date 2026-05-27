import type {
  CharacterEventAcceptance,
  CharacterEventDefinition,
  CharacterEventInterruptPolicy,
  CharacterEventInteractionPresentation,
} from '../../constants/charactarEventsDefinitions';
import type { OfflineRecapTemplate } from '~/services/offlineSimulation/types';
import { Feeling, Mood, SocialStatus } from '../../constants/character';
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
  readRequiredNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_INTERRUPT_POLICIES = ['none', 'soft', 'always', 'critical'] as const;
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
  const interactionPresentation = readOptionalInteractionPresentation(rawDefinition, index);
  const acceptance = readOptionalAcceptance(rawDefinition, index);
  const interruptPolicy = readOptionalInterruptPolicy(rawDefinition, 'interruptPolicy', index);
  const commitment = readOptionalNumber(rawDefinition, 'commitment', index);
  const offlineRecap = readOptionalOfflineRecap(rawDefinition, index);
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
    interruptPolicy,
    commitment,
    offlineRecap,
    onInterrupted,
    onInterruptRejected,
  };
}

function readOptionalOfflineRecap(
  definition: CharacterEventDefinitionRecord,
  index: number,
): OfflineRecapTemplate | undefined {
  const value = definition.offlineRecap;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid offlineRecap.`);
  }

  const offlineRecap = {
    summary: readOptionalString(value, 'summary', index),
    detail: readOptionalString(value, 'detail', index),
    quote: readOptionalString(value, 'quote', index),
    priority: readOptionalNumber(value, 'priority', index),
    sequenceKey: readOptionalString(value, 'sequenceKey', index),
    sequenceOrder: readOptionalNumber(value, 'sequenceOrder', index),
  };

  if (
    !offlineRecap.summary &&
    !offlineRecap.detail &&
    !offlineRecap.quote &&
    offlineRecap.priority === undefined &&
    !offlineRecap.sequenceKey &&
    offlineRecap.sequenceOrder === undefined
  ) {
    throw new Error(`Character event definition at index ${index} has empty offlineRecap.`);
  }

  return offlineRecap;
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
    allowedMoods: readOptionalMoodList(value, 'allowedMoods', index),
    relationships: readOptionalRelationshipAcceptanceList(value, index),
    fallbackChance: readOptionalProbability(value, 'fallbackChance', index),
  };
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
