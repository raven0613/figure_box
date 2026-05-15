import type {
  CharacterPerformanceBubbleStep,
  CharacterPerformanceDefinition,
  CharacterPerformancePhase,
  CharacterPerformanceTarget,
} from './performances';

const VALID_PERFORMANCE_PHASES = ['proposal', 'accepted', 'rejected', 'active', 'end'] as const;
const VALID_PERFORMANCE_TARGETS = ['initiator', 'target', 'both'] as const;
const VALID_PERFORMANCE_STEP_TYPES = ['bubble'] as const;

type CharacterPerformanceRecord = Record<string, unknown>;

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
): CharacterPerformanceBubbleStep[] {
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
): CharacterPerformanceBubbleStep {
  if (!isRecord(rawStep)) {
    throw new Error(`Character performance definition at index ${definitionIndex} has invalid steps[${stepIndex}].`);
  }

  const type = readRequiredString(rawStep, 'type', definitionIndex);

  if (!includesString(VALID_PERFORMANCE_STEP_TYPES, type)) {
    throw new Error(`Character performance definition at index ${definitionIndex} has invalid step type "${type}".`);
  }

  return {
    type,
    phase: readPerformancePhase(rawStep, definitionIndex),
    target: readPerformanceTarget(rawStep, definitionIndex),
    text: readRequiredString(rawStep, 'text', definitionIndex),
    delayMs: readOptionalNonNegativeNumber(rawStep, 'delayMs', definitionIndex),
    durationMs: readOptionalNonNegativeNumber(rawStep, 'durationMs', definitionIndex),
  };
}

function readPerformancePhase(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformancePhase {
  const value = readRequiredString(step, 'phase', index);

  if (!includesString(VALID_PERFORMANCE_PHASES, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid phase "${value}".`);
  }

  return value;
}

function readPerformanceTarget(
  step: CharacterPerformanceRecord,
  index: number,
): CharacterPerformanceTarget {
  const value = readRequiredString(step, 'target', index);

  if (!includesString(VALID_PERFORMANCE_TARGETS, value)) {
    throw new Error(`Character performance definition at index ${index} has invalid target "${value}".`);
  }

  return value;
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

function includesString<T extends readonly string[]>(values: T, value: string): value is T[number] {
  return values.includes(value);
}

function isRecord(value: unknown): value is CharacterPerformanceRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
