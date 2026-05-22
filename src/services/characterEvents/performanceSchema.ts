import type {
  CharacterPerformanceDefinition,
  CharacterPerformanceAnimationTarget,
  CharacterPerformanceParticipantCountCondition,
  CharacterPerformancePhase,
  CharacterPerformanceStep,
  CharacterPerformanceTarget,
} from './performances';
import { Expression } from '~/constants/character';
import {
  CHARACTER_PERFORMANCE_ANIMATION_IDS,
  type CharacterPerformanceAnimationId,
} from '~/constants/presentationAnimations';

const VALID_PERFORMANCE_PHASES = [
  'proposal',
  'accepted',
  'rejected',
  'rejectedBusy',
  'rejectedMood',
  'active',
  'participantLeftSolo',
  'participantLeftGroup',
  'end',
] as const;
const VALID_PERFORMANCE_TARGETS = ['initiator', 'target', 'both'] as const;
const VALID_PERFORMANCE_STEP_TYPES = ['bubble', 'expression', 'emote', 'mapEffect', 'motion', 'animation', 'dialogue'] as const;
const VALID_EXPRESSIONS = Object.values(Expression);

type CharacterPerformanceRecord = Record<string, unknown>;
interface BasePerformanceStep {
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  delayMs?: number;
  durationMs?: number;
}

export function loadCharacterPerformanceDefinitions(rawDefinitions: unknown): CharacterPerformanceDefinition[] {
  if (!Array.isArray(rawDefinitions)) {
    throw new Error('Character performance definitions must be an array.');
  }

  const definitions = rawDefinitions.map((definition, index) => parseCharacterPerformanceDefinition(definition, index));
  assertUniquePerformanceIds(definitions);

  return definitions;
}

function parseCharacterPerformanceDefinition(
  rawDefinition: unknown,
  index: number,
): CharacterPerformanceDefinition {
  if (!isRecord(rawDefinition)) {
    throw new Error(`Character performance definition at index ${index} must be an object.`);
  }

  return {
    id: readRequiredString(rawDefinition, 'id', index),
    steps: readPerformanceSteps(rawDefinition, index),
  };
}

function readPerformanceSteps(
  definition: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceStep[] {
  const value = definition.steps;

  if (!Array.isArray(value)) {
    throw new Error(`Character performance definition at index ${index} must include steps array.`);
  }

  return value.map((step, stepIndex) => readPerformanceStep(step, index, stepIndex));
}

function readPerformanceStep(
  rawStep: unknown,
  definitionIndex: number,
  stepIndex: number,
): CharacterPerformanceStep {
  if (!isRecord(rawStep)) {
    throw new Error(`Character performance definition at index ${definitionIndex} has invalid steps[${stepIndex}].`);
  }

  const type = readRequiredString(rawStep, 'type', definitionIndex);

  if (!includesString(VALID_PERFORMANCE_STEP_TYPES, type)) {
    throw new Error(`Character performance definition at index ${definitionIndex} has invalid step type "${type}".`);
  }

  if (type === 'animation') {
    return {
      phase: readPerformancePhase(rawStep, definitionIndex),
      target: readPerformanceAnimationTarget(rawStep, definitionIndex),
      participantCount: readOptionalParticipantCount(rawStep, definitionIndex),
      delayMs: readOptionalNonNegativeNumber(rawStep, 'delayMs', definitionIndex),
      durationMs: readOptionalNonNegativeNumber(rawStep, 'durationMs', definitionIndex),
      type,
      animationId: readPerformanceAnimationId(rawStep, definitionIndex),
    };
  }

  const baseStep = readBasePerformanceStep(rawStep, definitionIndex);

  if (type === 'bubble') {
    return {
      ...baseStep,
      type,
      text: readRequiredString(rawStep, 'text', definitionIndex),
    };
  }

  if (type === 'expression') {
    return {
      ...baseStep,
      type,
      expression: readExpression(rawStep, definitionIndex),
    };
  }

  if (type === 'emote') {
    return {
      ...baseStep,
      type,
      emoteId: readRequiredString(rawStep, 'emoteId', definitionIndex),
    };
  }

  if (type === 'mapEffect') {
    return {
      ...baseStep,
      type,
      effectId: readRequiredString(rawStep, 'effectId', definitionIndex),
      label: readOptionalString(rawStep, 'label', definitionIndex),
    };
  }

  if (type === 'dialogue') {
    const dialogueGroupId = readOptionalString(rawStep, 'dialogueGroupId', definitionIndex);
    const scriptId = readOptionalString(rawStep, 'scriptId', definitionIndex);

    if (!dialogueGroupId && !scriptId) {
      throw new Error(
        `Character performance definition at index ${definitionIndex} has dialogue step without dialogueGroupId or scriptId.`,
      );
    }

    return {
      ...baseStep,
      type,
      dialogueGroupId,
      scriptId,
      displayMode: readOptionalDialogueDisplayMode(rawStep, definitionIndex),
    };
  }

  return {
    ...baseStep,
    type,
    motionId: readRequiredString(rawStep, 'motionId', definitionIndex),
  };
}

function readPerformanceAnimationId(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceAnimationId {
  const value = readRequiredString(step, 'animationId', index);

  if (!includesString(CHARACTER_PERFORMANCE_ANIMATION_IDS, value)) {
    throw new Error(
      `Character performance definition at index ${index} has invalid animationId "${value}". ` +
      `Expected one of: ${CHARACTER_PERFORMANCE_ANIMATION_IDS.join(', ')}.`,
    );
  }

  return value as CharacterPerformanceAnimationId;
}

function readOptionalDialogueDisplayMode(
  definition: CharacterPerformanceRecord,
  index: number,
): 'preview' | 'ambient' | undefined {
  const value = definition.displayMode;

  if (value === undefined) {
    return undefined;
  }

  if (value !== 'preview' && value !== 'ambient') {
    throw new Error(`Character performance definition at index ${index} has invalid displayMode.`);
  }

  return value;
}

function readBasePerformanceStep(
  step: CharacterPerformanceRecord,
  index: number,
): BasePerformanceStep {
  return {
    phase: readPerformancePhase(step, index),
    target: readPerformanceTarget(step, index),
    participantCount: readOptionalParticipantCount(step, index),
    delayMs: readOptionalNonNegativeNumber(step, 'delayMs', index),
    durationMs: readOptionalNonNegativeNumber(step, 'durationMs', index),
  };
}

function readOptionalParticipantCount(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceParticipantCountCondition | undefined {
  const value = step.participantCount;

  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    throw new Error(`Character performance definition at index ${index} has invalid participantCount.`);
  }

  const min = readOptionalNonNegativeNumber(value, 'min', index);
  const max = readOptionalNonNegativeNumber(value, 'max', index);

  if (min === undefined && max === undefined) {
    throw new Error(`Character performance definition at index ${index} has empty participantCount.`);
  }

  if (min !== undefined && max !== undefined && min > max) {
    throw new Error(`Character performance definition at index ${index} has invalid participantCount range.`);
  }

  return { min, max };
}

function readPerformancePhase(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformancePhase {
  const value = readRequiredString(step, 'phase', index);

  if (!includesString(VALID_PERFORMANCE_PHASES, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid phase "${value}".`);
  }

  return value as CharacterPerformancePhase;
}

function readPerformanceAnimationTarget(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceAnimationTarget {
  const value = readRequiredString(step, 'target', index);

  if (value === 'heldItem') {
    return value;
  }

  if (!includesString(VALID_PERFORMANCE_TARGETS, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid target "${value}".`);
  }

  return value as CharacterPerformanceTarget;
}

function readPerformanceTarget(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceTarget {
  const value = readRequiredString(step, 'target', index);

  if (!includesString(VALID_PERFORMANCE_TARGETS, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid target "${value}".`);
  }

  return value as CharacterPerformanceTarget;
}

function readRequiredString(
  definition: CharacterPerformanceRecord,
  key: string,
  index: number,
): string {
  const value = definition[key];

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character performance definition at index ${index} must include string ${key}.`);
  }

  return value;
}

function readOptionalString(
  definition: CharacterPerformanceRecord,
  key: string,
  index: number,
): string | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Character performance definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function readExpression(
  step: CharacterPerformanceRecord,
  index: number,
): Expression {
  const value = readRequiredString(step, 'expression', index);

  if (!includesString(VALID_EXPRESSIONS, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid expression "${value}".`);
  }

  return value as Expression;
}

function readOptionalNonNegativeNumber(
  definition: CharacterPerformanceRecord,
  key: string,
  index: number,
): number | undefined {
  const value = definition[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Character performance definition at index ${index} has invalid ${key}.`);
  }

  return value;
}

function assertUniquePerformanceIds(definitions: readonly CharacterPerformanceDefinition[]): void {
  const ids = new Set<string>();

  definitions.forEach(definition => {
    if (ids.has(definition.id)) {
      throw new Error(`Duplicate character performance definition id "${definition.id}".`);
    }

    ids.add(definition.id);
  });
}

function includesString<T extends string>(values: readonly T[], value: string): value is T {
  return values.some(validValue => validValue === value);
}

function isRecord(value: unknown): value is CharacterPerformanceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
