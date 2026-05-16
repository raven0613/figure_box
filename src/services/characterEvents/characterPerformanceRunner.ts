import { Expression } from '~/constants/character';
import type { CharacterEventInteractionPresentation } from '../../constants/charactarEventsDefinitions';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID } from '../../constants/charactarEventsDefinitions';
import {
  getCharacterPerformanceBubbleStep,
  getCharacterPerformanceSteps,
  type CharacterPerformancePhase,
  type CharacterPerformanceStep,
  type CharacterPerformanceTarget,
} from './performances';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';

export interface CharacterPerformanceSelection {
  definitionId?: string;
  variantId?: string;
}

export interface CharacterPerformanceBubble {
  text: string;
  delayMs?: number;
  durationMs: number;
}

export interface CharacterPerformanceBubbleInput {
  selection: CharacterPerformanceSelection;
  phase: CharacterPerformancePhase;
  target: CharacterPerformanceTarget;
  fallbackTemplate: string;
  fallbackDurationMs: number;
  initiatorName: string;
  targetName: string;
  legacyPresentation?: CharacterEventInteractionPresentation;
}

interface CharacterActivityPerformanceInput {
  selection: CharacterPerformanceSelection;
  phase: CharacterPerformancePhase;
  activityId: string;
  participantIds: readonly string[];
  hostCharacterIds?: readonly string[];
}

interface CharacterPerformanceRunnerPorts {
  setCharacterExpression: (characterId: string, expression: Expression) => void;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  showCharacterEmote: (characterId: string, text: string, durationMs?: number) => void;
  showMapActivity: (activity: MapActivityView, durationMs?: number) => void;
}

export class CharacterPerformanceRunner {
  private readonly timers = new Set<number>();
  private readonly ports: CharacterPerformanceRunnerPorts;

  constructor(ports: CharacterPerformanceRunnerPorts) {
    this.ports = ports;
  }

  dispose(): void {
    this.timers.forEach(timerId => window.clearTimeout(timerId));
    this.timers.clear();
  }

  getInteractionBubble(input: CharacterPerformanceBubbleInput): CharacterPerformanceBubble {
    const performanceId = this.getSelectedPerformanceId(input.selection);
    const step = getCharacterPerformanceBubbleStep(performanceId, input.phase, input.target);
    const template = step?.text
      ?? getLegacyInteractionLine(input.legacyPresentation, input.phase)
      ?? input.fallbackTemplate;

    return {
      text: formatInteractionLine(template, input.initiatorName, input.targetName),
      delayMs: step?.delayMs,
      durationMs: step?.durationMs ?? input.fallbackDurationMs,
    };
  }

  playNonBubblePerformanceSteps(
    selection: CharacterPerformanceSelection,
    phase: CharacterPerformancePhase,
    initiatorId: string,
    targetId: string,
  ): void {
    const performanceId = this.getSelectedPerformanceId(selection);
    const steps = getCharacterPerformanceSteps(performanceId, phase)
      .filter(step => step.type !== 'bubble');

    steps.forEach(step => {
      this.schedulePerformanceStep(step, initiatorId, targetId);
    });
  }

  playActivityPerformanceSteps(input: CharacterActivityPerformanceInput): void {
    const performanceId = this.getSelectedPerformanceId(input.selection);
    const steps = getCharacterPerformanceSteps(performanceId, input.phase)
      .filter(step => matchesParticipantCount(step, input.participantIds.length));

    steps.forEach(step => {
      this.scheduleActivityPerformanceStep(step, input);
    });
  }

  private getSelectedPerformanceId(selection: CharacterPerformanceSelection): string | undefined {
    if (!selection.definitionId || !selection.variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[selection.definitionId]?.presentationVariants
      ?.find(variant => variant.id === selection.variantId)
      ?.performanceId;
  }

  private schedulePerformanceStep(
    step: CharacterPerformanceStep,
    initiatorId: string,
    targetId: string,
  ): void {
    const runStep = () => {
      this.timers.delete(timerId);
      this.playPerformanceStep(step, initiatorId, targetId);
    };
    const timerId = window.setTimeout(runStep, step.delayMs ?? 0);
    this.timers.add(timerId);
  }

  private scheduleActivityPerformanceStep(
    step: CharacterPerformanceStep,
    input: CharacterActivityPerformanceInput,
  ): void {
    const runStep = () => {
      this.timers.delete(timerId);
      this.playActivityPerformanceStep(step, input);
    };
    const timerId = window.setTimeout(runStep, step.delayMs ?? 0);
    this.timers.add(timerId);
  }

  private playPerformanceStep(
    step: CharacterPerformanceStep,
    initiatorId: string,
    targetId: string,
  ): void {
    const characterIds = resolvePerformanceTargetIds(step.target, initiatorId, targetId);

    if (step.type === 'expression') {
      characterIds.forEach(characterId => {
        this.ports.setCharacterExpression(characterId, step.expression);

        if (step.durationMs !== undefined) {
          this.scheduleExpressionReset(characterId, step.durationMs);
        }
      });
      return;
    }

    if (step.type === 'emote') {
      characterIds.forEach(characterId => {
        this.ports.showCharacterEmote(
          characterId,
          getEmoteLabel(step.emoteId),
          step.durationMs ?? 1200,
        );
      });
      return;
    }

    if (step.type === 'mapEffect') {
      this.ports.showMapActivity(
        {
          id: `${step.effectId}-${initiatorId}-${targetId}`,
          label: step.label ?? step.effectId,
          participantIds: characterIds,
        },
        step.durationMs,
      );
      return;
    }

    if (step.type === 'motion') {
      return;
    }
  }

  private playActivityPerformanceStep(
    step: CharacterPerformanceStep,
    input: CharacterActivityPerformanceInput,
  ): void {
    const characterIds = resolveActivityPerformanceTargetIds(
      step.target,
      input.participantIds,
      input.hostCharacterIds,
    );

    if (characterIds.length === 0) {
      return;
    }

    if (step.type === 'bubble') {
      characterIds.forEach(characterId => {
        this.ports.showCharacterBubble(characterId, step.text, step.durationMs);
      });
      return;
    }

    if (step.type === 'expression') {
      characterIds.forEach(characterId => {
        this.ports.setCharacterExpression(characterId, step.expression);

        if (step.durationMs !== undefined) {
          this.scheduleExpressionReset(characterId, step.durationMs);
        }
      });
      return;
    }

    if (step.type === 'emote') {
      characterIds.forEach(characterId => {
        this.ports.showCharacterEmote(
          characterId,
          getEmoteLabel(step.emoteId),
          step.durationMs ?? 1200,
        );
      });
      return;
    }

    if (step.type === 'mapEffect') {
      this.ports.showMapActivity(
        {
          id: `${step.effectId}-${input.activityId}`,
          label: step.label ?? step.effectId,
          participantIds: characterIds,
        },
        step.durationMs,
      );
      return;
    }

    if (step.type === 'motion') {
      return;
    }
  }

  private scheduleExpressionReset(characterId: string, durationMs: number): void {
    const timerId = window.setTimeout(() => {
      this.timers.delete(timerId);
      this.ports.setCharacterExpression(characterId, Expression.Normal);
    }, durationMs);

    this.timers.add(timerId);
  }
}

function getLegacyInteractionLine(
  presentation: CharacterEventInteractionPresentation | undefined,
  phase: CharacterPerformancePhase,
): string | undefined {
  if (phase === 'proposal') {
    return presentation?.proposalLine;
  }

  if (phase === 'accepted') {
    return presentation?.acceptedLine;
  }

  if (phase === 'rejected') {
    return presentation?.rejectedLine;
  }

  if (phase === 'end') {
    return presentation?.endLine;
  }

  return undefined;
}

function formatInteractionLine(
  template: string,
  initiatorName: string,
  targetName: string,
): string {
  return template
    .replaceAll('{initiator}', initiatorName)
    .replaceAll('{target}', targetName);
}

function resolvePerformanceTargetIds(
  target: CharacterPerformanceTarget,
  initiatorId: string,
  targetId: string,
): string[] {
  if (target === 'initiator') {
    return [initiatorId];
  }

  if (target === 'target') {
    return [targetId];
  }

  return [initiatorId, targetId];
}

function resolveActivityPerformanceTargetIds(
  target: CharacterPerformanceTarget,
  participantIds: readonly string[],
  hostCharacterIds: readonly string[] = [],
): string[] {
  if (target === 'both') {
    return [...participantIds];
  }

  if (target === 'initiator') {
    return hostCharacterIds.length > 0
      ? [...hostCharacterIds]
      : participantIds.slice(0, 1);
  }

  const hostIds = new Set(hostCharacterIds);
  const nonHostParticipantIds = participantIds.filter(characterId => !hostIds.has(characterId));

  return nonHostParticipantIds.length > 0
    ? nonHostParticipantIds
    : participantIds.slice(1);
}

function matchesParticipantCount(step: CharacterPerformanceStep, participantCount: number): boolean {
  const condition = step.participantCount;

  if (!condition) {
    return true;
  }

  if (condition.min !== undefined && participantCount < condition.min) {
    return false;
  }

  if (condition.max !== undefined && participantCount > condition.max) {
    return false;
  }

  return true;
}

function getEmoteLabel(emoteId: string): string {
  const emoteLabels: Record<string, string> = {
    laugh: '大笑',
    play: '玩',
    talk: '聊',
    surprised: '!',
    sigh: '...',
  };

  return emoteLabels[emoteId] ?? emoteId;
}
