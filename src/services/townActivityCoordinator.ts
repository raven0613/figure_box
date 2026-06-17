import type { Position, SocialStatus } from '~/constants/character';
import {
  type CharacterEventActivity,
  type CharacterEventActivityRollBranch,
  type CharacterEventActivityEffects,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import { resolveActivityDestination } from '~/services/characterEvents/targets';
import { EventType } from '~/stateMachines/gameFlow/events';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
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
import { TownActivityJoinTravelFlow } from '~/services/townActivities/TownActivityJoinTravelFlow';
import { TownActivityParticipantLifecycle } from '~/services/townActivities/TownActivityParticipantLifecycle';
import { TownActivityPerformanceDirector } from '~/services/townActivities/TownActivityPerformanceDirector';
import { TownActivityRollResolver } from '~/services/townActivities/TownActivityRollResolver';
import { TownActivityTimeoutController } from '~/services/townActivities/TownActivityTimeoutController';
import {
  getGroupMaxParticipants,
  getPostInviteActivityPhase,
  shouldResolveGroupInvites,
} from '~/services/townActivities/townActivityRules';

interface TownActivityCoordinatorOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterName: (characterId: string) => string;
  getCharacterPersonality: (characterId: string) => CharacterPersonality;
  getCharacterPosition: (characterId: string) => Position | null;
  getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  getNearbyCharacterIds: (characterId: string, range: number) => string[];
  getTravelTarget: (destination: Position) => Position;
  actorHasItem: (characterId: string, itemId: string) => boolean;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  resolveActivityOutcome: (input: ResolveActivityOutcomeInput) => ResolvedActivityOutcome;
  notifyActivitiesChanged: () => void;
}

const DEFAULT_ACTIVITY_RESPONSE_DELAY_MS = 1200;
const DEFAULT_ACTIVITY_END_DURATION_MS = 1000;

// joinable activity 加入、查找、過期清理
export class TownActivityCoordinator {
  private readonly activityDefinitionResolver = new TownActivityDefinitionResolver();
  private readonly dialogueSubjects: TownActivityDialogueSubjects;
  private readonly dialogueObserver: TownActivityDialogueObserver;
  private readonly timeoutController = new TownActivityTimeoutController();
  private readonly inviteResolver: TownActivityInviteResolver;
  private readonly joinTravelFlow: TownActivityJoinTravelFlow;
  private readonly participantLifecycle: TownActivityParticipantLifecycle;
  private readonly performanceDirector: TownActivityPerformanceDirector;
  private readonly rollResolver: TownActivityRollResolver;
  private readonly endingActivityIds = new Set<string>();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterName: (characterId: string) => string;
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
      getActivityDefinition: activity => this.getActivityDefinition(activity),
      getActivityPerformanceSelection: activity => this.getActivityPerformanceSelection(activity),
      isActivityEnding: activityId => this.endingActivityIds.has(activityId),
      resolveActivityRoll: request => this.resolveActivityRoll(request),
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
      notifyActivitiesChanged: this.notifyActivitiesChanged,
      activityEndDurationMs: DEFAULT_ACTIVITY_END_DURATION_MS,
    });
    this.joinTravelFlow = new TownActivityJoinTravelFlow({
      activityManager: this.activityManager,
      canCharacterJoinActivity: (characterId, activity) => this.canCharacterJoinActivity(characterId, activity),
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
    const currentActivity = snapshot.context.currentActivity;

    if (
      !currentActivity ||
      this.activityManager.getActivity(currentActivity.activityId) ||
      this.endingActivityIds.has(currentActivity.activityId)
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
    const participantIds = this.getInvitedParticipantIds(characterId, activityDefinition);

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

  handlePendingActivityJoin(characterId: string, snapshot: CharacterSnapshot): void {
    this.joinTravelFlow.handlePendingActivityJoin(characterId, snapshot);
  }

  handleActivityTravelProgress(characterId: string, snapshot: CharacterSnapshot): void {
    this.joinTravelFlow.handleActivityTravelProgress(characterId, snapshot);
  }

  handleCharacterPickedUp(characterId: string): boolean {
    return this.participantLifecycle.handleCharacterPickedUp(characterId);
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
      this.playActivityEndPerformance(activity, timestamp);
      this.joinTravelFlow.deleteArrivalsForActivity(activity.id);
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
        return this.actorHasItem(characterId, joinRequirements.itemId);
    }
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

  resolveActivityRoll(request: CharacterPerformanceActivityRollRequest): string | null {
    return this.rollResolver.resolveActivityRoll(request);
  }

  createActivityDialogueRequest(
    activityId: string,
  ): CharacterPerformanceDialogueRequest | null {
    return this.dialogueObserver.createActivityDialogueRequest(activityId);
  }

  private getInvitedParticipantIds(hostCharacterId: string, activityDefinition: CharacterEventActivity): string[] {
    return this.inviteResolver.getInvitedParticipantIds(hostCharacterId, activityDefinition);
  }

  private handleGroupInviteResolution(
    activity: JoinableActivity,
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
  ): void {
    this.inviteResolver.handleGroupInviteResolution(activity, hostCharacterId, activityDefinition);
  }

  private acceptInvitedParticipants(activity: JoinableActivity, hostCharacterId: string): void {
    this.joinTravelFlow.acceptInvitedParticipants(activity, hostCharacterId);
  }

  private sendParticipantsToActivityLocation(activity: JoinableActivity): void {
    this.joinTravelFlow.sendParticipantsToActivityLocation(activity);
  }

  private sendParticipantToActivityLocation(
    activity: JoinableActivity,
    characterId: string,
  ): void {
    this.joinTravelFlow.sendParticipantToActivityLocation(activity, characterId);
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
