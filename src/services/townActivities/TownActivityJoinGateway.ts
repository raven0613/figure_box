import type { Position } from '~/constants/character';
import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import { EventType } from '~/stateMachines/gameFlow/events';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import {
  getGroupMaxParticipants,
  getItemJoinRequirementScope,
} from '~/services/townActivities/townActivityRules';

interface TownActivityJoinGatewayOptions {
  activityManager: JoinableActivityManager;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterPosition: (characterId: string) => Position | null;
  getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  actorHasItem: (characterId: string, itemId: string) => boolean;
  sendToCharacter: SendCharacterEvent;
}

export class TownActivityJoinGateway {
  private readonly activityManager: JoinableActivityManager;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getActivityDefinition: (
    activity: JoinableActivity,
  ) => CharacterEventActivity | undefined;
  private readonly actorHasItem: (characterId: string, itemId: string) => boolean;
  private readonly sendToCharacter: SendCharacterEvent;

  constructor(options: TownActivityJoinGatewayOptions) {
    this.activityManager = options.activityManager;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterPosition = options.getCharacterPosition;
    this.getActivityDefinition = options.getActivityDefinition;
    this.actorHasItem = options.actorHasItem;
    this.sendToCharacter = options.sendToCharacter;
  }

  getNearbyJoinableActivities(
    characterId: string,
    timestamp: number,
  ): readonly JoinableActivity[] {
    const position = this.getCharacterPosition(characterId);

    if (!position) {
      return [];
    }

    return this.getNearbyJoinableActivitiesAtPosition(characterId, position, timestamp);
  }

  getNearbyJoinableActivitiesAtPosition(
    characterId: string,
    position: Position,
    timestamp: number,
  ): readonly JoinableActivity[] {
    return this.activityManager.findNearbyActivities({
      position,
      timestamp,
      phases: ['forming', 'traveling', 'active'],
    }).filter(activity => this.canCharacterJoinActivity(characterId, activity));
  }

  canCharacterJoinActivity(characterId: string, activity: JoinableActivity): boolean {
    if (activity.participantIds.includes(characterId)) {
      return false;
    }

    const context = this.getCharacterContext(characterId);

    if (!context) {
      return false;
    }

    if (context.controlState !== CharacterControlState.Normal) {
      return false;
    }

    const activityDefinition = this.getActivityDefinition(activity);

    if (activityDefinition && activity.participantIds.length >= getGroupMaxParticipants(activityDefinition)) {
      return false;
    }

    const joinRequirements = activity.joinRequirements;

    switch (joinRequirements.type) {
      case 'none':
        return true;
      case 'hasItem':
        if (getItemJoinRequirementScope(joinRequirements) === 'host') {
          return activity.hostCharacterIds.some(hostCharacterId => (
            this.actorHasItem(hostCharacterId, joinRequirements.itemId)
          ));
        }

        return this.actorHasItem(characterId, joinRequirements.itemId);
    }
  }

  joinActivityByGodDrop(characterId: string, activityId: string): boolean {
    const activity = this.activityManager.getActivity(activityId);

    if (!activity || !this.canCharacterJoinActivity(characterId, activity)) {
      return false;
    }

    return this.sendToCharacter(characterId, {
      type: EventType.JoinActivity,
      activityId: activity.id,
      sourceEventId: activity.sourceEventId,
    });
  }
}
