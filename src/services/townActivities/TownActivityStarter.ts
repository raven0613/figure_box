import type { Position } from '~/constants/character';
import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import { resolveActivityDestination } from '~/services/characterEvents/targets';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import {
  getPostInviteActivityPhase,
  shouldResolveGroupInvites,
} from '~/services/townActivities/townActivityRules';

interface TownActivityStarterOptions {
  activityManager: JoinableActivityManager;
  getCharacterPosition: (characterId: string) => Position | null;
  getSelectedActivityDefinition: (snapshot: CharacterSnapshot) => CharacterEventActivity | undefined;
  getInvitedParticipantIds: (
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
    sourceEventId: string,
  ) => string[];
  handleGroupInviteResolution: (
    activity: JoinableActivity,
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
  ) => void;
  acceptInvitedParticipants: (activity: JoinableActivity, hostCharacterId: string) => void;
  sendParticipantsToActivityLocation: (activity: JoinableActivity) => void;
  playActivityPerformance: (activity: JoinableActivity) => void;
  isActivityEnding: (activityId: string) => boolean;
  sendToCharacter: SendCharacterEvent;
  notifyActivitiesChanged: () => void;
}

export class TownActivityStarter {
  private readonly activityManager: JoinableActivityManager;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getSelectedActivityDefinition: (
    snapshot: CharacterSnapshot,
  ) => CharacterEventActivity | undefined;
  private readonly getInvitedParticipantIds: (
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
    sourceEventId: string,
  ) => string[];
  private readonly handleGroupInviteResolution: (
    activity: JoinableActivity,
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
  ) => void;
  private readonly acceptInvitedParticipants: (
    activity: JoinableActivity,
    hostCharacterId: string,
  ) => void;
  private readonly sendParticipantsToActivityLocation: (activity: JoinableActivity) => void;
  private readonly playActivityPerformance: (activity: JoinableActivity) => void;
  private readonly isActivityEnding: (activityId: string) => boolean;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityStarterOptions) {
    this.activityManager = options.activityManager;
    this.getCharacterPosition = options.getCharacterPosition;
    this.getSelectedActivityDefinition = options.getSelectedActivityDefinition;
    this.getInvitedParticipantIds = options.getInvitedParticipantIds;
    this.handleGroupInviteResolution = options.handleGroupInviteResolution;
    this.acceptInvitedParticipants = options.acceptInvitedParticipants;
    this.sendParticipantsToActivityLocation = options.sendParticipantsToActivityLocation;
    this.playActivityPerformance = options.playActivityPerformance;
    this.isActivityEnding = options.isActivityEnding;
    this.sendToCharacter = options.sendToCharacter;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  handleCurrentActivity(characterId: string, snapshot: CharacterSnapshot): void {
    const currentActivity = snapshot.context.currentActivity;

    if (
      !currentActivity ||
      this.activityManager.getActivity(currentActivity.activityId) ||
      this.isActivityEnding(currentActivity.activityId)
    ) {
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
    const phase = shouldResolveGroupInvites(activityDefinition)
      ? 'inviting'
      : getPostInviteActivityPhase(activityDefinition);
    const participantIds = this.getInvitedParticipantIds(
      characterId,
      activityDefinition,
      currentActivity.sourceEventId,
    );

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

    if (phase === 'inviting') {
      this.handleGroupInviteResolution(activity, characterId, activityDefinition);
      this.notifyActivitiesChanged();
      return;
    }

    this.acceptInvitedParticipants(activity, characterId);

    if (phase === 'traveling') {
      this.sendParticipantsToActivityLocation(activity);
    } else {
      this.playActivityPerformance(activity);
    }

    this.notifyActivitiesChanged();
  }
}
