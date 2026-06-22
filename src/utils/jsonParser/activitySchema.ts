import type {
  CharacterEventActivity,
  CharacterEventActivityEffects,
  CharacterEventActivityEffectsByRole,
  CharacterEventActivityMemoryEffect,
  CharacterEventActivityRoll,
  CharacterEventActivityRollBranch,
  CharacterEventActivityRollRuleClause,
  CharacterEventActivityRollRulePath,
} from '../../constants/charactarEventsDefinitions';
import type { ComparisonOperator } from '../../constants/event';
import { Feeling, MemoryType, Mood } from '../../constants/character';
import { readOptionalOfflineRecap } from './offlineRecapSchema';
import {
  includesString,
  isRecord,
  readOptionalBoolean,
  readOptionalClauseMode,
  readOptionalNonNegativeNumber,
  readOptionalNumber,
  readOptionalString,
  readOptionalStringList,
  readRequiredNonNegativeNumber,
  readRequiredString,
  isRuleValue,
  type CharacterEventDefinitionRecord,
} from './schemaReaders';

const VALID_ACTIVITY_TYPES = ['chat', 'playWithItem', 'playAtLocation'] as const;
const VALID_ACTIVITY_START_PHASES = ['active', 'traveling'] as const;
const VALID_JOIN_REQUIREMENT_TYPES = ['none', 'hasItem'] as const;
const VALID_ITEM_JOIN_REQUIREMENT_SCOPES = ['joiner', 'host'] as const;
const VALID_FEELINGS = Object.values(Feeling) as Feeling[];
const VALID_MOODS = Object.values(Mood) as Mood[];
const VALID_MEMORY_TYPES = Object.values(MemoryType) as MemoryType[];
const VALID_PARTICIPANT_ROLES = ['initiator', 'target'] as const;
const VALID_OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'includes'] as const;
const TIME_TEXT_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const VALID_RANDOM_ACTIVITY_DESTINATIONS = [
  'randomDestination.play',
  'randomDestination.coffee',
  'randomDestination.sketch',
  'randomDestination.jogging',
  'randomDestination.photography',
] as const;

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
    effectsByRole: readOptionalActivityEffectsByRole(
      value,
      'activity.effectsByRole',
      index,
    ),
    dialogueScriptId: readOptionalString(value, 'dialogueScriptId', index),
    dialogueSubjectSelection: readOptionalDialogueSubjectSelection(value, index),
    rolls: readOptionalActivityRolls(value, index),
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

  return readActivityEffects(value, 'activity.effects', index);
}

function readActivityEffects(
  value: unknown,
  label: string,
  index: number,
): CharacterEventActivityEffects {
  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${label}.`);
  }

  return {
    relationshipIntimacyDelta: readOptionalNumber(value, 'relationshipIntimacyDelta', index),
    relationshipFeelingTarget: readOptionalFeeling(value, 'relationshipFeelingTarget', index),
    moodValueDelta: readOptionalNumber(value, 'moodValueDelta', index),
    moodStageTarget: readOptionalMood(value, 'moodStageTarget', index),
    playNeedDelta: readOptionalNumber(value, 'playNeedDelta', index),
  };
}

function readOptionalActivityEffectsByRole(
  definition: CharacterEventDefinitionRecord,
  label: string,
  index: number,
): CharacterEventActivityEffectsByRole | undefined {
  const value = definition.effectsByRole;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${label}.`);
  }

  const effectsByRole = {
    initiator: value.initiator === undefined
      ? undefined
      : readActivityEffects(value.initiator, `${label}.initiator`, index),
    target: value.target === undefined
      ? undefined
      : readActivityEffects(value.target, `${label}.target`, index),
  };

  if (!effectsByRole.initiator && !effectsByRole.target) {
    throw new Error(`Character event definition at index ${index} has empty ${label}.`);
  }

  return effectsByRole;
}

function readOptionalDialogueSubjectSelection(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['dialogueSubjectSelection'] {
  const value = activity.dialogueSubjectSelection;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(
      `Character event definition at index ${index} has invalid activity.dialogueSubjectSelection.`,
    );
  }

  const sourceRole = readRequiredString(value, 'sourceRole', index);
  const memoryType = readRequiredString(value, 'memoryType', index);

  if (!includesString(VALID_PARTICIPANT_ROLES, sourceRole)) {
    throw new Error(
      `Character event definition at index ${index} has invalid dialogue subject sourceRole.`,
    );
  }

  if (!includesString(VALID_MEMORY_TYPES, memoryType)) {
    throw new Error(
      `Character event definition at index ${index} has invalid dialogue subject memoryType.`,
    );
  }

  return {
    sourceRole,
    memoryType,
    minCount: readRequiredNonNegativeNumber(value, 'minCount', index),
    count: readRequiredPositiveNumber(value, 'count', index),
    excludeParticipants: readOptionalBoolean(value, 'excludeParticipants', index) ?? true,
  };
}

function readOptionalActivityRolls(
  activity: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivity['rolls'] {
  const value = activity.rolls;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`Character event definition at index ${index} has invalid activity.rolls.`);
  }

  const rolls = value.map((roll, rollIndex) => readActivityRoll(roll, rollIndex, index));
  assertUniqueIds(rolls, 'activity.rolls', index);

  return rolls;
}

function readActivityRoll(
  rawRoll: unknown,
  rollIndex: number,
  index: number,
): CharacterEventActivityRoll {
  if (!isRecord(rawRoll)) {
    throw new Error(`Character event definition at index ${index} has invalid activity.rolls[${rollIndex}].`);
  }

  const rawBranches = rawRoll.branches;
  const resolvesActivity = readOptionalBoolean(rawRoll, 'resolvesActivity', index);

  if (!Array.isArray(rawBranches) || rawBranches.length === 0) {
    throw new Error(
      `Character event definition at index ${index} must include non-empty activity.rolls[${rollIndex}].branches.`,
    );
  }

  const branches = rawBranches.map((branch, branchIndex) => (
    readActivityRollBranch(branch, rollIndex, branchIndex, index)
  ));
  assertUniqueIds(branches, `activity.rolls[${rollIndex}].branches`, index);

  if (
    !resolvesActivity
    && branches.some(branch => (
      !branch.resolvesActivity
      && (
        branch.effects !== undefined
        || branch.effectsByRole !== undefined
        || branch.memoryEffects !== undefined
      )
    ))
  ) {
    throw new Error(
      `Character event definition at index ${index} has effects on non-resolving ` +
      `activity.rolls[${rollIndex}].`,
    );
  }

  return {
    id: readRequiredString(rawRoll, 'id', index),
    resolvesActivity,
    branches,
  };
}

function readActivityRollBranch(
  rawBranch: unknown,
  rollIndex: number,
  branchIndex: number,
  index: number,
): CharacterEventActivityRollBranch {
  if (!isRecord(rawBranch)) {
    throw new Error(
      `Character event definition at index ${index} has invalid ` +
      `activity.rolls[${rollIndex}].branches[${branchIndex}].`,
    );
  }

  return {
    id: readRequiredString(rawBranch, 'id', index),
    baseWeight: readRequiredNonNegativeNumber(rawBranch, 'baseWeight', index),
    resolvesActivity: readOptionalBoolean(rawBranch, 'resolvesActivity', index),
    conditionMode: readOptionalClauseMode(rawBranch, 'conditionMode', index),
    conditions: readOptionalActivityRollClauses(rawBranch, 'conditions', index),
    weightModifiers: readOptionalActivityRollWeightModifiers(rawBranch, index),
    performanceId: readOptionalString(rawBranch, 'performanceId', index),
    effects: rawBranch.effects === undefined
      ? undefined
      : readActivityEffects(
        rawBranch.effects,
        `activity.rolls[${rollIndex}].branches[${branchIndex}].effects`,
        index,
      ),
    effectsByRole: readOptionalActivityEffectsByRole(
      rawBranch,
      `activity.rolls[${rollIndex}].branches[${branchIndex}].effectsByRole`,
      index,
    ),
    memoryEffects: readOptionalActivityMemoryEffects(rawBranch, index),
    offlineRecap: readOptionalOfflineRecap(
      rawBranch,
      index,
      `activity.rolls[${rollIndex}].branches[${branchIndex}].offlineRecap`,
    ),
  };
}

function readOptionalActivityMemoryEffects(
  branch: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivityMemoryEffect[] | undefined {
  const value = branch.memoryEffects;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(
      `Character event definition at index ${index} has invalid activity roll memoryEffects.`,
    );
  }

  return value.map((effect, effectIndex) => {
    if (!isRecord(effect)) {
      throw new Error(
        `Character event definition at index ${index} has invalid memoryEffects[${effectIndex}].`,
      );
    }

    const recipientRole = readRequiredString(effect, 'recipientRole', index);
    const target = readRequiredString(effect, 'target', index);
    const memoryType = readRequiredString(effect, 'memoryType', index);
    const startedByRole = readOptionalString(effect, 'startedByRole', index);

    if (
      recipientRole !== 'both'
      && !includesString(VALID_PARTICIPANT_ROLES, recipientRole)
    ) {
      throw new Error(
        `Character event definition at index ${index} has invalid memory effect recipientRole.`,
      );
    }

    if (target !== 'otherParticipant' && target !== 'dialogueSubject') {
      throw new Error(
        `Character event definition at index ${index} has invalid memory effect target.`,
      );
    }

    if (!includesString(VALID_MEMORY_TYPES, memoryType)) {
      throw new Error(
        `Character event definition at index ${index} has invalid memory effect memoryType.`,
      );
    }

    if (
      startedByRole !== undefined
      && !includesString(VALID_PARTICIPANT_ROLES, startedByRole)
    ) {
      throw new Error(
        `Character event definition at index ${index} has invalid memory effect startedByRole.`,
      );
    }

    return {
      recipientRole,
      target,
      memoryType,
      countDelta: readRequiredPositiveNumber(effect, 'countDelta', index),
      startedByRole,
    };
  });
}

function readRequiredPositiveNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number {
  const value = readRequiredNonNegativeNumber(definition, key, index);

  if (value <= 0) {
    throw new Error(
      `Character event definition at index ${index} requires positive ${key}.`,
    );
  }

  return value;
}

function readOptionalActivityRollClauses(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventActivityRollRuleClause[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll ${key}.`);
  }

  return value.map((clause, clauseIndex) => (
    readActivityRollClause(clause, `${key}[${clauseIndex}]`, index)
  ));
}

function readOptionalActivityRollWeightModifiers(
  branch: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivityRollBranch['weightModifiers'] {
  const value = branch.weightModifiers;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll weightModifiers.`);
  }

  return value.map((modifier, modifierIndex) => {
    if (!isRecord(modifier)) {
      throw new Error(
        `Character event definition at index ${index} has invalid activity roll ` +
        `weightModifiers[${modifierIndex}].`,
      );
    }

    return {
      ...readActivityRollClause(modifier, `weightModifiers[${modifierIndex}]`, index),
      add: readOptionalNumber(modifier, 'add', index),
      multiplier: readOptionalNumber(modifier, 'multiplier', index),
    };
  });
}

function readActivityRollClause(
  rawClause: unknown,
  label: string,
  index: number,
): CharacterEventActivityRollRuleClause {
  if (!isRecord(rawClause)) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll ${label}.`);
  }

  return {
    path: readActivityRollRulePath(rawClause, index),
    operator: readActivityRollOperator(rawClause, index),
    value: readActivityRollRuleValue(rawClause, index),
  };
}

function readActivityRollRulePath(
  clause: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivityRollRulePath {
  const value = readRequiredString(clause, 'path', index);

  if (
    !value.startsWith('initiator.') &&
    !value.startsWith('target.') &&
    !value.startsWith('activity.')
  ) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll path "${value}".`);
  }

  return value as CharacterEventActivityRollRulePath;
}

function readActivityRollOperator(
  clause: CharacterEventDefinitionRecord,
  index: number,
): ComparisonOperator {
  const value = readRequiredString(clause, 'operator', index);

  if (!includesString(VALID_OPERATORS, value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll operator "${value}".`);
  }

  return value;
}

function readActivityRollRuleValue(
  clause: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventActivityRollRuleClause['value'] {
  const value = clause.value;

  if (!isRuleValue(value)) {
    throw new Error(`Character event definition at index ${index} has invalid activity roll rule value.`);
  }

  return value;
}

function assertUniqueIds(
  entries: readonly { id: string }[],
  label: string,
  index: number,
): void {
  const seenIds = new Set<string>();

  entries.forEach(entry => {
    if (seenIds.has(entry.id)) {
      throw new Error(
        `Character event definition at index ${index} has duplicate ${label} id "${entry.id}".`,
      );
    }

    seenIds.add(entry.id);
  });
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

  if (
    typeof value === 'string' &&
    includesString(VALID_RANDOM_ACTIVITY_DESTINATIONS, value)
  ) {
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

  const scope = readOptionalString(value, 'scope', index);

  if (scope !== undefined && !includesString(VALID_ITEM_JOIN_REQUIREMENT_SCOPES, scope)) {
    throw new Error(
      `Character event definition at index ${index} has invalid activity.joinRequirements.scope "${scope}".`,
    );
  }

  return {
    type,
    itemId: readRequiredString(value, 'itemId', index),
    scope,
  };
}
