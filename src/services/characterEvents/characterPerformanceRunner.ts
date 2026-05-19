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
  getCharacterName: (characterId: string) => string;
  setCharacterExpression: (characterId: string, expression: Expression) => void;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  removeCharacterBubble: (characterId: string) => void;
  showCharacterEmote: (characterId: string, text: string, durationMs?: number) => void;
  showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
  removeMapActivity: (activityId: string) => void;
}

const PARTICIPANT_LEFT_REACTION_MS = 5000;

export class CharacterPerformanceRunner {
  private readonly timers = new Set<number>();
  private readonly expressionResetTimersByCharacterId = new Map<string, number>();
  private readonly ports: CharacterPerformanceRunnerPorts;

  constructor(ports: CharacterPerformanceRunnerPorts) {
    this.ports = ports;
  }

  dispose(): void {
    this.timers.forEach(timerId => window.clearTimeout(timerId));
    this.timers.clear();
    this.expressionResetTimersByCharacterId.forEach(timerId => window.clearTimeout(timerId));
    this.expressionResetTimersByCharacterId.clear();
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

  playActivityPerformanceSteps(input: CharacterActivityPerformanceInput): number {
    const performanceId = this.getSelectedPerformanceId(input.selection);
    const steps = getCharacterPerformanceSteps(performanceId, input.phase)
      .filter(step => matchesParticipantCount(step, input.participantIds.length));

    if (steps.length === 0 && input.phase === 'participantLeftGroup') {
      this.playFallbackParticipantLeftGroupPerformance(input);
      return PARTICIPANT_LEFT_REACTION_MS;
    }

    steps.forEach(step => {
      this.scheduleActivityPerformanceStep(step, input);
    });

    return getPerformanceStepsDurationMs(steps);
  }

  clearActivityActiveVisuals(
    selection: CharacterPerformanceSelection,
    activityId: string,
    participantIds: readonly string[],
    hostCharacterIds: readonly string[] = [],
  ): void {
    participantIds.forEach(characterId => {
      this.ports.removeCharacterBubble(characterId);
    });

    const performanceId = this.getSelectedPerformanceId(selection);
    const steps = getCharacterPerformanceSteps(performanceId, 'active')
      .filter(step => step.type === 'mapEffect');

    steps.forEach(step => {
      if (step.type === 'mapEffect') {
        this.clearActivityMapEffect(step.effectId, activityId, participantIds, hostCharacterIds);
      }
    });
  }

  clearActivityVisuals(
    selection: CharacterPerformanceSelection,
    activityId: string,
    participantIds: readonly string[],
    hostCharacterIds: readonly string[] = [],
  ): void {
    participantIds.forEach(characterId => {
      this.ports.removeCharacterBubble(characterId);
    });

    const performanceId = this.getSelectedPerformanceId(selection);
    const phases: CharacterPerformancePhase[] = ['active', 'participantLeftSolo', 'participantLeftGroup'];

    phases.forEach(phase => {
      getCharacterPerformanceSteps(performanceId, phase)
        .filter(step => step.type === 'mapEffect')
        .forEach(step => {
          if (step.type === 'mapEffect') {
            this.clearActivityMapEffect(step.effectId, activityId, participantIds, hostCharacterIds);
          }
        });
    });
    this.clearParticipantLeftFallbackMapEffects(activityId, participantIds);
  }

  clearInteractionActiveVisuals(
    selection: CharacterPerformanceSelection,
    initiatorId: string,
    targetId: string,
    participantIds: readonly string[],
  ): void {
    participantIds.forEach(characterId => {
      this.ports.removeCharacterBubble(characterId);
    });

    const performanceId = this.getSelectedPerformanceId(selection);
    const steps = getCharacterPerformanceSteps(performanceId, 'active')
      .filter(step => step.type === 'mapEffect');

    steps.forEach(step => {
      if (step.type === 'mapEffect') {
        this.ports.removeMapActivity(`${step.effectId}-${initiatorId}-${targetId}`);
      }
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
        this.clearExpressionReset(characterId);
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

    if (step.type === 'motion' || step.type === 'dialogue') {
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
      const names = this.getActivityPerformanceNames(input);

      characterIds.forEach(characterId => {
        this.ports.showCharacterBubble(
          characterId,
          formatInteractionLine(step.text, names.initiatorName, names.targetName),
          step.durationMs,
        );
      });
      return;
    }

    if (step.type === 'expression') {
      characterIds.forEach(characterId => {
        this.clearExpressionReset(characterId);
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
      if (input.phase === 'participantLeftGroup') {
        characterIds.forEach(characterId => {
          this.ports.showMapActivity(
            {
              id: createParticipantLeftMapEffectId(step.effectId, input.activityId, characterId),
              label: step.label ?? step.effectId,
              participantIds: [characterId],
            },
            step.durationMs,
          );
        });
        return;
      }

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

    if (step.type === 'motion' || step.type === 'dialogue') {
      return;
    }
  }

  private scheduleExpressionReset(characterId: string, durationMs: number): void {
    this.clearExpressionReset(characterId);

    const timerId = window.setTimeout(() => {
      this.timers.delete(timerId);
      this.expressionResetTimersByCharacterId.delete(characterId);
      this.ports.setCharacterExpression(characterId, Expression.Normal);
    }, durationMs);

    this.timers.add(timerId);
    this.expressionResetTimersByCharacterId.set(characterId, timerId);
  }

  private playFallbackParticipantLeftGroupPerformance(input: CharacterActivityPerformanceInput): void {
    input.participantIds.forEach(characterId => {
      this.clearExpressionReset(characterId);
      this.ports.setCharacterExpression(characterId, Expression.Surprised);
      this.ports.showCharacterEmote(characterId, getEmoteLabel('surprised'), PARTICIPANT_LEFT_REACTION_MS);
      this.scheduleExpressionReset(characterId, PARTICIPANT_LEFT_REACTION_MS);
    });

    input.participantIds.forEach(characterId => {
      this.ports.showMapActivity(
        {
          id: createParticipantLeftMapEffectId('participantLeft', input.activityId, characterId),
          label: '愣住了',
          participantIds: [characterId],
        },
        PARTICIPANT_LEFT_REACTION_MS,
      );
    });
  }

  private clearActivityMapEffect(
    effectId: string,
    activityId: string,
    participantIds: readonly string[],
    hostCharacterIds: readonly string[],
  ): void {
    this.ports.removeMapActivity(`${effectId}-${activityId}`);
    participantIds.forEach(participantId => {
      this.ports.removeMapActivity(createParticipantLeftMapEffectId(effectId, activityId, participantId));
    });

    hostCharacterIds.forEach(hostCharacterId => {
      participantIds
        .filter(participantId => participantId !== hostCharacterId)
        .forEach(participantId => {
          this.ports.removeMapActivity(`${effectId}-${hostCharacterId}-${participantId}`);
        });
    });
  }

  private clearParticipantLeftFallbackMapEffects(
    activityId: string,
    participantIds: readonly string[],
  ): void {
    this.ports.removeMapActivity(`participantLeft-${activityId}`);
    participantIds.forEach(participantId => {
      this.ports.removeMapActivity(createParticipantLeftMapEffectId('participantLeft', activityId, participantId));
    });
  }

  private clearExpressionReset(characterId: string): void {
    const timerId = this.expressionResetTimersByCharacterId.get(characterId);

    if (!timerId) {
      return;
    }

    window.clearTimeout(timerId);
    this.expressionResetTimersByCharacterId.delete(characterId);
    this.timers.delete(timerId);
  }

  private getActivityPerformanceNames(input: CharacterActivityPerformanceInput): {
    initiatorName: string;
    targetName: string;
  } {
    const hostIds = input.hostCharacterIds?.length
      ? input.hostCharacterIds
      : input.participantIds.slice(0, 1);
    const hostIdSet = new Set(hostIds);
    const targetIds = input.participantIds.filter(characterId => !hostIdSet.has(characterId));

    return {
      initiatorName: formatCharacterNames(hostIds, characterId => this.ports.getCharacterName(characterId)),
      targetName: formatCharacterNames(targetIds, characterId => this.ports.getCharacterName(characterId)),
    };
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

function formatCharacterNames(
  characterIds: readonly string[],
  getCharacterName: (characterId: string) => string,
): string {
  return characterIds.map(getCharacterName).join('、');
}

function createParticipantLeftMapEffectId(
  effectId: string,
  activityId: string,
  characterId: string,
): string {
  return `${effectId}-${activityId}-participantLeft-${characterId}`;
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

function getPerformanceStepsDurationMs(steps: readonly CharacterPerformanceStep[]): number {
  if (steps.length === 0) {
    return 0;
  }

  return Math.max(...steps.map(step => (step.delayMs ?? 0) + (step.durationMs ?? 0)));
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
