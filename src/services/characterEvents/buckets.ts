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
  type CharacterEventActivity,
  type CharacterEventDefinition,
} from '../../constants/charactarEventsDefinitions';
import {
  CHARACTER_BEHAVIOR_DEFINITIONS_BY_BUCKET,
  type CharacterBehaviorDefinition,
} from '~/constants/characterBehaviorDefinitions';
import {
  applyCharacterEventWeightModifiers,
  createCharacterEventRuleContext,
  matchesCharacterEventClauses,
} from './rules';
import {
  createCharacterBehaviorEvent,
  createCharacterEventFromAction,
} from './eventFactory';
import {
  getActivityCommonCooldownWeightMultiplier,
  getActivityRepeatWeightMultiplier,
  getAvailableActivityTargetIds,
} from './activityCooldowns';
import { getDefinitionNearbyCharacterRange } from './nearbyCharacterRange';
import { getSocialOpportunityWeightMultiplier } from './socialOpportunity';

interface CharacterEventBucket {
  id: CharacterEventBucketId;
  collectCandidates: (params: CharacterEventBucketParams) => CharacterEventCandidate[];
}

interface CharacterEventBucketParams {
  context: CharacterContext;
  utilityScores: CharacterUtilityScores;
  input: CharacterEventDecisionInput;
}

interface CharacterEventCandidateWeight {
  weight: number;
  motivationWeightMultiplier?: number;
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
    [
      ...bucket.collectCandidates({ context, utilityScores, input }),
      ...collectBehaviorCandidates(bucket.id, { context, utilityScores, input }),
    ]
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

  const candidateWeight = calculateDefinitionWeight(definition, params);

  return {
    id: definition.id,
    bucketId: definition.bucketId,
    motivation: definition.motivation,
    event,
    weight: candidateWeight.weight,
    ...(candidateWeight.motivationWeightMultiplier === undefined
      ? {}
      : { motivationWeightMultiplier: candidateWeight.motivationWeightMultiplier }),
  };
}

function calculateDefinitionWeight(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): CharacterEventCandidateWeight {
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
  const commonCooldownMultiplier = isActivityDefinition(definition)
    ? getActivityCommonCooldownWeightMultiplier(
      params.context,
      params.input.timestamp ?? Date.now(),
    )
    : 1;
  const socialOpportunityMultiplier = calculateSocialOpportunityMultiplier(definition, params);
  const weightedValue = modifiedWeight *
    repeatMultiplier *
    commonCooldownMultiplier *
    socialOpportunityMultiplier;
  const weight = definition.maxWeight === undefined
    ? weightedValue
    : Math.min(definition.maxWeight, weightedValue);

  if (socialOpportunityMultiplier <= 1) {
    return { weight };
  }

  return {
    weight,
    motivationWeightMultiplier: socialOpportunityMultiplier,
  };
}

function collectBehaviorCandidates(
  bucketId: CharacterEventBucketId,
  params: CharacterEventBucketParams,
): CharacterEventCandidate[] {
  return CHARACTER_BEHAVIOR_DEFINITIONS_BY_BUCKET[bucketId]
    .filter(definition => canUseBehaviorDefinition(definition, params))
    .map(definition => createBehaviorCandidate(definition, params))
    .filter((candidate): candidate is CharacterEventCandidate => candidate !== null);
}

function canUseBehaviorDefinition(
  definition: CharacterBehaviorDefinition,
  params: CharacterEventBucketParams,
): boolean {
  return matchesCharacterEventClauses(
    definition.conditions,
    definition.conditionMode,
    createCharacterEventRuleContext(params.context, params.utilityScores, params.input),
  );
}

function createBehaviorCandidate(
  definition: CharacterBehaviorDefinition,
  params: CharacterEventBucketParams,
): CharacterEventCandidate | null {
  const event = createCharacterBehaviorEvent(
    definition,
    params.context,
    params.input,
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
    weight: calculateBehaviorWeight(definition, params),
  };
}

function calculateBehaviorWeight(
  definition: CharacterBehaviorDefinition,
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

  return definition.maxWeight === undefined
    ? modifiedWeight
    : Math.min(definition.maxWeight, modifiedWeight);
}

function isActivityDefinition(definition: CharacterEventDefinition): boolean {
  return definition.characterEvent.type === 'joinActivity' ||
    definition.presentationVariants?.some(variant => variant.activity) === true;
}

function createEventFactoryInput(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): CharacterEventDecisionInput {
  const scopedInput = createDefinitionScopedInput(definition, params.input);

  if (!requiresRequiredInviteeTarget(definition)) {
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
  if (!canInviteNearbyCharacters(definition)) {
    return 1;
  }

  const availableTargetIds = getAvailableActivityTargetIds(
    params.context,
    definition,
    createDefinitionScopedInput(definition, params.input).nearbyCharacterIds ?? [],
    params.input.timestamp ?? Date.now(),
  );

  if (availableTargetIds.length === 0) {
    return requiresRequiredInviteeTarget(definition) ? 0 : 1;
  }

  return getActivityRepeatWeightMultiplier(
    params.context,
    definition,
    availableTargetIds,
    params.input.timestamp ?? Date.now(),
  );
}

function calculateSocialOpportunityMultiplier(
  definition: CharacterEventDefinition,
  params: CharacterEventBucketParams,
): number {
  if (!canInviteNearbyCharacters(definition)) {
    return 1;
  }

  const scopedInput = createDefinitionScopedInput(definition, params.input);
  const availableTargetIds = getAvailableActivityTargetIds(
    params.context,
    definition,
    scopedInput.nearbyCharacterIds ?? [],
    scopedInput.timestamp ?? Date.now(),
  );
  const availableTargetIdSet = new Set(availableTargetIds);
  const availableRelationships = (scopedInput.nearbyRelationships ?? [])
    .filter(relationship => availableTargetIdSet.has(relationship.characterId));

  return getSocialOpportunityWeightMultiplier(availableRelationships);
}

function requiresRequiredInviteeTarget(definition: CharacterEventDefinition): boolean {
  return definition.characterEvent.type === 'startActivity' &&
    definition.presentationVariants?.some(variant => (
      (variant.activity?.group.minParticipants ?? 1) > 1
    )) === true;
}

function canInviteNearbyCharacters(definition: CharacterEventDefinition): boolean {
  return definition.characterEvent.type === 'startActivity' &&
    definition.presentationVariants?.some(variant => (
      variant.activity !== undefined &&
      getActivityMaxParticipants(variant.activity) > 1
    )) === true;
}

function getActivityMaxParticipants(activity: CharacterEventActivity): number {
  const minParticipants = activity.group.minParticipants ?? 1;

  return Math.max(minParticipants, activity.group.maxParticipants ?? minParticipants);
}

function createDefinitionScopedInput(
  definition: CharacterEventDefinition,
  input: CharacterEventDecisionInput,
): CharacterEventDecisionInput {
  if (!input.nearbyCharacterDistances) {
    return input;
  }

  const range = getDefinitionNearbyCharacterRange(definition);
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
