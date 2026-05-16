import type { Position } from '~/constants/character';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
} from '~/constants/charactarEventsDefinitions';
import { resolveActivityDestination } from '~/services/characterEvents/targets';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type { CharacterPerformanceRunner } from '~/services/characterEvents/characterPerformanceRunner';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';

interface TownActivityCoordinatorOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterPosition: (characterId: string) => Position | null;
  getNearbyCharacterIds: (characterId: string, range: number) => string[];
  getTravelTarget: (destination: Position, characterId: string, index: number) => Position;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  notifyActivitiesChanged: () => void;
}

// joinable activity 加入、查找、過期清理
export class TownActivityCoordinator {
  private readonly arrivedCharacterIdsByActivityId = new Map<string, Set<string>>();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getNearbyCharacterIds: (characterId: string, range: number) => string[];
  private readonly getTravelTarget: (destination: Position, characterId: string, index: number) => Position;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityCoordinatorOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterPosition = options.getCharacterPosition;
    this.getNearbyCharacterIds = options.getNearbyCharacterIds;
    this.getTravelTarget = options.getTravelTarget;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  handleCurrentActivity(characterId: string, snapshot: CharacterSnapshot): void {
    const currentActivity = snapshot.context.currentActivity;

    if (!currentActivity || this.activityManager.getActivity(currentActivity.activityId)) {
      return;
    }

    const activityDefinition = this.getSelectedActivityDefinition(snapshot);

    if (!activityDefinition?.joinable) {
      this.sendToCharacter(characterId, {
        type: EventType.EndJoinedActivity,
        activityId: currentActivity.activityId,
        timestamp: Date.now(),
      });
      return;
    }

    const timestamp = Date.now();
    const currentPosition = this.getCharacterPosition(characterId) ?? snapshot.context.position;
    const destination = resolveActivityDestination(activityDefinition.destination);
    const location = destination ?? currentPosition;
    const phase = activityDefinition.startPhase ?? 'active';
    const participantIds = this.getInitialParticipantIds(characterId, activityDefinition);

    const activity = this.activityManager.createActivity({
      id: currentActivity.activityId,
      sourceEventId: currentActivity.sourceEventId,
      activity: activityDefinition,
      hostCharacterIds: [characterId],
      participantIds,
      timestamp,
      phase,
      location,
    });

    this.acceptInvitedParticipants(activity, characterId);

    if (phase === 'traveling') {
      this.sendParticipantsToActivityLocation(activity);
    } else {
      this.playActivityPerformance(activity);
    }

    this.notifyActivitiesChanged();
  }

  handlePendingActivityJoin(characterId: string, snapshot: CharacterSnapshot): void {
    const activityJoin = snapshot.context.pendingActivityJoin;

    if (!activityJoin) {
      return;
    }

    const timestamp = Date.now();
    const activity = this.activityManager.getActivity(activityJoin.activityId);

    if (!activity || activity.endsAt <= timestamp || !this.canCharacterJoinActivity(characterId, activity)) {
      this.rejectActivityJoin(characterId, activityJoin.activityId);
      return;
    }

    const joinedActivity = this.activityManager.joinActivity(activityJoin.activityId, characterId, timestamp);

    if (!joinedActivity) {
      this.rejectActivityJoin(characterId, activityJoin.activityId);
      return;
    }

    this.sendToCharacter(characterId, {
      type: EventType.JoinActivityAccepted,
      activityId: joinedActivity.id,
      sourceEventId: activityJoin.sourceEventId,
    });
    this.showCharacterBubble(characterId, this.getJoinBubbleText(joinedActivity), 2200);

    if (joinedActivity.phase === 'traveling') {
      this.sendParticipantToActivityLocation(joinedActivity, characterId, joinedActivity.participantIds.length - 1);
    } else {
      this.playActivityPerformance(joinedActivity);
    }

    this.notifyActivitiesChanged();
  }

  handleActivityTravelProgress(characterId: string, snapshot: CharacterSnapshot): void {
    this.removeStaleActivityParticipations(characterId, snapshot);

    const activityId = snapshot.context.currentActivity?.activityId;

    if (!activityId) {
      return;
    }

    const activity = this.activityManager.getActivity(activityId);

    if (!activity || activity.phase !== 'traveling' || !activity.location || snapshot.context.target) {
      return;
    }

    if (!isNearPosition(snapshot.context.position, activity.location, 2)) {
      return;
    }

    this.arrivedCharacterIdsByActivityId.set(
      activity.id,
      new Set([
        ...(this.arrivedCharacterIdsByActivityId.get(activity.id) ?? []),
        characterId,
      ]),
    );

    const arrivedCharacterIds = this.arrivedCharacterIdsByActivityId.get(activity.id) ?? new Set<string>();
    const hasEveryoneArrived = activity.participantIds.every(participantId => arrivedCharacterIds.has(participantId));

    if (!hasEveryoneArrived) {
      return;
    }

    const timestamp = Date.now();
    const activeActivity = this.activityManager.updateActivityPhase(activity.id, 'active', activity.location);
    const refreshedActivity = activeActivity
      ? this.activityManager.refreshActivityDuration(activeActivity.id, timestamp)
      : null;

    if (!refreshedActivity) {
      return;
    }

    refreshedActivity.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.JoinActivityAccepted,
        activityId: refreshedActivity.id,
        sourceEventId: refreshedActivity.sourceEventId,
      });
    });
    this.playActivityPerformance(refreshedActivity);
    this.notifyActivitiesChanged();
  }

  removeStaleActivityParticipations(characterId: string, snapshot: CharacterSnapshot): void {
    const staleActivities = this.activityManager.getActivities()
      .filter(activity => (
        activity.participantIds.includes(characterId) &&
        snapshot.context.currentActivity?.activityId !== activity.id &&
        snapshot.context.pendingActivityJoin?.activityId !== activity.id
      ));

    if (staleActivities.length === 0) {
      return;
    }

    staleActivities.forEach(activity => {
      this.activityManager.leaveActivity(activity.id, characterId);
      this.arrivedCharacterIdsByActivityId.get(activity.id)?.delete(characterId);
    });
    this.notifyActivitiesChanged();
  }

  getNearbyJoinableActivities(
    characterId: string,
    timestamp: number,
  ): readonly JoinableActivity[] {
    const position = this.getCharacterPosition(characterId);

    if (!position) {
      return [];
    }

    return this.activityManager.findNearbyActivities({
      position,
      timestamp,
      phases: ['forming', 'traveling', 'active'],
    }).filter(activity => this.canCharacterJoinActivity(characterId, activity));
  }

  pruneEndedActivities(timestamp: number): void {
    const endedActivities = this.activityManager.pruneEndedActivities(timestamp);

    if (endedActivities.length === 0) {
      return;
    }

    endedActivities.forEach(activity => {
      activity.participantIds.forEach(participantId => {
        this.sendToCharacter(participantId, {
          type: EventType.EndJoinedActivity,
          activityId: activity.id,
          timestamp,
        });
      });
      this.arrivedCharacterIdsByActivityId.delete(activity.id);
    });
    this.notifyActivitiesChanged();
  }

  canCharacterJoinActivity(characterId: string, activity: JoinableActivity): boolean {
    if (activity.participantIds.includes(characterId)) {
      return false;
    }

    const context = this.getCharacterContext(characterId);

    if (!context) {
      return false;
    }

    if (activity.joinRequirements.type === 'none') {
      return true;
    }

    return context.ownItems.some(item => item.id === activity.joinRequirements.itemId);
  }

  private rejectActivityJoin(characterId: string, activityId: string): void {
    this.sendToCharacter(characterId, {
      type: EventType.JoinActivityRejected,
      activityId,
    });
  }

  private getInitialParticipantIds(hostCharacterId: string, activityDefinition: CharacterEventActivity): string[] {
    if (!activityDefinition.group) {
      return [hostCharacterId];
    }

    const maxParticipants = activityDefinition.group?.maxParticipants ?? 4;
    const inviteNearbyRange = activityDefinition.group?.inviteNearbyRange ?? 8;
    const invitedParticipantIds = this.getNearbyCharacterIds(hostCharacterId, inviteNearbyRange)
      .filter(characterId => this.canInviteCharacterToActivity(characterId, activityDefinition))
      .slice(0, Math.max(0, maxParticipants - 1));

    return [hostCharacterId, ...invitedParticipantIds];
  }

  private canInviteCharacterToActivity(
    characterId: string,
    activityDefinition: CharacterEventActivity,
  ): boolean {
    const context = this.getCharacterContext(characterId);

    if (!context) {
      return false;
    }

    if (
      context.currentMotivation !== 'idle' ||
      context.target ||
      context.currentInteraction ||
      context.currentActivity ||
      context.pendingInteractionProposal ||
      context.pendingActivityJoin
    ) {
      return false;
    }

    if (!activityDefinition.joinRequirements || activityDefinition.joinRequirements.type === 'none') {
      return true;
    }

    const requiredItemId = activityDefinition.joinRequirements.itemId;

    return context.ownItems.some(item => item.id === requiredItemId);
  }

  private acceptInvitedParticipants(activity: JoinableActivity, hostCharacterId: string): void {
    activity.participantIds
      .filter(participantId => participantId !== hostCharacterId)
      .forEach(participantId => {
        this.sendToCharacter(participantId, {
          type: EventType.JoinActivityAccepted,
          activityId: activity.id,
          sourceEventId: activity.sourceEventId,
        });
        this.showCharacterBubble(participantId, this.getJoinBubbleText(activity), 2200);
      });
  }

  private sendParticipantsToActivityLocation(activity: JoinableActivity): void {
    activity.participantIds.forEach((participantId, index) => {
      this.sendParticipantToActivityLocation(activity, participantId, index);
    });
  }

  private sendParticipantToActivityLocation(
    activity: JoinableActivity,
    characterId: string,
    index: number,
  ): void {
    if (!activity.location) {
      return;
    }

    this.sendToCharacter(characterId, {
      type: EventType.MoveTo,
      target: this.getTravelTarget(activity.location, characterId, index),
    });
  }

  private getSelectedActivityDefinition(snapshot: CharacterSnapshot): CharacterEventActivity | undefined {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const variantId = snapshot.context.lastEventDecision?.selectedPresentationVariantId;

    if (!definitionId || !variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.presentationVariants
      ?.find(variant => variant.id === variantId)
      ?.activity;
  }

  private playActivityPerformance(activity: JoinableActivity): void {
    this.performanceRunner.playActivityPerformanceSteps({
      selection: this.getActivityPerformanceSelection(activity),
      phase: 'active',
      activityId: activity.id,
      participantIds: activity.participantIds,
      hostCharacterIds: activity.hostCharacterIds,
    });
  }

  private getActivityPerformanceSelection(activity: JoinableActivity) {
    return {
      definitionId: activity.sourceEventId,
      variantId: CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
        ?.find(variant => variant.activity?.key === activity.activityKey)
        ?.id,
    };
  }

  private getJoinBubbleText(activity: JoinableActivity): string {
    if (activity.type === 'playWithItem') {
      return '我也有，加入！';
    }

    return '我也要一起玩！';
  }
}

function isNearPosition(position: Position, target: Position, range: number): boolean {
  return Math.max(
    Math.abs(position.x - target.x),
    Math.abs(position.y - target.y),
  ) <= range;
}
