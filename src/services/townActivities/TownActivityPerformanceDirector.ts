import type {
  CharacterEventActivity,
  CharacterEventActivityEffects,
  CharacterEventActivityRollBranch,
} from '~/constants/charactarEventsDefinitions';
import type {
  CharacterPerformanceRunner,
  CharacterPerformanceSelection,
} from '~/services/characterEvents/characterPerformanceRunner';
import type {
  ResolveActivityOutcomeInput,
  ResolvedActivityOutcome,
} from '~/services/characterEvents/activityOutcomeResolver';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type { TownActivityDialogueSubjects } from '~/services/townActivities/TownActivityDialogueSubjects';
import type { CancelActivityRouteOptions } from '~/services/townMovementCoordinator';

interface TownActivityPerformanceDirectorOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  dialogueSubjects: TownActivityDialogueSubjects;
  getCharacterName: (characterId: string) => string;
  getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  getActivityEffects: (activity: JoinableActivity) => CharacterEventActivityEffects | undefined;
  getActivityEffectsByRole: (
    activity: JoinableActivity,
  ) => CharacterEventActivity['effectsByRole'];
  resolveActivityOutcome: (input: ResolveActivityOutcomeInput) => ResolvedActivityOutcome;
  scheduleActivityTimeout: (activityId: string, callback: () => void, delayMs: number) => void;
  markActivityEnding: (activityId: string) => void;
  unmarkActivityEnding: (activityId: string) => void;
  clearRollSelectionsForActivity: (activityId: string) => void;
  startJoggingRoute: (input: {
    activityId: string;
    participantIds: readonly string[];
    location: NonNullable<JoinableActivity['location']>;
  }) => void;
  startStrollTogetherRoute: (input: {
    activityId: string;
    participantIds: readonly string[];
    location: NonNullable<JoinableActivity['location']>;
  }) => void;
  startJoggingRace: (activityId: string) => void;
  finishJoggingRoute: (activityId: string) => void;
  cancelActivityRoute: (activityId: string, options?: CancelActivityRouteOptions) => void;
  notifyActivitiesChanged: () => void;
  activityEndDurationMs: number;
}

const PARTICIPANT_LEFT_RECOVERY_DELAY_MS = 5000;
const JOGGING_ACTIVITY_KEY = 'life.jogging';
const STROLL_TOGETHER_ACTIVITY_KEY = 'life.stroll-together';
const JOGGING_RACE_STARTED_BRANCH_ID = 'raceStarted';
const MIN_JOGGING_ROUTE_PARTICIPANT_COUNT = 1;
const MAX_JOGGING_ROUTE_PARTICIPANT_COUNT = 2;
const STROLL_TOGETHER_ROUTE_PARTICIPANT_COUNT = 2;

export class TownActivityPerformanceDirector {
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly dialogueSubjects: TownActivityDialogueSubjects;
  private readonly getCharacterName: (characterId: string) => string;
  private readonly getActivityDefinition: (
    activity: JoinableActivity,
  ) => CharacterEventActivity | undefined;
  private readonly getActivityPerformanceSelection: (
    activity: JoinableActivity,
  ) => CharacterPerformanceSelection;
  private readonly getActivityEffects: (
    activity: JoinableActivity,
  ) => CharacterEventActivityEffects | undefined;
  private readonly getActivityEffectsByRole: (
    activity: JoinableActivity,
  ) => CharacterEventActivity['effectsByRole'];
  private readonly resolveActivityOutcome: (
    input: ResolveActivityOutcomeInput,
  ) => ResolvedActivityOutcome;
  private readonly scheduleActivityTimeout: (
    activityId: string,
    callback: () => void,
    delayMs: number,
  ) => void;
  private readonly markActivityEnding: (activityId: string) => void;
  private readonly unmarkActivityEnding: (activityId: string) => void;
  private readonly clearRollSelectionsForActivity: (activityId: string) => void;
  private readonly startJoggingRoute: TownActivityPerformanceDirectorOptions['startJoggingRoute'];
  private readonly startStrollTogetherRoute: TownActivityPerformanceDirectorOptions['startStrollTogetherRoute'];
  private readonly startJoggingRace: TownActivityPerformanceDirectorOptions['startJoggingRace'];
  private readonly finishJoggingRoute: TownActivityPerformanceDirectorOptions['finishJoggingRoute'];
  private readonly cancelActivityRoute: TownActivityPerformanceDirectorOptions['cancelActivityRoute'];
  private readonly notifyActivitiesChanged: () => void;
  private readonly activityEndDurationMs: number;

  constructor(options: TownActivityPerformanceDirectorOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.dialogueSubjects = options.dialogueSubjects;
    this.getCharacterName = options.getCharacterName;
    this.getActivityDefinition = options.getActivityDefinition;
    this.getActivityPerformanceSelection = options.getActivityPerformanceSelection;
    this.getActivityEffects = options.getActivityEffects;
    this.getActivityEffectsByRole = options.getActivityEffectsByRole;
    this.resolveActivityOutcome = options.resolveActivityOutcome;
    this.scheduleActivityTimeout = options.scheduleActivityTimeout;
    this.markActivityEnding = options.markActivityEnding;
    this.unmarkActivityEnding = options.unmarkActivityEnding;
    this.clearRollSelectionsForActivity = options.clearRollSelectionsForActivity;
    this.startJoggingRoute = options.startJoggingRoute;
    this.startStrollTogetherRoute = options.startStrollTogetherRoute;
    this.startJoggingRace = options.startJoggingRace;
    this.finishJoggingRoute = options.finishJoggingRoute;
    this.cancelActivityRoute = options.cancelActivityRoute;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
    this.activityEndDurationMs = options.activityEndDurationMs;
  }

  playActivityPerformance(activity: JoinableActivity): void {
    const activityDefinition = this.getActivityDefinition(activity);

    if (activityDefinition) {
      this.dialogueSubjects.prepareSubjects(activity, activityDefinition);
    }

    this.performanceRunner.playActivityPerformanceSteps({
      selection: this.getActivityPerformanceSelection(activity),
      phase: 'active',
      activityId: activity.id,
      participantIds: activity.participantIds,
      hostCharacterIds: activity.hostCharacterIds,
    });
    this.startRoutePerformance(activity);
  }

  playActivityRollBranchPerformance(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): number {
    this.startRouteRollBranchPerformance(activity, branch);

    if (!branch.performanceId) {
      return 0;
    }

    const dialogueSubjectId = this.dialogueSubjects.getSelectedSubjectId(activity.id);

    return this.performanceRunner.playActivityPerformanceStepsById(
      branch.performanceId,
      {
        phase: 'active',
        activityId: activity.id,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
        templateValues: dialogueSubjectId
          ? {
            dialogueSubjectName: this.getCharacterName(dialogueSubjectId),
          }
          : undefined,
      },
    );
  }

  resolveActivityFromRoll(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): void {
    const dialogueSubjectId = this.dialogueSubjects.getSelectedSubjectId(activity.id);

    this.markActivityEnding(activity.id);
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.performanceRunner.clearActivityActiveVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
    if (
      activity.activityKey === JOGGING_ACTIVITY_KEY &&
      activity.participantIds.length === MAX_JOGGING_ROUTE_PARTICIPANT_COUNT
    ) {
      this.finishJoggingRoute(activity.id);
    } else {
      this.cancelActivityRoute(activity.id, { forgetCompleted: true });
    }
    this.activityManager.endActivity(activity.id);

    const durationMs = this.playActivityRollBranchPerformance(activity, branch);
    const cleanupDelayMs = durationMs || this.activityEndDurationMs;

    this.notifyActivitiesChanged();
    this.scheduleActivityTimeout(activity.id, () => {
      this.cancelActivityRoute(activity.id);
      this.performanceRunner.clearActivitySettlementVisuals(
        this.getActivityPerformanceSelection(activity),
        activity.id,
        activity.participantIds,
        activity.hostCharacterIds,
      );
      this.resolveActivityOutcome({
        activityId: activity.id,
        sourceEventId: activity.sourceEventId,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
        outcome: {
          id: branch.id,
          effects: branch.effects,
          effectsByRole: branch.effectsByRole,
          memoryEffects: branch.memoryEffects,
        },
        dialogueSubjectId,
        resolvedBy: 'characterPerformance',
      });
      this.clearRollSelectionsForActivity(activity.id);
      this.dialogueSubjects.clearActivity(activity.id);
      this.unmarkActivityEnding(activity.id);
      this.notifyActivitiesChanged();
    }, cleanupDelayMs);
  }

  clearActivityVisuals(activity: JoinableActivity): void {
    this.cancelActivityRoute(activity.id);
    this.performanceRunner.clearActivityVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
  }

  playActivityEndPerformance(activity: JoinableActivity, timestamp: number): void {
    this.markActivityEnding(activity.id);
    this.cancelActivityRoute(activity.id, { forgetCompleted: true });
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.performanceRunner.clearActivityActiveVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );

    const durationMs = this.performanceRunner.playActivityPerformanceSteps({
      selection: this.getActivityPerformanceSelection(activity),
      phase: 'end',
      activityId: activity.id,
      participantIds: activity.participantIds,
      hostCharacterIds: activity.hostCharacterIds,
    });
    const cleanupDelayMs = durationMs || this.activityEndDurationMs;
    const activityEffects = this.getActivityEffects(activity);
    const activityEffectsByRole = this.getActivityEffectsByRole(activity);

    this.scheduleActivityTimeout(activity.id, () => {
      this.clearActivityVisuals(activity);
      this.resolveActivityOutcome({
        activityId: activity.id,
        sourceEventId: activity.sourceEventId,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
        outcome: {
          id: 'completed',
          effects: activityEffects,
          effectsByRole: activityEffectsByRole,
        },
        resolvedBy: 'characterPerformance',
        timestamp,
      });
      this.unmarkActivityEnding(activity.id);
      this.clearRollSelectionsForActivity(activity.id);
      this.dialogueSubjects.clearActivity(activity.id);
      this.notifyActivitiesChanged();
    }, cleanupDelayMs);
  }

  playParticipantLeftPerformance(
    activity: JoinableActivity,
    previousParticipantCount: number,
  ): void {
    if (previousParticipantCount > activity.participantIds.length) {
      this.cancelActivityRoute(activity.id);
    }

    const phase = previousParticipantCount > 1
      ? 'participantLeftGroup'
      : 'participantLeftSolo';

    this.performanceRunner.playActivityPerformanceSteps({
      selection: this.getActivityPerformanceSelection(activity),
      phase,
      activityId: activity.id,
      participantIds: activity.participantIds,
      hostCharacterIds: activity.hostCharacterIds,
    });

    if (phase === 'participantLeftSolo') {
      return;
    }

    this.scheduleActivityTimeout(activity.id, () => {
      const currentActivity = this.activityManager.getActivity(activity.id);

      if (
        !currentActivity
        || currentActivity.phase !== 'active'
        || currentActivity.pausedAt !== undefined
      ) {
        return;
      }

      if (currentActivity.participantIds.length === 1) {
        this.performanceRunner.playActivityPerformanceSteps({
          selection: this.getActivityPerformanceSelection(currentActivity),
          phase: 'participantLeftSolo',
          activityId: currentActivity.id,
          participantIds: currentActivity.participantIds,
          hostCharacterIds: currentActivity.hostCharacterIds,
        });
        return;
      }

      this.playActivityPerformance(currentActivity);
    }, PARTICIPANT_LEFT_RECOVERY_DELAY_MS);
  }

  private startRoutePerformance(activity: JoinableActivity): void {
    if (!activity.location) {
      return;
    }

    if (
      activity.activityKey === JOGGING_ACTIVITY_KEY &&
      activity.participantIds.length >= MIN_JOGGING_ROUTE_PARTICIPANT_COUNT &&
      activity.participantIds.length <= MAX_JOGGING_ROUTE_PARTICIPANT_COUNT
    ) {
      this.startJoggingRoute({
        activityId: activity.id,
        participantIds: activity.participantIds,
        location: activity.location,
      });
      return;
    }

    if (
      activity.activityKey === STROLL_TOGETHER_ACTIVITY_KEY &&
      activity.participantIds.length === STROLL_TOGETHER_ROUTE_PARTICIPANT_COUNT
    ) {
      this.startStrollTogetherRoute({
        activityId: activity.id,
        participantIds: activity.participantIds,
        location: activity.location,
      });
    }
  }

  private startRouteRollBranchPerformance(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): void {
    if (
      activity.activityKey === JOGGING_ACTIVITY_KEY &&
      branch.id === JOGGING_RACE_STARTED_BRANCH_ID
    ) {
      this.startJoggingRace(activity.id);
    }
  }
}
