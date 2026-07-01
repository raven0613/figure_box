import type { Position, SocialStatus } from '~/constants/character';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
  type CharacterEventActivityRollBranch,
  type CharacterEventActivityEffects,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import type { CharacterWayOfSaying } from '~/typing/characterProfile';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import type {
  CharacterPerformanceActivityRollRequest,
  CharacterPerformanceDialogueRequest,
  CharacterPerformanceSelection,
  CharacterPerformanceRunner,
} from '~/services/characterEvents/characterPerformanceRunner';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type {
  ResolveActivityOutcomeInput,
  ResolvedActivityOutcome,
} from '~/services/characterEvents/activityOutcomeResolver';
import { TownActivityDefinitionResolver } from '~/services/townActivities/TownActivityDefinitionResolver';
import { TownActivityDialogueObserver } from '~/services/townActivities/TownActivityDialogueObserver';
import { TownActivityDialogueSubjects } from '~/services/townActivities/TownActivityDialogueSubjects';
import { TownActivityInviteResolver } from '~/services/townActivities/TownActivityInviteResolver';
import { TownActivityJoinGateway } from '~/services/townActivities/TownActivityJoinGateway';
import { TownActivityJoinTravelFlow } from '~/services/townActivities/TownActivityJoinTravelFlow';
import { TownActivityParticipantLifecycle } from '~/services/townActivities/TownActivityParticipantLifecycle';
import { TownActivityPerformanceDirector } from '~/services/townActivities/TownActivityPerformanceDirector';
import { TownActivityRollResolver } from '~/services/townActivities/TownActivityRollResolver';
import { TownActivityStarter } from '~/services/townActivities/TownActivityStarter';
import { TownActivityTimeoutController } from '~/services/townActivities/TownActivityTimeoutController';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CancelActivityRouteOptions } from '~/services/townMovementCoordinator';

interface TownActivityCoordinatorOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterName: (characterId: string) => string;
  getCharacterWayOfSaying: (characterId: string) => CharacterWayOfSaying | undefined;
  getCharacterPersonality: (characterId: string) => CharacterPersonality;
  getCharacterPosition: (characterId: string) => Position | null;
  getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  getNearbyCharacterIds: (characterId: string, range: number) => string[];
  getTravelTarget: (destination: Position) => Position;
  startJoggingRoute: (input: {
    activityId: string;
    participantIds: readonly string[];
    location: Position;
  }) => void;
  startStrollTogetherRoute: (input: {
    activityId: string;
    participantIds: readonly string[];
    location: Position;
  }) => void;
  startJoggingRace: (activityId: string) => void;
  finishJoggingRoute: (activityId: string) => void;
  cancelActivityRoute: (activityId: string, options?: CancelActivityRouteOptions) => void;
  actorHasItem: (characterId: string, itemId: string) => boolean;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  resolveActivityOutcome: (input: ResolveActivityOutcomeInput) => ResolvedActivityOutcome;
  notifyActivitiesChanged: () => void;
}

export interface InteractionCardActivityInput {
  eventId: string;
  initiatorId: string;
  targetId: string;
}

const DEFAULT_ACTIVITY_RESPONSE_DELAY_MS = 1200;
const DEFAULT_ACTIVITY_END_DURATION_MS = 1000;
const JOGGING_ACTIVITY_KEY = 'life.jogging';
const JOGGING_FINISH_ROLL_ID = 'joggingFinish';
const GROUP_ACTIVITY_MIN_PARTICIPANT_COUNT = 2;

// joinable activity 加入、查找、過期清理
export class TownActivityCoordinator {
  private readonly activityDefinitionResolver = new TownActivityDefinitionResolver();
  private readonly dialogueSubjects: TownActivityDialogueSubjects;
  private readonly dialogueObserver: TownActivityDialogueObserver;
  private readonly timeoutController = new TownActivityTimeoutController();
  private readonly inviteResolver: TownActivityInviteResolver;
  private readonly joinGateway: TownActivityJoinGateway;
  private readonly joinTravelFlow: TownActivityJoinTravelFlow;
  private readonly participantLifecycle: TownActivityParticipantLifecycle;
  private readonly performanceDirector: TownActivityPerformanceDirector;
  private readonly rollResolver: TownActivityRollResolver;
  private readonly activityStarter: TownActivityStarter;
  private readonly endingActivityIds = new Set<string>();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterName: (characterId: string) => string;
  private readonly getCharacterWayOfSaying: (characterId: string) => CharacterWayOfSaying | undefined;
  private readonly getCharacterPersonality: (characterId: string) => CharacterPersonality;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  private readonly getNearbyCharacterIds: (characterId: string, range: number) => string[];
  private readonly actorHasItem: (characterId: string, itemId: string) => boolean;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly resolveActivityOutcome: (
    input: ResolveActivityOutcomeInput,
  ) => ResolvedActivityOutcome;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityCoordinatorOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterName = options.getCharacterName;
    this.getCharacterWayOfSaying = options.getCharacterWayOfSaying;
    this.getCharacterPersonality = options.getCharacterPersonality;
    this.getCharacterPosition = options.getCharacterPosition;
    this.getRelationshipStatus = options.getRelationshipStatus;
    this.getNearbyCharacterIds = options.getNearbyCharacterIds;
    this.actorHasItem = options.actorHasItem;
    this.sendToCharacter = options.sendToCharacter;
    this.resolveActivityOutcome = options.resolveActivityOutcome;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
    this.dialogueSubjects = new TownActivityDialogueSubjects({
      getCharacterContext: this.getCharacterContext,
    });
    this.dialogueObserver = new TownActivityDialogueObserver({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      dialogueSubjects: this.dialogueSubjects,
      getCharacterContext: this.getCharacterContext,
      getCharacterName: this.getCharacterName,
      getCharacterWayOfSaying: this.getCharacterWayOfSaying,
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      getActivityPerformanceSelection: activity => this.getActivityPerformanceSelection(activity),
      isActivityEnding: activityId => this.endingActivityIds.has(activityId),
      resolveActivityRoll: request => this.resolveActivityRoll(request),
      recordSpokenLine: input => {
        this.sendToCharacter(input.speakerId, {
          type: EventType.RememberSpokenLine,
          targetCharId: input.targetId,
          memoryKey: input.memoryKey,
          text: input.text,
        });
      },
      resolveActivityFromRoll: (activity, branch) => {
        this.resolveActivityFromRoll(activity, branch);
      },
      playActivityEndPerformance: (activity, timestamp) => {
        this.playActivityEndPerformance(activity, timestamp);
      },
      notifyActivitiesChanged: this.notifyActivitiesChanged,
    });
    this.rollResolver = new TownActivityRollResolver({
      activityManager: this.activityManager,
      dialogueObserver: this.dialogueObserver,
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      getCharacterContext: this.getCharacterContext,
      getCharacterPersonality: this.getCharacterPersonality,
      getRelationshipStatus: this.getRelationshipStatus,
      isActivityEnding: activityId => this.endingActivityIds.has(activityId),
      resolveActivityFromRoll: (activity, branch) => {
        this.resolveActivityFromRoll(activity, branch);
      },
      playActivityRollBranchPerformance: (activity, branch) => (
        this.playActivityRollBranchPerformance(activity, branch)
      ),
    });
    this.performanceDirector = new TownActivityPerformanceDirector({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      dialogueSubjects: this.dialogueSubjects,
      getCharacterName: this.getCharacterName,
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      getActivityPerformanceSelection: activity => this.getActivityPerformanceSelection(activity),
      getActivityEffects: activity => this.getActivityEffects(activity),
      getActivityEffectsByRole: activity => this.getActivityEffectsByRole(activity),
      resolveActivityOutcome: this.resolveActivityOutcome,
      scheduleActivityTimeout: (activityId, callback, delayMs) => {
        this.scheduleActivityTimeout(activityId, callback, delayMs);
      },
      markActivityEnding: activityId => {
        this.endingActivityIds.add(activityId);
      },
      unmarkActivityEnding: activityId => {
        this.endingActivityIds.delete(activityId);
      },
      clearRollSelectionsForActivity: activityId => {
        this.rollResolver.deleteSelectionsForActivity(activityId);
      },
      startJoggingRoute: options.startJoggingRoute,
      startStrollTogetherRoute: options.startStrollTogetherRoute,
      startJoggingRace: options.startJoggingRace,
      finishJoggingRoute: options.finishJoggingRoute,
      cancelActivityRoute: options.cancelActivityRoute,
      notifyActivitiesChanged: this.notifyActivitiesChanged,
      activityEndDurationMs: DEFAULT_ACTIVITY_END_DURATION_MS,
    });
    this.joinGateway = new TownActivityJoinGateway({
      activityManager: this.activityManager,
      getCharacterContext: this.getCharacterContext,
      getCharacterPosition: this.getCharacterPosition,
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      actorHasItem: this.actorHasItem,
      sendToCharacter: this.sendToCharacter,
    });
    this.joinTravelFlow = new TownActivityJoinTravelFlow({
      activityManager: this.activityManager,
      canCharacterJoinActivity: (characterId, activity) => (
        this.joinGateway.canCharacterJoinActivity(characterId, activity)
      ),
      getTravelTarget: options.getTravelTarget,
      removeStaleActivityParticipations: (characterId, snapshot) => {
        this.removeStaleActivityParticipations(characterId, snapshot);
      },
      sendToCharacter: this.sendToCharacter,
      showCharacterBubble: options.showCharacterBubble,
      playActivityPerformance: activity => this.playActivityPerformance(activity),
      notifyActivitiesChanged: this.notifyActivitiesChanged,
    });
    this.participantLifecycle = new TownActivityParticipantLifecycle({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      dialogueSubjects: this.dialogueSubjects,
      dialogueObserver: this.dialogueObserver,
      sendToCharacter: this.sendToCharacter,
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      getActivityPerformanceSelection: activity => this.getActivityPerformanceSelection(activity),
      clearActivityVisuals: activity => this.clearActivityVisuals(activity),
      playParticipantLeftPerformance: (activity, previousParticipantCount) => {
        this.playParticipantLeftPerformance(activity, previousParticipantCount);
      },
      deleteArrivedCharacterFromActivity: (activityId, characterId) => {
        this.joinTravelFlow.deleteArrivedCharacterFromActivity(activityId, characterId);
      },
      deleteArrivalsForActivity: activityId => {
        this.joinTravelFlow.deleteArrivalsForActivity(activityId);
      },
      clearArrivals: () => {
        this.joinTravelFlow.clearArrivals();
      },
      deleteEndingActivity: activityId => {
        this.endingActivityIds.delete(activityId);
      },
      clearEndingActivities: () => {
        this.endingActivityIds.clear();
      },
      deleteRollSelectionsForActivity: activityId => {
        this.rollResolver.deleteSelectionsForActivity(activityId);
      },
      clearRollSelections: () => {
        this.rollResolver.clearSelections();
      },
      disposeActivityTimeouts: () => {
        this.timeoutController.dispose();
      },
      notifyActivitiesChanged: this.notifyActivitiesChanged,
    });
    this.inviteResolver = new TownActivityInviteResolver({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      getCharacterContext: this.getCharacterContext,
      getRelationshipStatus: this.getRelationshipStatus,
      getNearbyCharacterIds: this.getNearbyCharacterIds,
      actorHasItem: this.actorHasItem,
      sendToCharacter: this.sendToCharacter,
      scheduleActivityTimeout: (activityId, callback, delayMs) => {
        this.scheduleActivityTimeout(activityId, callback, delayMs);
      },
      getActivityPerformanceSelection: activity => this.getActivityPerformanceSelection(activity),
      clearActivityVisuals: activity => this.clearActivityVisuals(activity),
      sendParticipantsToActivityLocation: activity => this.sendParticipantsToActivityLocation(activity),
      playActivityPerformance: activity => this.playActivityPerformance(activity),
      notifyActivitiesChanged: this.notifyActivitiesChanged,
      activityResponseDelayMs: DEFAULT_ACTIVITY_RESPONSE_DELAY_MS,
    });
    this.activityStarter = new TownActivityStarter({
      activityManager: this.activityManager,
      getCharacterPosition: this.getCharacterPosition,
      getSelectedActivityDefinition: snapshot => this.getSelectedActivityDefinition(snapshot),
      getInvitedParticipantIds: (hostCharacterId, activityDefinition, sourceEventId) => (
        this.inviteResolver.getInvitedParticipantIds(hostCharacterId, activityDefinition, sourceEventId)
      ),
      handleGroupInviteResolution: (activity, hostCharacterId, activityDefinition) => {
        this.inviteResolver.handleGroupInviteResolution(activity, hostCharacterId, activityDefinition);
      },
      acceptInvitedParticipants: (activity, hostCharacterId) => {
        this.joinTravelFlow.acceptInvitedParticipants(activity, hostCharacterId);
      },
      sendParticipantsToActivityLocation: activity => {
        this.sendParticipantsToActivityLocation(activity);
      },
      playActivityPerformance: activity => this.playActivityPerformance(activity),
      isActivityEnding: activityId => this.endingActivityIds.has(activityId),
      sendToCharacter: this.sendToCharacter,
      notifyActivitiesChanged: this.notifyActivitiesChanged,
    });
  }

  pauseWorld(observedActivityId: string | null): void {
    this.timeoutController.pauseWorld(observedActivityId);
  }

  resumeWorld(): void {
    this.timeoutController.resumeWorld();
  }

  dispose(): void {
    this.timeoutController.dispose();
    this.dialogueObserver.clear();
  }

  handleCurrentActivity(characterId: string, snapshot: CharacterSnapshot): void {
    this.activityStarter.handleCurrentActivity(characterId, snapshot);
  }

  handlePendingActivityJoin(characterId: string, snapshot: CharacterSnapshot): void {
    this.joinTravelFlow.handlePendingActivityJoin(characterId, snapshot);
  }

  handleActivityTravelProgress(characterId: string, snapshot: CharacterSnapshot): void {
    this.joinTravelFlow.handleActivityTravelProgress(characterId, snapshot);
  }

  handleCharacterPickedUp(characterId: string): boolean {
    return this.participantLifecycle.handleCharacterPickedUp(characterId);
  }

  handleCharactersPickedUp(characterIds: readonly string[]): boolean {
    return this.participantLifecycle.handleCharactersPickedUp(characterIds);
  }

  clearLiveActivitiesForOfflineApply(): void {
    this.participantLifecycle.clearLiveActivitiesForOfflineApply();
  }

  removeStaleActivityParticipations(characterId: string, snapshot: CharacterSnapshot): void {
    this.participantLifecycle.removeStaleActivityParticipations(characterId, snapshot);
  }

  getNearbyJoinableActivities(
    characterId: string,
    timestamp: number,
  ): readonly JoinableActivity[] {
    return this.joinGateway.getNearbyJoinableActivities(characterId, timestamp);
  }

  getNearbyJoinableActivitiesAtPosition(
    characterId: string,
    position: Position,
    timestamp: number,
  ): readonly JoinableActivity[] {
    return this.joinGateway.getNearbyJoinableActivitiesAtPosition(characterId, position, timestamp);
  }

  pruneEndedActivities(timestamp: number): void {
    const endedActivities = this.activityManager.pruneEndedActivities(timestamp);

    if (endedActivities.length === 0) {
      return;
    }

    endedActivities.forEach(activity => {
      this.playActivityEndPerformance(activity, timestamp);
      this.joinTravelFlow.deleteArrivalsForActivity(activity.id);
    });
    this.notifyActivitiesChanged();
  }

  canCharacterJoinActivity(characterId: string, activity: JoinableActivity): boolean {
    return this.joinGateway.canCharacterJoinActivity(characterId, activity);
  }

  replayActivityActiveVisuals(activityId: string): void {
    const activity = this.activityManager.getActivity(activityId);

    if (!activity || activity.pausedAt !== undefined) {
      return;
    }

    this.playActivityPerformance(activity);
  }

  replayActiveVisualsForCharacters(characterIds: readonly string[]): void {
    const characterIdSet = new Set(characterIds);
    const activityIdsToReplay = new Set(
      this.activityManager.getActivities()
        .filter(activity => (
          activity.phase === 'active' &&
          activity.pausedAt === undefined &&
          activity.participantIds.some(participantId => characterIdSet.has(participantId))
        ))
        .map(activity => activity.id),
    );

    activityIdsToReplay.forEach(activityId => {
      this.replayActivityActiveVisuals(activityId);
    });
  }

  joinActivityByGodDrop(characterId: string, activityId: string): boolean {
    return this.joinGateway.joinActivityByGodDrop(characterId, activityId);
  }

  resolveActivityRoll(request: CharacterPerformanceActivityRollRequest): string | null {
    return this.rollResolver.resolveActivityRoll(request);
  }

  handleActivityRouteCompleted(activityId: string): void {
    const activity = this.activityManager.getActivity(activityId);

    if (!activity || activity.phase !== 'active') {
      return;
    }

    if (
      activity.activityKey === JOGGING_ACTIVITY_KEY &&
      activity.participantIds.length >= GROUP_ACTIVITY_MIN_PARTICIPANT_COUNT
    ) {
      const selectedBranchId = this.resolveActivityRoll({
        activityId: activity.id,
        rollId: JOGGING_FINISH_ROLL_ID,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      });

      if (selectedBranchId) {
        return;
      }
    }

    const endedActivity = this.activityManager.endActivity(activity.id);

    if (!endedActivity) {
      return;
    }

    this.playActivityEndPerformance(endedActivity, Date.now());
    this.joinTravelFlow.deleteArrivalsForActivity(activity.id);
    this.notifyActivitiesChanged();
  }

  createActivityDialogueRequest(
    activityId: string,
  ): CharacterPerformanceDialogueRequest | null {
    return this.dialogueObserver.createActivityDialogueRequest(activityId);
  }

  startInteractionCardActivity(
    input: InteractionCardActivityInput,
  ): CharacterPerformanceDialogueRequest | null {
    if (input.initiatorId === input.targetId) {
      return null;
    }

    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[input.eventId];
    const activityVariant = definition?.presentationVariants
      ?.find(variant => variant.activity);
    const activityDefinition = activityVariant?.activity;
    const initiatorPosition = this.getCharacterPosition(input.initiatorId);
    const targetPosition = this.getCharacterPosition(input.targetId);

    if (!definition?.card || !activityDefinition || (!initiatorPosition && !targetPosition)) {
      return null;
    }

    const timestamp = Date.now();
    const activity = this.activityManager.createActivity({
      id: `card-${input.eventId}-${input.initiatorId}-${input.targetId}-${timestamp}`,
      sourceEventId: input.eventId,
      activity: activityDefinition,
      hostCharacterIds: [input.initiatorId],
      participantIds: [input.initiatorId, input.targetId],
      timestamp,
      phase: 'active',
      location: initiatorPosition ?? targetPosition ?? undefined,
    });

    for (const participantId of activity.participantIds) {
      this.sendToCharacter(participantId, {
        type: EventType.JoinActivityAccepted,
        activityId: activity.id,
        sourceEventId: activity.sourceEventId,
      });

      const participantActivityId = this.getCharacterContext(participantId)
        ?.currentActivity
        ?.activityId;

      if (participantActivityId !== activity.id) {
        console.warn('Interaction card participant rejected activity.', {
          activityId: activity.id,
          eventId: input.eventId,
          participantId,
          participantActivityId: participantActivityId ?? null,
        });
        this.cancelInteractionCardActivityState(activity);
        return null;
      }
    }

    const dialogueRequest = this.createActivityDialogueRequest(activity.id);

    if (dialogueRequest) {
      return dialogueRequest;
    }

    this.cancelInteractionCardActivityState(activity);
    return null;
  }

  cancelInteractionCardActivity(activityId: string): void {
    const activity = this.activityManager.getActivity(activityId);

    if (!activity) {
      return;
    }

    this.cancelInteractionCardActivityState(activity);
  }

  private cancelInteractionCardActivityState(activity: JoinableActivity): void {
    this.activityManager.endActivity(activity.id);
    activity.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId: activity.id,
        timestamp: Date.now(),
      });
    });
    this.notifyActivitiesChanged();
  }

  private sendParticipantsToActivityLocation(activity: JoinableActivity): void {
    this.joinTravelFlow.sendParticipantsToActivityLocation(activity);
  }

  private getSelectedActivityDefinition(snapshot: CharacterSnapshot): CharacterEventActivity | undefined {
    return this.activityDefinitionResolver.getSelectedActivityDefinition(snapshot);
  }

  private playActivityPerformance(activity: JoinableActivity): void {
    this.performanceDirector.playActivityPerformance(activity);
  }

  private playActivityRollBranchPerformance(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): number {
    return this.performanceDirector.playActivityRollBranchPerformance(activity, branch);
  }

  private resolveActivityFromRoll(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): void {
    this.performanceDirector.resolveActivityFromRoll(activity, branch);
  }

  private clearActivityVisuals(activity: JoinableActivity): void {
    this.performanceDirector.clearActivityVisuals(activity);
  }

  private playActivityEndPerformance(activity: JoinableActivity, timestamp: number): void {
    this.performanceDirector.playActivityEndPerformance(activity, timestamp);
  }

  private playParticipantLeftPerformance(
    activity: JoinableActivity,
    previousParticipantCount: number,
  ): void {
    this.performanceDirector.playParticipantLeftPerformance(activity, previousParticipantCount);
  }

  private scheduleActivityTimeout(
    activityId: string,
    callback: () => void,
    delayMs: number,
  ): void {
    this.timeoutController.scheduleActivityTimeout(activityId, callback, delayMs);
  }

  private getActivityDefinition(activity: JoinableActivity): CharacterEventActivity | undefined {
    return this.activityDefinitionResolver.getActivityDefinition(activity);
  }

  private getActivityPerformanceSelection(activity: JoinableActivity): CharacterPerformanceSelection {
    return this.activityDefinitionResolver.getActivityPerformanceSelection(activity);
  }

  private getActivityEffects(activity: JoinableActivity): CharacterEventActivityEffects | undefined {
    return this.activityDefinitionResolver.getActivityEffects(activity);
  }

  private getActivityEffectsByRole(
    activity: JoinableActivity,
  ): CharacterEventActivity['effectsByRole'] {
    return this.activityDefinitionResolver.getActivityEffectsByRole(activity);
  }

}
