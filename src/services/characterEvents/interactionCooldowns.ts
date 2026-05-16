import type {
  CharacterContext,
  CharacterInteraction,
  CharacterInteractionCooldowns,
} from '~/stateMachines/gameFlow/context';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID, type CharacterEventDefinition } from '../../constants/charactarEventsDefinitions';

const DEFAULT_COOLDOWN_CATEGORY = 'interaction';

export function createEmptyInteractionCooldowns(): CharacterInteractionCooldowns {
  return {
    categoryUntilByKey: {},
    pairUntilByKey: {},
    repeatByKey: {},
  };
}

export function getAvailableInteractionTargetIds(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  targetIds: readonly string[],
  timestamp: number,
): string[] {
  const category = getCooldownCategory(eventDefinition);

  if (isCategoryCoolingDown(context.interactionCooldowns, category, timestamp)) {
    return [];
  }

  return targetIds.filter(targetId => (
    !isPairCoolingDown(context.interactionCooldowns, targetId, category, timestamp)
  ));
}

export function canStartInteractionWithTarget(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  targetId: string,
  timestamp: number,
): boolean {
  return getAvailableInteractionTargetIds(context, eventDefinition, [targetId], timestamp).length > 0;
}

export function getInteractionRepeatWeightMultiplier(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  targetIds: readonly string[],
  timestamp: number,
): number {
  const repeatPenalty = eventDefinition.cooldowns?.repeatPenalty;

  if (!repeatPenalty || targetIds.length === 0) {
    return 1;
  }

  const category = getCooldownCategory(eventDefinition);
  const multipliers = targetIds.map(targetId => {
    const repeatKey = createPairCategoryKey(targetId, category);
    const repeatRecord = context.interactionCooldowns.repeatByKey[repeatKey];

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

export function applyInteractionCooldowns(
  cooldowns: CharacterInteractionCooldowns,
  interaction: CharacterInteraction | null,
  timestamp: number,
  role: 'initiator' | 'target',
): CharacterInteractionCooldowns {
  if (!interaction) {
    return cooldowns;
  }

  const eventDefinition = CHARACTER_EVENT_DEFINITIONS_BY_ID[interaction.sourceEventId];

  if (!eventDefinition?.cooldowns) {
    return cooldowns;
  }

  const category = getCooldownCategory(eventDefinition);
  const ownCooldownMs = role === 'initiator'
    ? eventDefinition.cooldowns.selfMs
    : eventDefinition.cooldowns.targetMs;
  const nextCategoryUntilByKey = ownCooldownMs
    ? {
      ...cooldowns.categoryUntilByKey,
      [category]: timestamp + ownCooldownMs,
    }
    : cooldowns.categoryUntilByKey;
  const pairKey = createPairCategoryKey(interaction.partnerCharId, category);
  const nextPairUntilByKey = eventDefinition.cooldowns.pairMs
    ? {
      ...cooldowns.pairUntilByKey,
      [pairKey]: timestamp + eventDefinition.cooldowns.pairMs,
    }
    : cooldowns.pairUntilByKey;
  const nextRepeatByKey = updateRepeatRecord(cooldowns, pairKey, timestamp, eventDefinition);

  return {
    categoryUntilByKey: nextCategoryUntilByKey,
    pairUntilByKey: nextPairUntilByKey,
    repeatByKey: nextRepeatByKey,
  };
}

function updateRepeatRecord(
  cooldowns: CharacterInteractionCooldowns,
  pairKey: string,
  timestamp: number,
  eventDefinition: CharacterEventDefinition,
) {
  const repeatPenalty = eventDefinition.cooldowns?.repeatPenalty;

  if (!repeatPenalty) {
    return cooldowns.repeatByKey;
  }

  const previousRecord = cooldowns.repeatByKey[pairKey];
  const nextCount = previousRecord && timestamp - previousRecord.lastAt <= repeatPenalty.windowMs
    ? previousRecord.count + 1
    : 1;

  return {
    ...cooldowns.repeatByKey,
    [pairKey]: {
      count: nextCount,
      lastAt: timestamp,
    },
  };
}

function isCategoryCoolingDown(
  cooldowns: CharacterInteractionCooldowns,
  category: string,
  timestamp: number,
): boolean {
  return (cooldowns.categoryUntilByKey[category] ?? 0) > timestamp;
}

function isPairCoolingDown(
  cooldowns: CharacterInteractionCooldowns,
  targetId: string,
  category: string,
  timestamp: number,
): boolean {
  return (cooldowns.pairUntilByKey[createPairCategoryKey(targetId, category)] ?? 0) > timestamp;
}

function getCooldownCategory(eventDefinition: CharacterEventDefinition): string {
  return eventDefinition.cooldowns?.category ?? DEFAULT_COOLDOWN_CATEGORY;
}

function createPairCategoryKey(targetId: string, category: string): string {
  return `${targetId}::${category}`;
}
