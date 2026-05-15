import type {
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventAcceptance,
  CharacterEventAction,
  CharacterEventCooldowns,
  CharacterEventDefinition,
  CharacterEventInteractionPresentation,
  CharacterEventInteractionTarget,
  CharacterEventInterruptPolicy,
  CharacterEventPresentationVariant,
  CharacterEventTarget,
  CharacterEventTransitionPresentation,
} from './definitions';
import type {
  CharacterEventClauseMode,
  CharacterEventRuleClause,
  CharacterEventRulePath,
  CharacterEventRuleValue,
  CharacterEventWeightModifier,
} from './rules';
import type { ComparisonOperator } from '~/constants/event';

const VALID_BUCKET_IDS = ['baseline', 'need', 'environment', 'global'] as const;
const VALID_MOTIVATIONS = ['idle', 'findFood', 'rest', 'play', 'chat'] as const;
const VALID_OPERATORS = ['==', '!=', '>', '>=', '<', '<=', 'in', 'includes'] as const;
const VALID_CLAUSE_MODES = ['all', 'some'] as const;
const VALID_CHARACTER_EVENT_TYPES = ['goIdle', 'goRest', 'goPlay', 'goEat', 'proposeChat', 'proposePlay'] as const;
const VALID_INTERRUPT_POLICIES = ['none', 'soft', 'always', 'critical'] as const;

type CharacterEventDefinitionRecord = Record<string, unknown>;

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
  const cooldowns = readOptionalCooldowns(rawDefinition, index);
  const interruptPolicy = readOptionalInterruptPolicy(rawDefinition, 'interruptPolicy', index);
  const commitment = readOptionalNumber(rawDefinition, 'commitment', index);
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
    cooldowns,
    interruptPolicy,
    commitment,
    onInterrupted,
    onInterruptRejected,
  };
}

function readBucketId(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventBucketId {
  const bucketId = readRequiredString(definition, 'bucketId', index);

  if (!includesString(VALID_BUCKET_IDS, bucketId)) {
    throw new Error(`Character event definition at index ${index} has invalid bucketId "${bucketId}".`);
  }

  return bucketId;
}

function readMotivation(
  definition: CharacterEventDefinitionRecord,
  index: number,
): UtilityDrivenMotivation {
  const motivation = readRequiredString(definition, 'motivation', index);

  if (!isUtilityDrivenMotivation(motivation)) {
    throw new Error(`Character event definition at index ${index} has invalid motivation "${motivation}".`);
  }

  return motivation;
}

function readCharacterEventAction(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventAction {
  const rawAction = definition.characterEvent;

  if (!isRecord(rawAction)) {
    throw new Error(`Character event definition at index ${index} must include object characterEvent.`);
  }

  const type = readRequiredString(rawAction, 'type', index);

  if (!includesString(VALID_CHARACTER_EVENT_TYPES, type)) {
    throw new Error(`Character event definition at index ${index} has invalid characterEvent.type "${type}".`);
  }

  if (type === 'goEat') {
    return {
      type,
      target: readCharacterEventTarget(rawAction, index),
    };
  }

  if (type === 'proposeChat' || type === 'proposePlay') {
    return {
      type,
      target: readCharacterEventInteractionTarget(rawAction, index),
    };
  }

  return { type };
}

function readCharacterEventTarget(
  action: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventTarget {
  const target = action.target;

  if (target === 'randomDestination.findFood') {
    return target;
  }

  if (
    isRecord(target)
    && typeof target.x === 'number'
    && Number.isFinite(target.x)
    && typeof target.y === 'number'
    && Number.isFinite(target.y)
  ) {
    return {
      x: target.x,
      y: target.y,
    };
  }

  throw new Error(`Character event definition at index ${index} has invalid characterEvent.target.`);
}

function readCharacterEventInteractionTarget(
  action: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventInteractionTarget {
  const target = action.target;

  if (target === 'randomNearbyCharacter') {
    return target;
  }

  throw new Error(`Character event definition at index ${index} has invalid characterEvent.target.`);
}

function readOptionalMotivation(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): UtilityDrivenMotivation | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !isUtilityDrivenMotivation(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readRequiredString(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string {
  const value = definition[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character event definition at index ${index} must include string ${key}.`);
  }

  return value;
}

function readRequiredNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number {
  const value = definition[key];

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Character event definition at index ${index} must include finite number ${key}.`);
  }

  return value;
}

function readRequiredNonNegativeNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number {
  const value = readRequiredNumber(definition, key, index);

  if (value < 0) {
    throw new Error(`Character event definition at index ${index} must include non-negative number ${key}.`);
  }

  return value;
}

function readOptionalNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalNonNegativeNumber(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = readOptionalNumber(definition, key, index);

  if (value !== undefined && value < 0) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalProbability(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): number | undefined {
  const value = readOptionalNonNegativeNumber(definition, key, index);

  if (value !== undefined && value > 1) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}; expected 0 to 1.`);
  }

  return value;
}

function readOptionalBoolean(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): boolean | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'boolean') {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalClauseMode(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventClauseMode | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || !includesString(VALID_CLAUSE_MODES, value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalRuleClauses(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventRuleClause[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value.map((clause, clauseIndex) => readRuleClause(clause, `${key}[${clauseIndex}]`, index));
}

function readOptionalWeightModifiers(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventWeightModifier[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value.map((modifier, modifierIndex) => {
    const clause = readRuleClause(modifier, `${key}[${modifierIndex}]`, index);

    if (!isRecord(modifier)) {
      throw new Error(`Character event definition at index ${index} has invalid ${key}[${modifierIndex}].`);
    }

    return {
      ...clause,
      add: readOptionalNumber(modifier, 'add', index),
      multiplier: readOptionalNumber(modifier, 'multiplier', index),
    };
  });
}

function readOptionalPresentationVariants(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventPresentationVariant[] | undefined {
  const value = definition.presentationVariants;

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid presentationVariants.`);
  }

  const variants = value.map((variant, variantIndex) => readPresentationVariant(variant, index, variantIndex));
  assertUniquePresentationVariantIds(variants, index);

  return variants;
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
    fallbackChance: readOptionalProbability(value, 'fallbackChance', index),
  };
}

function readOptionalCooldowns(
  definition: CharacterEventDefinitionRecord,
  index: number,
): CharacterEventCooldowns | undefined {
  const value = definition.cooldowns;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid cooldowns.`);
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
): CharacterEventCooldowns['repeatPenalty'] {
  const value = cooldowns.repeatPenalty;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character event definition at index ${index} has invalid cooldowns.repeatPenalty.`);
  }

  const weightMultiplierPerRepeat = readRequiredNonNegativeNumber(value, 'weightMultiplierPerRepeat', index);

  if (weightMultiplierPerRepeat > 1) {
    throw new Error(
      `Character event definition at index ${index} must include cooldowns.repeatPenalty.weightMultiplierPerRepeat <= 1.`,
    );
  }

  return {
    windowMs: readRequiredNonNegativeNumber(value, 'windowMs', index),
    weightMultiplierPerRepeat,
    maxRepeats: readOptionalNonNegativeNumber(value, 'maxRepeats', index),
  };
}

function readOptionalTransitionPresentations(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventTransitionPresentation[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  const presentations = value.map((presentation, presentationIndex) => {
    const variant = readPresentationVariant(presentation, index, presentationIndex);

    if (!isRecord(presentation)) {
      throw new Error(`Character event definition at index ${index} has invalid ${key}[${presentationIndex}].`);
    }

    return {
      ...variant,
      dialogueGroupId: readOptionalString(presentation, 'dialogueGroupId', index),
    };
  });

  assertUniquePresentationVariantIds(presentations, index);
  return presentations;
}

function readPresentationVariant(
  rawVariant: unknown,
  definitionIndex: number,
  variantIndex: number,
): CharacterEventPresentationVariant {
  if (!isRecord(rawVariant)) {
    throw new Error(
      `Character event definition at index ${definitionIndex} has invalid presentationVariants[${variantIndex}].`,
    );
  }

  return {
    id: readRequiredString(rawVariant, 'id', definitionIndex),
    baseWeight: readRequiredNumber(rawVariant, 'baseWeight', definitionIndex),
    conditionMode: readOptionalClauseMode(rawVariant, 'conditionMode', definitionIndex),
    conditions: readOptionalRuleClauses(rawVariant, 'conditions', definitionIndex),
    weightModifiers: readOptionalWeightModifiers(rawVariant, 'weightModifiers', definitionIndex),
    presentationTags: readOptionalStringList(rawVariant, 'presentationTags', definitionIndex),
    performanceId: readOptionalString(rawVariant, 'performanceId', definitionIndex),
  };
}

function readOptionalStringList(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string[] | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    throw new Error(`Character event definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readOptionalString(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): string | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
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

function readRuleClause(
  rawClause: unknown,
  label: string,
  index: number,
): CharacterEventRuleClause {
  if (!isRecord(rawClause)) {
    throw new Error(`Character event definition at index ${index} has invalid ${label}.`);
  }

  return {
    path: readRulePath(rawClause, 'path', index),
    operator: readOperator(rawClause, 'operator', index),
    value: readRuleValue(rawClause, 'value', index),
  };
}

function readRulePath(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventRulePath {
  const value = readRequiredString(definition, key, index);

  if (!value.startsWith('character.') && !value.startsWith('utility.') && !value.startsWith('input.')) {
    throw new Error(`Character event definition at index ${index} has invalid rule path "${value}".`);
  }

  return value as CharacterEventRulePath;
}

function readOperator(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): ComparisonOperator {
  const value = readRequiredString(definition, key, index);

  if (!includesString(VALID_OPERATORS, value)) {
    throw new Error(`Character event definition at index ${index} has invalid operator "${value}".`);
  }

  return value;
}

function readRuleValue(
  definition: CharacterEventDefinitionRecord,
  key: string,
  index: number,
): CharacterEventRuleValue {
  const value = definition[key];

  if (!isRuleValue(value)) {
    throw new Error(`Character event definition at index ${index} has invalid rule value.`);
  }

  return value;
}

function isRecord(value: unknown): value is CharacterEventDefinitionRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isUtilityDrivenMotivation(value: string): value is UtilityDrivenMotivation {
  return includesString(VALID_MOTIVATIONS, value);
}

function isRuleValue(value: unknown): value is CharacterEventRuleValue {
  if (
    typeof value === 'string'
    || typeof value === 'number'
    || typeof value === 'boolean'
    || value === null
  ) {
    return true;
  }

  return Array.isArray(value) && value.every(isRuleValue);
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

function assertUniquePresentationVariantIds(
  variants: CharacterEventPresentationVariant[],
  definitionIndex: number,
): void {
  const seenIds = new Set<string>();

  variants.forEach(variant => {
    if (seenIds.has(variant.id)) {
      throw new Error(
        `Character event definition at index ${definitionIndex} has duplicate presentation variant id "${variant.id}".`,
      );
    }

    seenIds.add(variant.id);
  });
}

function includesString<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return values.some(validValue => validValue === value);
}
