import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { CharacterEventInteractionPresentation } from '../../constants/charactarEventsDefinitions';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID } from '../../constants/charactarEventsDefinitions';
import {
  getCharacterPerformanceBubbleStep,
  getCharacterPerformanceSteps,
  type CharacterPerformanceAnimationTarget,
  type CharacterPerformanceDialogueStep,
  type CharacterPerformancePhase,
  type CharacterPerformanceStep,
  type CharacterPerformanceTarget,
} from './performances';
import type { MapActivityView } from '~/typing/eventDialoguePresentation';
import type { CharacterPerformanceAnimationId } from '~/constants/presentationAnimations';
import type { DialogueViewInstruction } from '~/typing/dialogueView';
import type { ExpressionPresetId } from '~/typing/expression';
import { PausableTimeoutScheduler } from '~/services/pausableTimeoutScheduler';

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

export interface CharacterActivityPerformanceInput {
  selection: CharacterPerformanceSelection;
  phase: CharacterPerformancePhase;
  activityId: string;
  participantIds: readonly string[];
  hostCharacterIds?: readonly string[];
  templateValues?: Readonly<Record<string, string>>;
}

export interface CharacterPerformanceActivityRollRequest {
  activityId: string;
  rollId: string;
  participantIds: readonly string[];
  hostCharacterIds: readonly string[];
}

interface CharacterPerformanceByIdInput {
  performanceId: string;
  phase: CharacterPerformancePhase;
  initiatorId: string;
  targetId?: string;
}

export interface CharacterPerformanceDialogueRequest {
  activityId?: string;
  dialogueGroupId?: string;
  scriptId?: string;
  displayMode?: CharacterPerformanceDialogueStep['displayMode'];
  participantIds: readonly string[];
  initiatorId: string;
  targetId?: string;
  templateValues?: Readonly<Record<string, string>>;
  resolveActivityRoll?: (rollId: string) => string | null;
  resolveDialogueContent?: (
    contentPoolId: string,
    subjectKey: string,
  ) => readonly DialogueViewInstruction[] | null;
  onClose?: () => void;
  onCancel?: () => void;
}

interface CharacterPerformanceRunnerPorts {
  getCharacterName: (characterId: string) => string;
  setCharacterExpressionPreset: (characterId: string, expressionPresetId: ExpressionPresetId) => void;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  removeCharacterBubble: (characterId: string) => void;
  showCharacterEmote: (characterId: string, text: string, durationMs?: number) => void;
  removeCharacterEmote: (characterId: string) => void;
  showMapActivity: (activity: MapActivityView, durationMs?: number | null) => void;
  removeMapActivity: (activityId: string) => void;
  playCharacterAnimation?: (
    characterId: string,
    animationId: CharacterPerformanceAnimationId,
    durationMs?: number,
  ) => void;
  cancelCharacterAnimation?: (characterId: string) => void;
  playDialogue?: (request: CharacterPerformanceDialogueRequest) => void;
  rollActivity?: (request: CharacterPerformanceActivityRollRequest) => void;
}

interface ExpressionResetTimer {
  scheduler: PausableTimeoutScheduler;
  timerId: number;
}

const PARTICIPANT_LEFT_REACTION_MS = 5000;

export class CharacterPerformanceRunner {
  private readonly generalScheduler = new PausableTimeoutScheduler();
  private readonly activitySchedulersByActivityId = new Map<string, PausableTimeoutScheduler>();
  private readonly expressionResetTimersByCharacterId = new Map<string, ExpressionResetTimer>();
  private readonly ports: CharacterPerformanceRunnerPorts;
  private observedActivityId: string | null = null;
  private isWorldPaused = false;

  constructor(ports: CharacterPerformanceRunnerPorts) {
    this.ports = ports;
  }

  dispose(): void {
    this.generalScheduler.clear();
    this.activitySchedulersByActivityId.forEach(scheduler => scheduler.clear());
    this.activitySchedulersByActivityId.clear();
    this.expressionResetTimersByCharacterId.clear();
  }

  pauseWorld(observedActivityId: string | null): void {
    this.isWorldPaused = true;
    this.observedActivityId = observedActivityId;
    this.generalScheduler.pause();
    this.activitySchedulersByActivityId.forEach((scheduler, activityId) => {
      if (activityId !== observedActivityId) {
        scheduler.pause();
      }
    });
  }

  resumeWorld(): void {
    if (!this.isWorldPaused) {
      return;
    }

    this.isWorldPaused = false;
    this.observedActivityId = null;
    this.generalScheduler.resume();
    this.activitySchedulersByActivityId.forEach(scheduler => scheduler.resume());
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

  playPerformanceStepsById(input: CharacterPerformanceByIdInput): number {
    const targetId = input.targetId ?? input.initiatorId;
    const steps = getCharacterPerformanceSteps(input.performanceId, input.phase);

    steps.forEach(step => {
      this.schedulePerformanceStep(step, input.initiatorId, targetId);
    });

    return getPerformanceStepsDurationMs(steps);
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

  playActivityPerformanceStepsById(
    performanceId: string,
    input: Omit<CharacterActivityPerformanceInput, 'selection'>,
  ): number {
    const steps = getCharacterPerformanceSteps(performanceId, input.phase)
      .filter(step => matchesParticipantCount(step, input.participantIds.length));

    steps.forEach(step => {
      this.scheduleActivityPerformanceStep(step, {
        ...input,
        selection: {},
      });
    });

    return getPerformanceStepsDurationMs(steps);
  }

  cancelActivityPerformance(activityId: string): void {
    const scheduler = this.activitySchedulersByActivityId.get(activityId);

    if (!scheduler) {
      return;
    }

    scheduler.clear();
    this.activitySchedulersByActivityId.delete(activityId);
    this.expressionResetTimersByCharacterId.forEach((expressionResetTimer, characterId) => {
      if (expressionResetTimer.scheduler === scheduler) {
        this.expressionResetTimersByCharacterId.delete(characterId);
      }
    });
  }

  clearActivityPresentationForObservation(
    selection: CharacterPerformanceSelection,
    activityId: string,
    participantIds: readonly string[],
    hostCharacterIds: readonly string[] = [],
  ): void {
    this.cancelActivityPerformance(activityId);
    this.clearActivityVisuals(
      selection,
      activityId,
      participantIds,
      hostCharacterIds,
    );

    new Set([...participantIds, ...hostCharacterIds]).forEach(characterId => {
      this.clearExpressionReset(characterId);
      this.ports.removeCharacterBubble(characterId);
      this.ports.removeCharacterEmote(characterId);
      this.ports.cancelCharacterAnimation?.(characterId);
      this.ports.setCharacterExpressionPreset(characterId, DEFAULT_EXPRESSION_PRESET_ID);
    });
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

  clearActivitySettlementVisuals(
    selection: CharacterPerformanceSelection,
    activityId: string,
    participantIds: readonly string[],
    hostCharacterIds: readonly string[] = [],
  ): void {
    this.clearActivityVisuals(
      selection,
      activityId,
      participantIds,
      hostCharacterIds,
    );

    new Set([...participantIds, ...hostCharacterIds]).forEach(characterId => {
      this.ports.removeCharacterEmote(characterId);
      this.ports.cancelCharacterAnimation?.(characterId);
    });
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
    this.generalScheduler.schedule(() => {
      this.playPerformanceStep(step, initiatorId, targetId);
    }, step.delayMs ?? 0);
  }

  private scheduleActivityPerformanceStep(
    step: CharacterPerformanceStep,
    input: CharacterActivityPerformanceInput,
  ): void {
    this.getActivityScheduler(input.activityId).schedule(() => {
      this.playActivityPerformanceStep(step, input);
    }, step.delayMs ?? 0);
  }

  private playPerformanceStep(
    step: CharacterPerformanceStep,
    initiatorId: string,
    targetId: string,
  ): void {
    if (step.type === 'roll') {
      return;
    }

    if (step.type === 'animation') {
      resolvePerformanceAnimationTargetIds(step.target, initiatorId, targetId).forEach(characterId => {
        this.ports.playCharacterAnimation?.(characterId, step.animationId, step.durationMs);
      });
      return;
    }

    const characterIds = resolvePerformanceTargetIds(step.target, initiatorId, targetId);

    if (step.type === 'bubble') {
      const initiatorName = this.ports.getCharacterName(initiatorId);
      const targetName = this.ports.getCharacterName(targetId);

      characterIds.forEach(characterId => {
        this.ports.showCharacterBubble(
          characterId,
          formatInteractionLine(step.text, initiatorName, targetName),
          step.durationMs,
        );
      });
      return;
    }

    if (step.type === 'expression') {
      characterIds.forEach(characterId => {
        this.clearExpressionReset(characterId);
        this.ports.setCharacterExpressionPreset(characterId, step.expressionPresetId);

        if (step.durationMs !== undefined) {
          this.scheduleExpressionReset(characterId, step.durationMs, this.generalScheduler);
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

    if (step.type === 'dialogue') {
      this.ports.playDialogue?.({
        dialogueGroupId: step.dialogueGroupId,
        scriptId: step.scriptId,
        displayMode: step.displayMode,
        participantIds: characterIds,
        initiatorId,
        targetId,
      });
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
    if (step.type === 'roll') {
      this.ports.rollActivity?.({
        activityId: input.activityId,
        rollId: step.rollId,
        participantIds: input.participantIds,
        hostCharacterIds: input.hostCharacterIds ?? [],
      });
      return;
    }

    if (step.type === 'animation') {
      resolveActivityPerformanceAnimationTargetIds(
        step.target,
        input.participantIds,
        input.hostCharacterIds,
      ).forEach(characterId => {
        this.ports.playCharacterAnimation?.(characterId, step.animationId, step.durationMs);
      });
      return;
    }

    const characterIds = resolveActivityPerformanceTargetIds(
      step.target,
      input.participantIds,
      input.hostCharacterIds,
    );

    if (characterIds.length === 0) {
      return;
    }

    if (step.type === 'bubble') {
      const templateValues = this.getActivityPerformanceTemplateValues(input);

      characterIds.forEach(characterId => {
        this.ports.showCharacterBubble(
          characterId,
          formatTemplate(step.text, templateValues),
          step.durationMs,
        );
      });
      return;
    }

    if (step.type === 'expression') {
      characterIds.forEach(characterId => {
        this.clearExpressionReset(characterId);
        this.ports.setCharacterExpressionPreset(characterId, step.expressionPresetId);

        if (step.durationMs !== undefined) {
          this.scheduleExpressionReset(
            characterId,
            step.durationMs,
            this.getActivityScheduler(input.activityId),
          );
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
      const label = formatTemplate(
        step.label ?? step.effectId,
        this.getActivityPerformanceTemplateValues(input),
      );

      if (input.phase === 'participantLeftGroup') {
        characterIds.forEach(characterId => {
          this.ports.showMapActivity(
            {
              id: createParticipantLeftMapEffectId(step.effectId, input.activityId, characterId),
              label,
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
          label,
          participantIds: characterIds,
          interaction: input.phase === 'active'
            && this.getSelectedActivityDialogueScriptId(input.selection)
            ? {
              activityId: input.activityId,
              label: '觀察',
            }
            : undefined,
        },
        step.durationMs,
      );
      return;
    }

    if (step.type === 'dialogue') {
      const initiatorId = input.hostCharacterIds?.[0] ?? input.participantIds[0];

      if (!initiatorId) {
        return;
      }

      const targetId = characterIds.find(characterId => characterId !== initiatorId);

      this.ports.playDialogue?.({
        dialogueGroupId: step.dialogueGroupId,
        scriptId: step.scriptId,
        displayMode: step.displayMode,
        participantIds: characterIds,
        initiatorId,
        targetId,
      });
      return;
    }

    if (step.type === 'motion') {
      return;
    }
  }

  private scheduleExpressionReset(
    characterId: string,
    durationMs: number,
    scheduler: PausableTimeoutScheduler,
  ): void {
    this.clearExpressionReset(characterId);

    const timerId = scheduler.schedule(() => {
      this.expressionResetTimersByCharacterId.delete(characterId);
      this.ports.setCharacterExpressionPreset(characterId, DEFAULT_EXPRESSION_PRESET_ID);
    }, durationMs);

    this.expressionResetTimersByCharacterId.set(characterId, {
      scheduler,
      timerId,
    });
  }

  private playFallbackParticipantLeftGroupPerformance(input: CharacterActivityPerformanceInput): void {
    input.participantIds.forEach(characterId => {
      this.clearExpressionReset(characterId);
      this.ports.setCharacterExpressionPreset(characterId, 'surprised');
      this.ports.showCharacterEmote(characterId, getEmoteLabel('surprised'), PARTICIPANT_LEFT_REACTION_MS);
      this.scheduleExpressionReset(
        characterId,
        PARTICIPANT_LEFT_REACTION_MS,
        this.getActivityScheduler(input.activityId),
      );
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

  private getSelectedActivityDialogueScriptId(
    selection: CharacterPerformanceSelection,
  ): string | undefined {
    if (!selection.definitionId || !selection.variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[selection.definitionId]?.presentationVariants
      ?.find(variant => variant.id === selection.variantId)
      ?.activity
      ?.dialogueScriptId;
  }

  private clearExpressionReset(characterId: string): void {
    const expressionResetTimer = this.expressionResetTimersByCharacterId.get(characterId);

    if (!expressionResetTimer) {
      return;
    }

    expressionResetTimer.scheduler.cancel(expressionResetTimer.timerId);
    this.expressionResetTimersByCharacterId.delete(characterId);
  }

  private getActivityScheduler(activityId: string): PausableTimeoutScheduler {
    const existingScheduler = this.activitySchedulersByActivityId.get(activityId);

    if (existingScheduler) {
      return existingScheduler;
    }

    const scheduler = new PausableTimeoutScheduler();

    if (this.isWorldPaused && activityId !== this.observedActivityId) {
      scheduler.pause();
    }

    this.activitySchedulersByActivityId.set(activityId, scheduler);
    return scheduler;
  }

  private getActivityPerformanceTemplateValues(
    input: CharacterActivityPerformanceInput,
  ): Readonly<Record<string, string>> {
    const hostIds = input.hostCharacterIds?.length
      ? input.hostCharacterIds
      : input.participantIds.slice(0, 1);
    const hostIdSet = new Set(hostIds);
    const targetIds = input.participantIds.filter(characterId => !hostIdSet.has(characterId));

    return {
      initiator: formatCharacterNames(hostIds, characterId => this.ports.getCharacterName(characterId)),
      target: formatCharacterNames(targetIds, characterId => this.ports.getCharacterName(characterId)),
      ...input.templateValues,
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
  return formatTemplate(template, {
    initiator: initiatorName,
    target: targetName,
  });
}

function formatTemplate(
  template: string,
  values: Readonly<Record<string, string>>,
): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => (
    values[key] ?? `{${key}}`
  ));
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

function resolvePerformanceAnimationTargetIds(
  target: CharacterPerformanceAnimationTarget,
  initiatorId: string,
  targetId: string,
): string[] {
  if (target === 'heldItem') {
    return [initiatorId];
  }

  return resolvePerformanceTargetIds(target, initiatorId, targetId);
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

function resolveActivityPerformanceAnimationTargetIds(
  target: CharacterPerformanceAnimationTarget,
  participantIds: readonly string[],
  hostCharacterIds: readonly string[] = [],
): string[] {
  if (target === 'heldItem') {
    return hostCharacterIds.length > 0
      ? [...hostCharacterIds]
      : participantIds.slice(0, 1);
  }

  return resolveActivityPerformanceTargetIds(target, participantIds, hostCharacterIds);
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

  return Math.max(...steps.map(step => (
    (step.delayMs ?? 0) + (step.type === 'roll' ? 0 : (step.durationMs ?? 0))
  )));
}

function getEmoteLabel(emoteId: string): string {
  const emoteLabels: Record<string, string> = {
    laugh: '大笑',
    play: '玩',
    talk: '聊',
    angry: '怒',
    surprised: '!',
    sigh: '...',
  };

  return emoteLabels[emoteId] ?? emoteId;
}
