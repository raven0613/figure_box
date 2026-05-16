import type { CharacterEventActivity } from '../../constants/charactarEventsDefinitions';
import {
  includesString,
  isRecord,
  readOptionalBoolean,
  readOptionalNonNegativeNumber,
  readRequiredNonNegativeNumber,
  readRequiredString,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_ACTIVITY_TYPES = ['playWithItem', 'playAtLocation'] as const;
const VALID_JOIN_REQUIREMENT_TYPES = ['none', 'hasItem'] as const;

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
    joinable: readOptionalBoolean(value, 'joinable', index),
    durationMs: readRequiredNonNegativeNumber(value, 'durationMs', index),
    refreshDurationOnJoin: readOptionalBoolean(value, 'refreshDurationOnJoin', index),
    joinWindowMs: readOptionalNonNegativeNumber(value, 'joinWindowMs', index),
    joinRequirements: readOptionalJoinRequirement(value, index),
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

