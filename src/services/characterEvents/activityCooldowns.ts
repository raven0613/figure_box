import type {
  CharacterActivityCooldowns,
  CharacterContext,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventCooldowns,
  type CharacterEventDefinition,
} from '../../constants/charactarEventsDefinitions';

export interface ActivityCooldownRecordInput {
  partnerCharIds: readonly string[];
  role: 'initiator' | 'target';
  sourceEventId: string;
  timestamp: number;
}

const DEFAULT_COOLDOWN_CATEGORY = 'activity';
const COMMON_ACTIVITY_COOLDOWN_WEIGHT_MULTIPLIER = 0.25;
const POST_ACTIVITY_IDLE_MOTIVATION_WEIGHT = 120;
const POST_ACTIVITY_NON_IDLE_MOTIVATION_WEIGHT_MULTIPLIER = 0.2;

export function createEmptyActivityCooldowns(): CharacterActivityCooldowns {
  return {
    commonUntil: 0,
    categoryUntilByKey: {},
    pairUntilByKey: {},
    repeatByKey: {},
  };
}

export function getActivityCommonCooldownWeightMultiplier(
  context: CharacterContext,
  timestamp: number,
): number {
  return context.activityCooldowns.commonUntil > timestamp
    ? COMMON_ACTIVITY_COOLDOWN_WEIGHT_MULTIPLIER
    : 1;
}

export function getActivityCooldownMotivationWeight(
  context: CharacterContext,
  motivation: UtilityDrivenMotivation,
  baseWeight: number,
  timestamp: number,
): number {
  if (context.activityCooldowns.commonUntil <= timestamp) {
    return baseWeight;
  }

  if (motivation === 'idle') {
    return Math.max(baseWeight, POST_ACTIVITY_IDLE_MOTIVATION_WEIGHT);
  }

  if (motivation === 'findFood') {
    return baseWeight;
  }

  return baseWeight * POST_ACTIVITY_NON_IDLE_MOTIVATION_WEIGHT_MULTIPLIER;
}

export function isActivityDefinitionCoolingDown(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  timestamp: number,
): boolean {
  const category = getCooldownCategory(eventDefinition);

  return context.activityCooldowns.commonUntil > timestamp ||
    isCategoryCoolingDown(context.activityCooldowns, category, timestamp);
}

export function getAvailableActivityTargetIds(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  targetIds: readonly string[],
  timestamp: number,
): string[] {
  const category = getCooldownCategory(eventDefinition);

  if (isCategoryCoolingDown(context.activityCooldowns, category, timestamp)) {
    return [];
  }

  return targetIds.filter(targetId => (
    !isPairCoolingDown(context.activityCooldowns, targetId, category, timestamp)
  ));
}

export function getActivityRepeatWeightMultiplier(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  targetIds: readonly string[],
  timestamp: number,
): number {
  const cooldowns = getDefinitionActivityCooldowns(eventDefinition);
  const repeatPenalty = cooldowns?.repeatPenalty;

  if (!repeatPenalty || targetIds.length === 0) {
    return 1;
  }

  const category = getCooldownCategory(eventDefinition);
  const multipliers = targetIds.map(targetId => {
    const repeatKey = createPairCategoryKey(targetId, category);
    const repeatRecord = context.activityCooldowns.repeatByKey[repeatKey];

    if (!repeatRecord || timestamp - repeatRecord.lastAt > repeatPenalty.windowMs) {
      return 1;
    }

    const repeatCount = repeatPenalty.maxRepeats === undefined
      ? repeatRecord.count
      : Math.min(repeatRecord.count, repeatPenalty.maxRepeats);

    return Math.pow(repeatPenalty.weightMultiplierPerRepeat, repeatCount);
  });

  return multipliers.reduce((sum, multiplier) => sum + multiplier, 0) / multipliers.length;
}

export function recordActivityCooldowns(
  cooldowns: CharacterActivityCooldowns,
  input: ActivityCooldownRecordInput,
): CharacterActivityCooldowns {
  const eventDefinition = CHARACTER_EVENT_DEFINITIONS_BY_ID[input.sourceEventId];
  const activityCooldowns = eventDefinition
    ? getDefinitionActivityCooldowns(eventDefinition)
    : undefined;

  if (!eventDefinition || !activityCooldowns) {
    return cooldowns;
  }

  const category = getCooldownCategory(eventDefinition);
  const commonUntil = activityCooldowns.commonMs
    ? Math.max(cooldowns.commonUntil, input.timestamp + activityCooldowns.commonMs)
    : cooldowns.commonUntil;
  const ownCooldownMs = input.role === 'initiator'
    ? activityCooldowns.selfMs
    : activityCooldowns.targetMs;
  const categoryUntilByKey = ownCooldownMs
    ? {
      ...cooldowns.categoryUntilByKey,
      [category]: input.timestamp + ownCooldownMs,
    }
    : cooldowns.categoryUntilByKey;
  const pairCooldownMs = activityCooldowns.pairMs;
  const pairUntilByKey = pairCooldownMs
    ? input.partnerCharIds.reduce<Record<string, number>>(
      (nextPairUntilByKey, partnerCharId) => ({
        ...nextPairUntilByKey,
        [createPairCategoryKey(partnerCharId, category)]: input.timestamp + pairCooldownMs,
      }),
      cooldowns.pairUntilByKey,
    )
    : cooldowns.pairUntilByKey;
  const repeatByKey = input.partnerCharIds.reduce(
    (nextRepeatByKey, partnerCharId) => updateRepeatRecord(
      nextRepeatByKey,
      createPairCategoryKey(partnerCharId, category),
      input.timestamp,
      eventDefinition,
    ),
    cooldowns.repeatByKey,
  );

  return {
    commonUntil,
    categoryUntilByKey,
    pairUntilByKey,
    repeatByKey,
  };
}

function updateRepeatRecord(
  repeatByKey: CharacterActivityCooldowns['repeatByKey'],
  pairKey: string,
  timestamp: number,
  eventDefinition: CharacterEventDefinition,
) {
  const repeatPenalty = getDefinitionActivityCooldowns(eventDefinition)?.repeatPenalty;

  if (!repeatPenalty) {
    return repeatByKey;
  }

  const previousRecord = repeatByKey[pairKey];
  const nextCount = previousRecord && timestamp - previousRecord.lastAt <= repeatPenalty.windowMs
    ? previousRecord.count + 1
    : 1;

  return {
    ...repeatByKey,
    [pairKey]: {
      count: nextCount,
      lastAt: timestamp,
    },
  };
}

function isCategoryCoolingDown(
  cooldowns: CharacterActivityCooldowns,
  category: string,
  timestamp: number,
): boolean {
  return (cooldowns.categoryUntilByKey[category] ?? 0) > timestamp;
}

function isPairCoolingDown(
  cooldowns: CharacterActivityCooldowns,
  targetId: string,
  category: string,
  timestamp: number,
): boolean {
  return (cooldowns.pairUntilByKey[createPairCategoryKey(targetId, category)] ?? 0) > timestamp;
}

function getCooldownCategory(eventDefinition: CharacterEventDefinition): string {
  return getDefinitionActivityCooldowns(eventDefinition)?.category ?? DEFAULT_COOLDOWN_CATEGORY;
}

function createPairCategoryKey(targetId: string, category: string): string {
  return `${targetId}::${category}`;
}

function getDefinitionActivityCooldowns(
  eventDefinition: CharacterEventDefinition,
): CharacterEventCooldowns | undefined {
  return eventDefinition.presentationVariants
    ?.map(variant => variant.activity)
    .find((activity): activity is CharacterEventActivity => activity !== undefined)
    ?.cooldowns;
}
