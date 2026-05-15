import rawCharacterPerformanceDefinitions from '~/constants/events/characterPerformances.json';
import { loadCharacterPerformanceDefinitions } from './performanceSchema';

export type CharacterPerformancePhase = 'proposal' | 'accepted' | 'rejected' | 'active' | 'end';
export type CharacterPerformanceTarget = 'initiator' | 'target' | 'both';

export interface CharacterPerformanceDefinition {
  id: string;
  steps: readonly CharacterPerformanceStep[];
}

export type CharacterPerformanceStep = CharacterPerformanceBubbleStep;

export interface CharacterPerformanceBubbleStep {
  type: 'bubble';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  text: string;
  delayMs?: number;
  durationMs?: number;
}

export const CHARACTER_PERFORMANCE_DEFINITIONS: readonly CharacterPerformanceDefinition[] =
  loadCharacterPerformanceDefinitions(rawCharacterPerformanceDefinitions);

export const CHARACTER_PERFORMANCE_DEFINITIONS_BY_ID = CHARACTER_PERFORMANCE_DEFINITIONS.reduce<Record<string, CharacterPerformanceDefinition>>(
  (definitionsById, definition) => ({
    ...definitionsById,
    [definition.id]: definition,
  }),
  {},
);

export function getCharacterPerformanceBubbleStep(
  performanceId: string | undefined,
  phase: CharacterPerformancePhase,
  target: CharacterPerformanceTarget,
): CharacterPerformanceBubbleStep | undefined {
  if (!performanceId) {
    return undefined;
  }

  const steps = CHARACTER_PERFORMANCE_DEFINITIONS_BY_ID[performanceId]?.steps ?? [];

  return steps.find(step => (
    step.type === 'bubble' &&
    step.phase === phase &&
    step.target === target
  )) ?? steps.find(step => (
    step.type === 'bubble' &&
    step.phase === phase &&
    step.target === 'both'
  ));
}
