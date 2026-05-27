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
} from '../../constants/charactarEventsDefinitions';
import {
  applyCharacterEventWeightModifiers,
  createCharacterEventRuleContext,
  matchesCharacterEventClauses,
} from './rules';
import { createCharacterEventFromAction } from './eventFactory';
import {
  getActivityRepeatWeightMultiplier,
  getAvailableActivityTargetIds,
} from './activityCooldowns';

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
  const scopedInput = createDefinitionScopedInput(definition, params.input);

  if (definition.requiresNearbyCharacter && !scopedInput.nearbyCharacterIds?.length) {
    return false;
  }

  if (definition.characterEvent.type === 'joinActivity' && !scopedInput.nearbyJoinableActivities?.length) {
    return false;
  }

  return matchesCharacterEventClauses(
    definition.conditions,
    definition.conditionMode,
    createCharacterEventRuleContext(params.context, params.utilityScores, scopedInput),
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
    createCharacterEventRuleContext(
      params.context,
      params.utilityScores,
      createDefinitionScopedInput(definition, params.input),
    ),
  );
  const repeatMultiplier = calculateActivityRepeatMultiplier(definition, params);
  const weightedValue = modifiedWeight * repeatMultiplier;

  return definition.maxWeight === undefined
    ? weightedValue
    : Math.min(definition.maxWeight, weightedValue);
}

function createEventFactoryInput(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): CharacterEventDecisionInput {
  const scopedInput = createDefinitionScopedInput(definition, params.input);

  if (!requiresGroupInviteTarget(definition)) {
    return scopedInput;
  }

  return {
    ...scopedInput,
    nearbyCharacterIds: getAvailableActivityTargetIds(
      params.context,
      definition,
      scopedInput.nearbyCharacterIds ?? [],
      scopedInput.timestamp ?? Date.now(),
    ),
  };
}

function calculateActivityRepeatMultiplier(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): number {
  if (!requiresGroupInviteTarget(definition)) {
    return 1;
  }

  const availableTargetIds = getAvailableActivityTargetIds(
    params.context,
    definition,
    createDefinitionScopedInput(definition, params.input).nearbyCharacterIds ?? [],
    params.input.timestamp ?? Date.now(),
  );

  if (availableTargetIds.length === 0) {
    return 0;
  }

  return getActivityRepeatWeightMultiplier(
    params.context,
    definition,
    availableTargetIds,
    params.input.timestamp ?? Date.now(),
  );
}

function requiresGroupInviteTarget(definition: CharacterEventDefinition): boolean {
  return definition.characterEvent.type === 'startActivity' &&
    definition.presentationVariants?.some(variant => (
      (variant.activity?.group.minParticipants ?? 1) > 1
    )) === true;
}

function createDefinitionScopedInput(
  definition: CharacterEventDefinition,
  input: CharacterEventDecisionInput,
): CharacterEventDecisionInput {
  const range = getDefinitionInviteNearbyRange(definition);

  if (range === null || !input.nearbyCharacterDistances) {
    return input;
  }

  const nearbyCharacterIds = (input.nearbyCharacterIds ?? [])
    .filter(characterId => (input.nearbyCharacterDistances?.[characterId] ?? Number.POSITIVE_INFINITY) <= range);
  const nearbyCharacterIdSet = new Set(nearbyCharacterIds);

  return {
    ...input,
    nearbyCharacterIds,
    nearbyRelationships: input.nearbyRelationships
      ?.filter(relationship => nearbyCharacterIdSet.has(relationship.characterId)),
  };
}

function getDefinitionInviteNearbyRange(definition: CharacterEventDefinition): number | null {
  const ranges = definition.presentationVariants
    ?.map(variant => variant.activity?.group.inviteNearbyRange)
    .filter((range): range is number => range !== undefined) ?? [];

  if (ranges.length === 0) {
    return null;
  }

  return Math.max(...ranges);
}
