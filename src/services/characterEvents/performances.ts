import rawCharacterPerformanceDefinitions from '~/constants/events/characterPerformances.json';
import type { Expression } from '~/constants/character';
import { loadCharacterPerformanceDefinitions } from './performanceSchema';

export type CharacterPerformancePhase =
  | 'proposal'
  | 'accepted'
  | 'rejected'
  | 'rejectedBusy'
  | 'rejectedMood'
  | 'active'
  | 'participantLeftSolo'
  | 'participantLeftGroup'
  | 'end';
export type CharacterPerformanceTarget = 'initiator' | 'target' | 'both';

export interface CharacterPerformanceDefinition {
  id: string;
  steps: readonly CharacterPerformanceStep[];
}

export type CharacterPerformanceStep =
  | CharacterPerformanceBubbleStep
  | CharacterPerformanceExpressionStep
  | CharacterPerformanceEmoteStep
  | CharacterPerformanceMapEffectStep
  | CharacterPerformanceMotionStep
  | CharacterPerformanceDialogueStep;

export interface CharacterPerformanceBubbleStep {
  type: 'bubble';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  text: string;
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceExpressionStep {
  type: 'expression';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  expression: Expression;
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceEmoteStep {
  type: 'emote';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  emoteId: string;
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceMapEffectStep {
  type: 'mapEffect';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  effectId: string;
  label?: string;
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceMotionStep {
  type: 'motion';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  motionId: string;
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceDialogueStep {
  type: 'dialogue';
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  participantCount?: CharacterPerformanceParticipantCountCondition;
  dialogueGroupId?: string;
  scriptId?: string;
  displayMode?: 'preview' | 'ambient';
  delayMs?: number;
  durationMs?: number;
}

export interface CharacterPerformanceParticipantCountCondition {
  min?: number;
  max?: number;
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
  const matchesBubbleStep = (
    step: CharacterPerformanceStep,
    stepTarget: CharacterPerformanceTarget,
  ): step is CharacterPerformanceBubbleStep => (
    step.type === 'bubble' &&
    step.phase === phase &&
    step.target === stepTarget
  );
  const matchesTargetBubbleStep = (step: CharacterPerformanceStep): step is CharacterPerformanceBubbleStep => (
    matchesBubbleStep(step, target)
  );
  const matchesFallbackBubbleStep = (step: CharacterPerformanceStep): step is CharacterPerformanceBubbleStep => (
    matchesBubbleStep(step, 'both')
  );

  return steps.find(matchesTargetBubbleStep) ?? steps.find(matchesFallbackBubbleStep);
}

export function getCharacterPerformanceSteps(
  performanceId: string | undefined,
  phase: CharacterPerformancePhase,
): readonly CharacterPerformanceStep[] {
  if (!performanceId) {
    return [];
  }

  return CHARACTER_PERFORMANCE_DEFINITIONS_BY_ID[performanceId]?.steps.filter(step => step.phase === phase) ?? [];
}
