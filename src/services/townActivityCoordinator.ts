import type { Position } from '~/constants/character';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';

interface TownActivityCoordinatorOptions {
  activityManager: JoinableActivityManager;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterPosition: (characterId: string) => Position | null;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  notifyActivitiesChanged: () => void;
}

// joinable activity 加入、查找、過期清理
export class TownActivityCoordinator {
  private readonly activityManager: JoinableActivityManager;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityCoordinatorOptions) {
    this.activityManager = options.activityManager;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterPosition = options.getCharacterPosition;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
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
    this.showCharacterBubble(characterId, '我也要一起玩！', 2200);
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
      phases: ['forming', 'active'],
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
}

