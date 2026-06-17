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
  notifyActivitiesChanged: () => void;
  activityEndDurationMs: number;
}

const PARTICIPANT_LEFT_RECOVERY_DELAY_MS = 5000;

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
  }

  playActivityRollBranchPerformance(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): number {
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
    this.activityManager.endActivity(activity.id);

    const durationMs = this.playActivityRollBranchPerformance(activity, branch);
    const cleanupDelayMs = durationMs || this.activityEndDurationMs;

    this.notifyActivitiesChanged();
    this.scheduleActivityTimeout(activity.id, () => {
      this.performanceRunner.clearActivitySettlementVisuals(
        this.getActivityPerformanceSelection(activity),
        activity.id,
        activity.participantIds,
        activity.hostCharacterIds,
      );
      this.resolveActivityOutcome({
        activityId: activity.id,
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
    this.performanceRunner.clearActivityVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
  }

  playActivityEndPerformance(activity: JoinableActivity, timestamp: number): void {
    this.markActivityEnding(activity.id);
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
}
