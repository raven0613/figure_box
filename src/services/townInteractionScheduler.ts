import type { Position } from '~/constants/character';
import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type { CharacterPerformanceBubble } from '~/services/characterEvents/characterPerformanceRunner';
import type { JoinableActivityManager } from '~/services/characterEvents/joinableActivities';
import type { CharacterPerformancePhase } from '~/services/characterEvents/performances';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import {
  CHAT_INTERACTION_DURATION_MS,
  DEFAULT_ACTIVE_BUBBLE_DELAY_MS,
  DEFAULT_PLAY_DURATION_MS,
  END_BUBBLE_DURATION_MS,
  type InteractionProposalConfig,
  type InteractionType,
} from '~/constants/townInteractionConfig';

interface TownInteractionSchedulerOptions {
  activityManager: JoinableActivityManager;
  getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  getCharacterPosition: (characterId: string) => Position | null;
  getSelectedActivityDefinition: (snapshot: CharacterSnapshot) => CharacterEventActivity | undefined;
  getBubbleOrFallback: (
    snapshot: CharacterSnapshot | null,
    phase: CharacterPerformancePhase,
    fallbackTemplate: string,
    fallbackDurationMs: number,
    initiatorId: string,
    targetId: string,
  ) => CharacterPerformanceBubble;
  playPhaseIfSnapshotExists: (
    snapshot: CharacterSnapshot | null,
    phase: CharacterPerformancePhase,
    initiatorId: string,
    targetId: string,
  ) => void;
  showSameBubbleToPair: (
    initiatorId: string,
    targetId: string,
    bubble: CharacterPerformanceBubble,
  ) => void;
  notifyActivitiesChanged: () => void;
  sendToCharacter: SendCharacterEvent;
}

// chat/play timer、active/end bubble、play activity lifecycle
export class TownInteractionScheduler {
  private readonly chatTimers = new Map<string, number>();
  private readonly playStartTimers = new Map<string, number>();
  private readonly playEndTimers = new Map<string, number>();
  private readonly activityManager: JoinableActivityManager;
  private readonly getCharacterSnapshot: (characterId: string) => CharacterSnapshot | null;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getSelectedActivityDefinition: (snapshot: CharacterSnapshot) => CharacterEventActivity | undefined;
  private readonly getBubbleOrFallback: TownInteractionSchedulerOptions['getBubbleOrFallback'];
  private readonly playPhaseIfSnapshotExists: TownInteractionSchedulerOptions['playPhaseIfSnapshotExists'];
  private readonly showSameBubbleToPair: TownInteractionSchedulerOptions['showSameBubbleToPair'];
  private readonly notifyActivitiesChanged: () => void;
  private readonly sendToCharacter: SendCharacterEvent;

  constructor(options: TownInteractionSchedulerOptions) {
    this.activityManager = options.activityManager;
    this.getCharacterSnapshot = options.getCharacterSnapshot;
    this.getCharacterPosition = options.getCharacterPosition;
    this.getSelectedActivityDefinition = options.getSelectedActivityDefinition;
    this.getBubbleOrFallback = options.getBubbleOrFallback;
    this.playPhaseIfSnapshotExists = options.playPhaseIfSnapshotExists;
    this.showSameBubbleToPair = options.showSameBubbleToPair;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
    this.sendToCharacter = options.sendToCharacter;
  }

  dispose(): void {
    this.clearTimerMap(this.chatTimers);
    this.clearTimerMap(this.playStartTimers);
    this.clearTimerMap(this.playEndTimers);
  }

  scheduleInteractionEnd(
    proposalId: string,
    initiatorId: string,
    targetId: string,
    config: InteractionProposalConfig,
  ): void {
    if (config.interactionType === 'play') {
      this.schedulePlayEnd(proposalId, initiatorId, targetId, config);
      return;
    }

    this.scheduleChatEnd(proposalId, initiatorId, targetId, config);
  }

  private scheduleChatEnd(
    proposalId: string,
    initiatorId: string,
    targetId: string,
    config: InteractionProposalConfig,
  ): void {
    const initiatorSnapshot = this.getCharacterSnapshot(initiatorId);
    const activeBubble = this.getBubbleOrFallback(
      initiatorSnapshot,
      'active',
      config.copy.activeTemplate,
      config.copy.activeDurationMs,
      initiatorId,
      targetId,
    );
    const activeTimerKey = `${proposalId}.active`;

    const startTimerId = window.setTimeout(() => {
      this.chatTimers.delete(activeTimerKey);
      this.playPhaseIfSnapshotExists(initiatorSnapshot, 'active', initiatorId, targetId);
      this.showSameBubbleToPair(initiatorId, targetId, activeBubble);
    }, activeBubble.delayMs ?? DEFAULT_ACTIVE_BUBBLE_DELAY_MS);

    this.chatTimers.set(activeTimerKey, startTimerId);

    const timerId = window.setTimeout(() => {
      const endSnapshot = this.getCharacterSnapshot(initiatorId);
      const endBubble = this.getBubbleOrFallback(
        endSnapshot,
        'end',
        config.copy.endTemplate,
        END_BUBBLE_DURATION_MS,
        initiatorId,
        targetId,
      );

      this.playPhaseIfSnapshotExists(endSnapshot, 'end', initiatorId, targetId);
      this.showSameBubbleToPair(initiatorId, targetId, endBubble);
      this.clearTimer(this.chatTimers, activeTimerKey);
      this.chatTimers.delete(proposalId);
      this.endInteractionForPair(initiatorId, targetId, proposalId, config.interactionType);
    }, CHAT_INTERACTION_DURATION_MS);

    this.chatTimers.set(proposalId, timerId);
  }

  private schedulePlayEnd(
    proposalId: string,
    initiatorId: string,
    targetId: string,
    config: InteractionProposalConfig,
  ): void {
    const initiatorSnapshot = this.getCharacterSnapshot(initiatorId);
    const activityId = initiatorSnapshot
      ? this.createJoinableActivityForInteraction(proposalId, initiatorSnapshot, initiatorId, targetId)
      : null;
    const playDurationMs = initiatorSnapshot
      ? this.getSelectedActivityDefinition(initiatorSnapshot)?.durationMs ?? DEFAULT_PLAY_DURATION_MS
      : DEFAULT_PLAY_DURATION_MS;
    const activeBubble = this.getBubbleOrFallback(
      initiatorSnapshot,
      'active',
      config.copy.activeTemplate,
      config.copy.activeDurationMs,
      initiatorId,
      targetId,
    );

    const startTimerId = window.setTimeout(() => {
      this.playStartTimers.delete(proposalId);

      if (initiatorSnapshot) {
        if (activityId) {
          this.activityManager.updateActivityPhase(
            activityId,
            'active',
            this.getCharacterPosition(initiatorId) ?? initiatorSnapshot.context.position,
          );
          this.notifyActivitiesChanged();
        }
        this.playPhaseIfSnapshotExists(initiatorSnapshot, 'active', initiatorId, targetId);
      }
      this.showSameBubbleToPair(initiatorId, targetId, activeBubble);
    }, activeBubble.delayMs ?? DEFAULT_ACTIVE_BUBBLE_DELAY_MS);

    this.playStartTimers.set(proposalId, startTimerId);

    const timerId = window.setTimeout(() => {
      const endSnapshot = this.getCharacterSnapshot(initiatorId);
      const endBubble = this.getBubbleOrFallback(
        endSnapshot,
        'end',
        config.copy.endTemplate,
        END_BUBBLE_DURATION_MS,
        initiatorId,
        targetId,
      );

      this.playPhaseIfSnapshotExists(endSnapshot, 'end', initiatorId, targetId);
      this.showSameBubbleToPair(initiatorId, targetId, endBubble);
      this.endJoinableActivityForPlay(activityId, initiatorId, targetId);
      this.playEndTimers.delete(proposalId);
      this.endInteractionForPair(initiatorId, targetId, proposalId, config.interactionType);
    }, playDurationMs);

    this.playEndTimers.set(proposalId, timerId);
  }

  private createJoinableActivityForInteraction(
    proposalId: string,
    snapshot: CharacterSnapshot,
    initiatorId: string,
    targetId: string,
  ): string | null {
    const sourceEventId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const activity = this.getSelectedActivityDefinition(snapshot);

    if (!sourceEventId || !activity?.joinable) {
      return null;
    }

    const activityId = `interaction.${proposalId}`;

    this.activityManager.createActivity({
      id: activityId,
      sourceEventId,
      activity,
      hostCharacterIds: [initiatorId],
      participantIds: [initiatorId, targetId],
      timestamp: Date.now(),
      phase: 'forming',
      location: this.getCharacterPosition(initiatorId) ?? snapshot.context.position,
    });
    this.notifyActivitiesChanged();

    return activityId;
  }

  private endJoinableActivityForPlay(
    activityId: string | null,
    initiatorId: string,
    targetId: string,
  ): void {
    if (!activityId) {
      return;
    }

    const endedActivity = this.activityManager.endActivity(activityId);

    endedActivity?.participantIds
      .filter(participantId => participantId !== initiatorId && participantId !== targetId)
      .forEach(participantId => {
        this.sendToCharacter(participantId, {
          type: EventType.EndJoinedActivity,
          activityId,
          timestamp: Date.now(),
        });
      });
    this.notifyActivitiesChanged();
  }

  private endInteractionForPair(
    initiatorId: string,
    targetId: string,
    proposalId: string,
    interactionType: InteractionType,
  ): void {
    const timestamp = Date.now();

    if (interactionType === 'chat') {
      this.sendToCharacter(initiatorId, { type: EventType.EndChatInteraction, proposalId, timestamp });
      this.sendToCharacter(targetId, { type: EventType.EndChatInteraction, proposalId, timestamp });
      return;
    }

    this.sendToCharacter(initiatorId, { type: EventType.EndPlayInteraction, proposalId, timestamp });
    this.sendToCharacter(targetId, { type: EventType.EndPlayInteraction, proposalId, timestamp });
  }

  private clearTimerMap(timerMap: Map<string, number>): void {
    timerMap.forEach(timerId => window.clearTimeout(timerId));
    timerMap.clear();
  }

  private clearTimer(timerMap: Map<string, number>, timerKey: string): void {
    const timerId = timerMap.get(timerKey);

    if (!timerId) {
      return;
    }

    window.clearTimeout(timerId);
    timerMap.delete(timerKey);
  }
}
