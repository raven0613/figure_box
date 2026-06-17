import type { Position } from '~/constants/character';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import { EventType } from '~/stateMachines/gameFlow/events';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import { isNearPosition } from '~/services/townActivities/townActivityRules';

interface TownActivityJoinTravelFlowOptions {
  activityManager: JoinableActivityManager;
  canCharacterJoinActivity: (characterId: string, activity: JoinableActivity) => boolean;
  getTravelTarget: (destination: Position) => Position;
  removeStaleActivityParticipations: (characterId: string, snapshot: CharacterSnapshot) => void;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  playActivityPerformance: (activity: JoinableActivity) => void;
  notifyActivitiesChanged: () => void;
}

export class TownActivityJoinTravelFlow {
  private readonly arrivedCharacterIdsByActivityId = new Map<string, Set<string>>();
  private readonly activityManager: JoinableActivityManager;
  private readonly canCharacterJoinActivity: (
    characterId: string,
    activity: JoinableActivity,
  ) => boolean;
  private readonly getTravelTarget: (destination: Position) => Position;
  private readonly removeStaleActivityParticipations: (
    characterId: string,
    snapshot: CharacterSnapshot,
  ) => void;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (
    characterId: string,
    text: string,
    durationMs?: number,
  ) => void;
  private readonly playActivityPerformance: (activity: JoinableActivity) => void;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityJoinTravelFlowOptions) {
    this.activityManager = options.activityManager;
    this.canCharacterJoinActivity = options.canCharacterJoinActivity;
    this.getTravelTarget = options.getTravelTarget;
    this.removeStaleActivityParticipations = options.removeStaleActivityParticipations;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.playActivityPerformance = options.playActivityPerformance;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  handlePendingActivityJoin(characterId: string, snapshot: CharacterSnapshot): void {
    const activityJoin = snapshot.context.pendingActivityJoin;

    if (!activityJoin) {
      return;
    }

    if (snapshot.context.controlState !== CharacterControlState.Normal) {
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
      this.sendParticipantToActivityLocation(joinedActivity, characterId);
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

  acceptInvitedParticipants(activity: JoinableActivity, hostCharacterId: string): void {
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

  sendParticipantsToActivityLocation(activity: JoinableActivity): void {
    activity.participantIds.forEach(participantId => {
      this.sendParticipantToActivityLocation(activity, participantId);
    });
  }

  sendParticipantToActivityLocation(
    activity: JoinableActivity,
    characterId: string,
  ): void {
    if (!activity.location) {
      return;
    }

    this.sendToCharacter(characterId, {
      type: EventType.MoveTo,
      target: this.getTravelTarget(activity.location),
    });
  }

  deleteArrivedCharacterFromActivity(activityId: string, characterId: string): void {
    this.arrivedCharacterIdsByActivityId.get(activityId)?.delete(characterId);
  }

  deleteArrivalsForActivity(activityId: string): void {
    this.arrivedCharacterIdsByActivityId.delete(activityId);
  }

  clearArrivals(): void {
    this.arrivedCharacterIdsByActivityId.clear();
  }

  private rejectActivityJoin(characterId: string, activityId: string): void {
    this.sendToCharacter(characterId, {
      type: EventType.JoinActivityRejected,
      activityId,
    });
  }

  private getJoinBubbleText(activity: JoinableActivity): string {
    if (activity.type === 'playWithItem') {
      return '我也有，加入！';
    }

    return '我也要一起玩！';
  }
}
