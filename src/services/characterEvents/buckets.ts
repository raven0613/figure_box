import type {
  CharacterContext,
  CharacterEventBucketId,
  CharacterUtilityScores,
} from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventCandidate,
  CharacterEventDecisionInput,
} from './types';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_BUCKET,
  type CharacterEventDefinition,
} from './definitions';
import {
  applyCharacterEventWeightModifiers,
  createCharacterEventRuleContext,
  matchesCharacterEventClauses,
} from './rules';
import { createCharacterEventFromAction } from './eventFactory';
import {
  getAvailableInteractionTargetIds,
  getInteractionRepeatWeightMultiplier,
} from './interactionCooldowns';

interface CharacterEventBucket {
  id: CharacterEventBucketId;
  collectCandidates: (params: CharacterEventBucketParams) => CharacterEventCandidate[];
}

interface CharacterEventBucketParams {
  context: CharacterContext;
  utilityScores: CharacterUtilityScores;
  input: CharacterEventDecisionInput;
}

const baselineBucket: CharacterEventBucket = {
  id: 'baseline',
  collectCandidates: params => collectDefinitionCandidates('baseline', params),
};

const needBucket: CharacterEventBucket = {
  id: 'need',
  collectCandidates: params => collectDefinitionCandidates('need', params),
};

const environmentBucket: CharacterEventBucket = {
  id: 'environment',
  collectCandidates: params => collectDefinitionCandidates('environment', params),
};

const globalBucket: CharacterEventBucket = {
  id: 'global',
  collectCandidates: params => {
    if (!params.input.globalEventTags?.length) {
      return [];
    }

    return collectDefinitionCandidates('global', params);
  },
};

const CHARACTER_EVENT_BUCKETS: readonly CharacterEventBucket[] = [
  baselineBucket,
  needBucket,
  environmentBucket,
  globalBucket,
];

export function collectCharacterEventCandidates(
  context: CharacterContext,
  utilityScores: CharacterUtilityScores,
  input: CharacterEventDecisionInput,
): CharacterEventCandidate[] {
  return CHARACTER_EVENT_BUCKETS.flatMap(bucket => (
    bucket.collectCandidates({ context, utilityScores, input })
  )).filter(candidate => candidate.weight > 0);
}

function collectDefinitionCandidates(
  bucketId: CharacterEventBucketId,
  params: CharacterEventBucketParams,
): CharacterEventCandidate[] {
  return CHARACTER_EVENT_DEFINITIONS_BY_BUCKET[bucketId]
    .filter(definition => canUseDefinition(definition, params))
    .map(definition => createCandidate(definition, params))
    .filter((candidate): candidate is CharacterEventCandidate => candidate !== null);
}

function canUseDefinition(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): boolean {
  if (definition.requiresNearbyCharacter && !params.input.nearbyCharacterIds?.length) {
    return false;
  }

  if (definition.characterEvent.type === 'joinActivity' && !params.input.nearbyJoinableActivities?.length) {
    return false;
  }

  return matchesCharacterEventClauses(
    definition.conditions,
    definition.conditionMode,
    createCharacterEventRuleContext(params.context, params.utilityScores, params.input),
  );
}

function createCandidate(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): CharacterEventCandidate | null {
  const event = createCharacterEventFromAction(
    definition.characterEvent,
    createEventFactoryInput(definition, params),
    definition.id,
    params.input.random ?? Math.random,
  );

  if (!event) {
    return null;
  }

  return {
    id: definition.id,
    bucketId: definition.bucketId,
    motivation: definition.motivation,
    event,
    weight: calculateDefinitionWeight(definition, params),
  };
}

function calculateDefinitionWeight(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): number {
  const sourceWeight = definition.weightSource
    ? params.utilityScores[definition.weightSource]
    : definition.baseWeight;
  const rawWeight = Math.max(definition.baseWeight, sourceWeight + (definition.addWeight ?? 0));
  const modifiedWeight = applyCharacterEventWeightModifiers(
    rawWeight,
    definition.weightModifiers,
    createCharacterEventRuleContext(params.context, params.utilityScores, params.input),
  );
  const repeatMultiplier = calculateInteractionRepeatMultiplier(definition, params);
  const weightedValue = modifiedWeight * repeatMultiplier;

  return definition.maxWeight === undefined
    ? weightedValue
    : Math.min(definition.maxWeight, weightedValue);
}

function createEventFactoryInput(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): CharacterEventDecisionInput {
  if (!isInteractionAction(definition)) {
    return params.input;
  }

  return {
    ...params.input,
    nearbyCharacterIds: getAvailableInteractionTargetIds(
      params.context,
      definition,
      params.input.nearbyCharacterIds ?? [],
      params.input.timestamp ?? Date.now(),
    ),
  };
}

function calculateInteractionRepeatMultiplier(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): number {
  if (!isInteractionAction(definition)) {
    return 1;
  }

  const availableTargetIds = getAvailableInteractionTargetIds(
    params.context,
    definition,
    params.input.nearbyCharacterIds ?? [],
    params.input.timestamp ?? Date.now(),
  );

  return getInteractionRepeatWeightMultiplier(
    params.context,
    definition,
    availableTargetIds,
    params.input.timestamp ?? Date.now(),
  );
}

function isInteractionAction(definition: CharacterEventDefinition): boolean {
  return definition.characterEvent.type === 'proposeChat' || definition.characterEvent.type === 'proposePlay';
}
