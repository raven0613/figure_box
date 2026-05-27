import type { CharacterEventActivity } from '../../constants/charactarEventsDefinitions';
import { Feeling, Mood } from '../../constants/character';
import {
  includesString,
  isRecord,
  readOptionalBoolean,
  readOptionalNonNegativeNumber,
  readOptionalNumber,
  readOptionalString,
  readOptionalStringList,
  readRequiredNonNegativeNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_ACTIVITY_TYPES = ['chat', 'playWithItem', 'playAtLocation'] as const;
const VALID_ACTIVITY_START_PHASES = ['active', 'traveling'] as const;
const VALID_JOIN_REQUIREMENT_TYPES = ['none', 'hasItem'] as const;
const VALID_FEELINGS = Object.values(Feeling) as Feeling[];
const VALID_MOODS = Object.values(Mood) as Mood[];
const TIME_TEXT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

// activity / joinRequirements parser
export function readOptionalActivity(
  variant: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity | undefined {
  const value = variant.activity;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid presentationVariants.activity.`);
  }

  return {
    key: readRequiredString(value, 'key', index),
    type: readActivityType(value, index),
    startPhase: readOptionalStartPhase(value, index),
    destination: readOptionalDestination(value, index),
    availability: readOptionalActivityAvailability(value, index),
    group: readRequiredGroupActivity(value, index),
    joinable: readOptionalBoolean(value, 'joinable', index),
    durationMs: readRequiredNonNegativeNumber(value, 'durationMs', index),
    refreshDurationOnJoin: readOptionalBoolean(value, 'refreshDurationOnJoin', index),
    joinWindowMs: readOptionalNonNegativeNumber(value, 'joinWindowMs', index),
    joinRequirements: readOptionalJoinRequirement(value, index),
    cooldowns: readRequiredCooldowns(value, index),
    effects: readOptionalActivityEffects(value, index),
  };
}

function readOptionalActivityAvailability(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['availability'] {
  const value = activity.availability;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.availability.`);
  }

  const availability = {
    timeOfDay: readOptionalStringList(value, 'timeOfDay', index),
    timeWindows: readOptionalTimeWindows(value, index),
  };

  if (!availability.timeOfDay?.length && !availability.timeWindows?.length) {
    throw new Error(`Character event definition at index ${index} has empty activity.availability.`);
  }

  return availability;
}

function readOptionalTimeWindows(
  availability: CharacterEventDefinitionRecord,
  index: number,
): NonNullable<CharacterEventActivity['availability']>['timeWindows'] {
  const value = availability.timeWindows;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.availability.timeWindows.`);
  }

  return value.map((window, windowIndex) => {
    const fromMinute = readTimeTextAsMinute(
      readRequiredString(window, 'from', index),
      `activity.availability.timeWindows[${String(windowIndex)}].from`,
      index,
    );
    const toMinute = readTimeTextAsMinute(
      readRequiredString(window, 'to', index),
      `activity.availability.timeWindows[${String(windowIndex)}].to`,
      index,
    );

    if (fromMinute === toMinute) {
      throw new Error(`Character event definition at index ${index} has empty activity.availability.timeWindows[${String(windowIndex)}].`);
    }

    return {
      fromMinute,
      toMinute,
    };
  });
}

function readTimeTextAsMinute(
  value: string,
  label: string,
  index: number,
): number {
  const match = TIME_TEXT_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Character event definition at index ${index} has invalid ${label}; expected HH:mm.`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  return hours * 60 + minutes;
}

function readOptionalActivityEffects(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['effects'] {
  const value = activity.effects;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.effects.`);
  }

  return {
    relationshipIntimacyDelta: readOptionalNumber(value, 'relationshipIntimacyDelta', index),
    relationshipFeelingTarget: readOptionalFeeling(value, 'relationshipFeelingTarget', index),
    moodValueDelta: readOptionalNumber(value, 'moodValueDelta', index),
    moodStageTarget: readOptionalMood(value, 'moodStageTarget', index),
    playNeedDelta: readOptionalNumber(value, 'playNeedDelta', index),
  };
}

function readOptionalFeeling(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): Feeling | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_FEELINGS, value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalMood(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): Mood | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_MOODS, value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalStartPhase(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['startPhase'] {
  const value = activity.startPhase;

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_ACTIVITY_START_PHASES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.startPhase.`);
  }

  return value;
}

function readOptionalDestination(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['destination'] {
  const value = activity.destination;

  if (value === undefined) {
    return undefined;
  }

  if (value === 'randomDestination.play') {
    return value;
  }

  if (
    isRecord(value) &&
    typeof value.x === 'number' &&
    Number.isFinite(value.x) &&
    typeof value.y === 'number' &&
    Number.isFinite(value.y)
  ) {
    return {
      x: value.x,
      y: value.y,
    };
  }

  throw new Error(`Character event definition at index ${index} has invalid activity.destination.`);
}

function readRequiredGroupActivity(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['group'] {
  const value = activity.group;

  if (value === undefined) {
    throw new Error(`Character event definition at index ${index} is missing activity.group.`);
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.group.`);
  }

  const group = {
    inviteNearbyRange: readOptionalNonNegativeNumber(value, 'inviteNearbyRange', index),
    minParticipants: readOptionalNonNegativeNumber(value, 'minParticipants', index),
    maxParticipants: readOptionalNonNegativeNumber(value, 'maxParticipants', index),
  };

  if (
    group.minParticipants !== undefined &&
    group.maxParticipants !== undefined &&
    group.minParticipants > group.maxParticipants
  ) {
    throw new Error(`Character event definition at index ${index} has invalid activity.group participant range.`);
  }

  return group;
}

function readRequiredCooldowns(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['cooldowns'] {
  const value = activity.cooldowns;

  if (value === undefined) {
    throw new Error(`Character event definition at index ${index} is missing activity.cooldowns.`);
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.cooldowns.`);
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
): CharacterEventActivity['cooldowns']['repeatPenalty'] {
  const value = cooldowns.repeatPenalty;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.cooldowns.repeatPenalty.`);
  }

  const weightMultiplierPerRepeat = readRequiredNonNegativeNumber(value, 'weightMultiplierPerRepeat', index);

  if (weightMultiplierPerRepeat > 1) {
    throw new Error(
      `Character event definition at index ${index} must include activity.cooldowns.repeatPenalty.weightMultiplierPerRepeat <= 1.`,
    );
  }

  return {
    windowMs: readRequiredNonNegativeNumber(value, 'windowMs', index),
    weightMultiplierPerRepeat,
    maxRepeats: readOptionalNonNegativeNumber(value, 'maxRepeats', index),
  };
}

function readActivityType(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['type'] {
  const value = readRequiredString(activity, 'type', index);

  if (!includesString(VALID_ACTIVITY_TYPES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.type "${value}".`);
  }

  return value;
}

function readOptionalJoinRequirement(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['joinRequirements'] {
  const value = activity.joinRequirements;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.joinRequirements.`);
  }

  const type = readRequiredString(value, 'type', index);

  if (!includesString(VALID_JOIN_REQUIREMENT_TYPES, type)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.joinRequirements.type "${type}".`);
  }

  if (type === 'none') {
    return { type };
  }

  return {
    type,
    itemId: readRequiredString(value, 'itemId', index),
  };
}
