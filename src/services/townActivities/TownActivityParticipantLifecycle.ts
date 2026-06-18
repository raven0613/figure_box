import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type {
  CharacterPerformanceRunner,
  CharacterPerformanceSelection,
} from '~/services/characterEvents/characterPerformanceRunner';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { TownActivityDialogueObserver } from '~/services/townActivities/TownActivityDialogueObserver';
import type { TownActivityDialogueSubjects } from '~/services/townActivities/TownActivityDialogueSubjects';
import { getGroupMinParticipants } from '~/services/townActivities/townActivityRules';

interface TownActivityParticipantLifecycleOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  dialogueSubjects: TownActivityDialogueSubjects;
  dialogueObserver: TownActivityDialogueObserver;
  sendToCharacter: SendCharacterEvent;
  getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  clearActivityVisuals: (activity: JoinableActivity) => void;
  playParticipantLeftPerformance: (
    activity: JoinableActivity,
    previousParticipantCount: number,
  ) => void;
  deleteArrivedCharacterFromActivity: (activityId: string, characterId: string) => void;
  deleteArrivalsForActivity: (activityId: string) => void;
  clearArrivals: () => void;
  deleteEndingActivity: (activityId: string) => void;
  clearEndingActivities: () => void;
  deleteRollSelectionsForActivity: (activityId: string) => void;
  clearRollSelections: () => void;
  disposeActivityTimeouts: () => void;
  notifyActivitiesChanged: () => void;
}

export class TownActivityParticipantLifecycle {
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly dialogueSubjects: TownActivityDialogueSubjects;
  private readonly dialogueObserver: TownActivityDialogueObserver;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly getActivityDefinition: (
    activity: JoinableActivity,
  ) => CharacterEventActivity | undefined;
  private readonly getActivityPerformanceSelection: (
    activity: JoinableActivity,
  ) => CharacterPerformanceSelection;
  private readonly clearActivityVisuals: (activity: JoinableActivity) => void;
  private readonly playParticipantLeftPerformance: (
    activity: JoinableActivity,
    previousParticipantCount: number,
  ) => void;
  private readonly deleteArrivedCharacterFromActivity: (
    activityId: string,
    characterId: string,
  ) => void;
  private readonly deleteArrivalsForActivity: (activityId: string) => void;
  private readonly clearArrivals: () => void;
  private readonly deleteEndingActivity: (activityId: string) => void;
  private readonly clearEndingActivities: () => void;
  private readonly deleteRollSelectionsForActivity: (activityId: string) => void;
  private readonly clearRollSelections: () => void;
  private readonly disposeActivityTimeouts: () => void;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityParticipantLifecycleOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.dialogueSubjects = options.dialogueSubjects;
    this.dialogueObserver = options.dialogueObserver;
    this.sendToCharacter = options.sendToCharacter;
    this.getActivityDefinition = options.getActivityDefinition;
    this.getActivityPerformanceSelection = options.getActivityPerformanceSelection;
    this.clearActivityVisuals = options.clearActivityVisuals;
    this.playParticipantLeftPerformance = options.playParticipantLeftPerformance;
    this.deleteArrivedCharacterFromActivity = options.deleteArrivedCharacterFromActivity;
    this.deleteArrivalsForActivity = options.deleteArrivalsForActivity;
    this.clearArrivals = options.clearArrivals;
    this.deleteEndingActivity = options.deleteEndingActivity;
    this.clearEndingActivities = options.clearEndingActivities;
    this.deleteRollSelectionsForActivity = options.deleteRollSelectionsForActivity;
    this.clearRollSelections = options.clearRollSelections;
    this.disposeActivityTimeouts = options.disposeActivityTimeouts;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  handleCharacterPickedUp(characterId: string): boolean {
    return this.handleCharactersPickedUp([characterId]);
  }

  handleCharactersPickedUp(characterIds: readonly string[]): boolean {
    const pickedUpCharacterIds = new Set(characterIds);
    const affectedActivities = this.activityManager.getActivities()
      .filter(activity => (
        activity.participantIds.some(participantId => (
          pickedUpCharacterIds.has(participantId)
        ))
      ));

    affectedActivities.forEach(activity => {
      this.removePickedUpCharactersFromActivity(activity, pickedUpCharacterIds);
    });

    return affectedActivities.length > 0;
  }

  private removePickedUpCharactersFromActivity(
    activity: JoinableActivity,
    pickedUpCharacterIds: ReadonlySet<string>,
  ): void {
    const departingCharacterIds = activity.participantIds
      .filter(participantId => pickedUpCharacterIds.has(participantId));

    const previousParticipantCount = activity.participantIds.length;
    let nextActivity: JoinableActivity | null = activity;

    departingCharacterIds.forEach(characterId => {
      nextActivity = this.activityManager.leaveActivity(activity.id, characterId);
      this.deleteArrivedCharacterFromActivity(activity.id, characterId);
    });
    this.dialogueSubjects.clearActivity(activity.id);
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.performanceRunner.clearActivityActiveVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );

    if (activity.phase === 'inviting') {
      const endedActivity = this.activityManager.endActivity(activity.id)
        ?? nextActivity
        ?? activity;

      this.clearActivityVisuals(endedActivity);
      this.deleteRollSelectionsForActivity(activity.id);
      this.sendActivityEndedToParticipants(
        activity.id,
        endedActivity.participantIds,
      );
      this.notifyActivitiesChanged();
      return;
    }

    if (!nextActivity) {
      this.clearActivityVisuals(activity);
      this.deleteRollSelectionsForActivity(activity.id);
      this.notifyActivitiesChanged();
      return;
    }

    if (this.shouldEndActivityAfterParticipantLeft(nextActivity)) {
      this.activityManager.endActivity(nextActivity.id);
      this.playParticipantLeftPerformance(nextActivity, previousParticipantCount);
      this.deleteRollSelectionsForActivity(nextActivity.id);
      this.sendActivityEndedToParticipants(nextActivity.id, nextActivity.participantIds);
      this.notifyActivitiesChanged();
      return;
    }

    this.sendActivityAcceptedToParticipants(nextActivity);
    this.playParticipantLeftPerformance(nextActivity, previousParticipantCount);
    this.notifyActivitiesChanged();
  }

  clearLiveActivitiesForOfflineApply(): void {
    const activities = this.activityManager.getActivities();

    if (activities.length === 0) {
      this.clearRuntimeState();
      return;
    }

    activities.forEach(activity => {
      this.clearActivityVisuals(activity);
      this.deleteArrivalsForActivity(activity.id);
      this.deleteEndingActivity(activity.id);
      this.deleteRollSelectionsForActivity(activity.id);
      this.dialogueSubjects.clearActivity(activity.id);
      this.performanceRunner.cancelActivityPerformance(activity.id);
    });
    this.activityManager.clear();
    this.clearRuntimeState();
    this.notifyActivitiesChanged();
  }

  removeStaleActivityParticipations(
    characterId: string,
    snapshot: CharacterSnapshot,
  ): void {
    const staleActivities = this.activityManager.getActivities()
      .filter(activity => (
        activity.phase !== 'inviting' &&
        activity.participantIds.includes(characterId) &&
        snapshot.context.currentActivity?.activityId !== activity.id &&
        snapshot.context.pendingActivityJoin?.activityId !== activity.id
      ));

    if (staleActivities.length === 0) {
      return;
    }

    staleActivities.forEach(activity => {
      const nextActivity = this.activityManager.leaveActivity(activity.id, characterId);

      this.performanceRunner.cancelActivityPerformance(activity.id);
      this.performanceRunner.clearActivityActiveVisuals(
        this.getActivityPerformanceSelection(activity),
        activity.id,
        activity.participantIds,
        activity.hostCharacterIds,
      );
      this.deleteArrivedCharacterFromActivity(activity.id, characterId);
      this.dialogueSubjects.clearActivity(activity.id);

      if (!nextActivity) {
        this.deleteRollSelectionsForActivity(activity.id);
        return;
      }

      if (this.shouldEndActivityAfterParticipantLeft(nextActivity)) {
        this.activityManager.endActivity(nextActivity.id);
        this.clearActivityVisuals(nextActivity);
        this.deleteArrivalsForActivity(nextActivity.id);
        this.deleteRollSelectionsForActivity(nextActivity.id);
        this.sendActivityEndedToParticipants(nextActivity.id, nextActivity.participantIds);
      }
    });
    this.notifyActivitiesChanged();
  }

  private shouldEndActivityAfterParticipantLeft(activity: JoinableActivity): boolean {
    const activityDefinition = this.getActivityDefinition(activity);

    return activityDefinition !== undefined
      && activity.participantIds.length < getGroupMinParticipants(activityDefinition);
  }

  private sendActivityAcceptedToParticipants(activity: JoinableActivity): void {
    activity.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.JoinActivityAccepted,
        activityId: activity.id,
        sourceEventId: activity.sourceEventId,
      });
    });
  }

  private sendActivityEndedToParticipants(
    activityId: string,
    participantIds: readonly string[],
  ): void {
    participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId,
        timestamp: Date.now(),
      });
    });
  }

  private clearRuntimeState(): void {
    this.clearArrivals();
    this.clearEndingActivities();
    this.clearRollSelections();
    this.dialogueSubjects.clear();
    this.dialogueObserver.clear();
    this.disposeActivityTimeouts();
  }
}
