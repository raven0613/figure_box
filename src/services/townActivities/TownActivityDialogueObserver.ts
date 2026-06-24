import type {
  CharacterEventActivity,
  CharacterEventActivityRollBranch,
} from '~/constants/charactarEventsDefinitions';
import type {
  CharacterPerformanceActivityRollRequest,
  CharacterPerformanceDialogueRequest,
  CharacterPerformanceRunner,
  CharacterPerformanceSelection,
} from '~/services/characterEvents/characterPerformanceRunner';
import type { JoinableActivity, JoinableActivityManager } from '~/services/characterEvents/joinableActivities';
import { resolveDialogueContent } from '~/services/dialogueContentResolver';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import type { TownActivityDialogueSubjects } from './TownActivityDialogueSubjects';
import type { CharacterWayOfSaying } from '~/typing/characterProfile';

interface ObservedActivitySession {
  activity: JoinableActivity;
  pendingResolutionBranch?: CharacterEventActivityRollBranch;
}

interface TownActivityDialogueObserverOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  dialogueSubjects: TownActivityDialogueSubjects;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterName: (characterId: string) => string;
  getCharacterWayOfSaying: (characterId: string) => CharacterWayOfSaying | undefined;
  getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  isActivityEnding: (activityId: string) => boolean;
  resolveActivityRoll: (request: CharacterPerformanceActivityRollRequest) => string | null;
  recordSpokenLine: (input: {
    speakerId: string;
    targetId: string;
    memoryKey: string;
    text: string;
  }) => void;
  resolveActivityFromRoll: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => void;
  playActivityEndPerformance: (activity: JoinableActivity, timestamp: number) => void;
  notifyActivitiesChanged: () => void;
}

export class TownActivityDialogueObserver {
  private readonly observedActivitySessionsByActivityId = new Map<string, ObservedActivitySession>();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly dialogueSubjects: TownActivityDialogueSubjects;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterName: (characterId: string) => string;
  private readonly getCharacterWayOfSaying: (characterId: string) => CharacterWayOfSaying | undefined;
  private readonly getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  private readonly getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  private readonly isActivityEnding: (activityId: string) => boolean;
  private readonly resolveActivityRoll: (request: CharacterPerformanceActivityRollRequest) => string | null;
  private readonly recordSpokenLine: TownActivityDialogueObserverOptions['recordSpokenLine'];
  private readonly resolveActivityFromRoll: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => void;
  private readonly playActivityEndPerformance: (activity: JoinableActivity, timestamp: number) => void;
  private readonly notifyActivitiesChanged: () => void;

  constructor(options: TownActivityDialogueObserverOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.dialogueSubjects = options.dialogueSubjects;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterName = options.getCharacterName;
    this.getCharacterWayOfSaying = options.getCharacterWayOfSaying;
    this.getActivityDefinition = options.getActivityDefinition;
    this.getActivityPerformanceSelection = options.getActivityPerformanceSelection;
    this.isActivityEnding = options.isActivityEnding;
    this.resolveActivityRoll = options.resolveActivityRoll;
    this.recordSpokenLine = options.recordSpokenLine;
    this.resolveActivityFromRoll = options.resolveActivityFromRoll;
    this.playActivityEndPerformance = options.playActivityEndPerformance;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
  }

  clear(): void {
    this.observedActivitySessionsByActivityId.clear();
  }

  deferActivityResolution(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): boolean {
    const observedActivitySession = this.observedActivitySessionsByActivityId.get(activity.id);

    if (!observedActivitySession) {
      return false;
    }

    this.observedActivitySessionsByActivityId.set(activity.id, {
      ...observedActivitySession,
      activity,
      pendingResolutionBranch: branch,
    });
    return true;
  }

  createActivityDialogueRequest(activityId: string): CharacterPerformanceDialogueRequest | null {
    const activity = this.activityManager.getActivity(activityId);

    if (
      !activity
      || activity.phase !== 'active'
      || activity.pausedAt !== undefined
      || this.isActivityEnding(activity.id)
    ) {
      return null;
    }

    const activityDefinition = this.getActivityDefinition(activity);
    const dialogueScriptId = activityDefinition?.dialogueScriptId;
    const initiatorId = activity.hostCharacterIds[0] ?? activity.participantIds[0];
    const targetId = activity.participantIds.find(characterId => characterId !== initiatorId);

    if (!activityDefinition || !dialogueScriptId || !initiatorId || !targetId) {
      return null;
    }

    const dialogueSubjects = this.dialogueSubjects.getSubjects(activity.id)
      ?? this.dialogueSubjects.prepareSubjects(activity, activityDefinition);

    if (
      activityDefinition.dialogueSubjectSelection
      && Object.keys(dialogueSubjects).length < activityDefinition.dialogueSubjectSelection.count
    ) {
      return null;
    }

    const pausedActivity = this.activityManager.pauseActivity(activity.id, Date.now());

    if (!pausedActivity || pausedActivity.pausedAt === undefined) {
      return null;
    }

    this.observedActivitySessionsByActivityId.set(activity.id, {
      activity: pausedActivity,
    });
    this.performanceRunner.clearActivityPresentationForObservation(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
    this.notifyActivitiesChanged();

    return {
      activityId: activity.id,
      scriptId: dialogueScriptId,
      participantIds: [...activity.participantIds],
      initiatorId,
      targetId,
      templateValues: Object.fromEntries(
        Object.entries(dialogueSubjects).map(([subjectKey, subjectId]) => [
          `${subjectKey}Name`,
          this.getCharacterName(subjectId),
        ]),
      ),
      resolveActivityRoll: (rollId, rollContext) => this.resolveActivityRoll({
        activityId: activity.id,
        rollId,
        rollContext,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      }),
      resolveDialogueContent: (contentPoolId, subjectKey) => {
        const subjectId = dialogueSubjects[subjectKey];
        const subjectContext = subjectId
          ? this.getCharacterContext(subjectId)
          : null;

        if (!subjectId || !subjectContext) {
          return null;
        }

        const content = resolveDialogueContent({
          contentPoolId,
          subjectId,
          subjectName: this.getCharacterName(subjectId),
          subjectWayOfSaying: this.getCharacterWayOfSaying(subjectId),
          speakerWayOfSaying: this.getCharacterWayOfSaying(initiatorId),
          relationships: subjectContext.relationships,
          getCharacterName: this.getCharacterName,
          getCharacterWayOfSaying: this.getCharacterWayOfSaying,
        });

        if (!content) {
          return null;
        }

        this.dialogueSubjects.selectSubject(activity.id, subjectId);
        return [{
          type: 'SAY',
          speakerId: initiatorId,
          text: content.text,
          expressionPresetId: content.expressionPresetId,
        }];
      },
      recordSpokenLine: input => {
        this.recordSpokenLine(input);
      },
      onClose: () => {
        this.settleObservedActivityAfterDialogue(activity.id);
      },
      onCancel: () => {
        this.resumeActivityAfterObservationCancel(activity.id);
      },
    };
  }

  private resumeActivityAfterObservationCancel(activityId: string): void {
    this.observedActivitySessionsByActivityId.delete(activityId);
    const activity = this.activityManager.getActivity(activityId);

    if (
      !activity
      || activity.pausedAt === undefined
      || this.isActivityEnding(activity.id)
    ) {
      return;
    }

    if (!this.activityManager.resumeActivity(activity.id, Date.now())) {
      return;
    }

    this.notifyActivitiesChanged();
  }

  private settleObservedActivityAfterDialogue(activityId: string): void {
    const observedActivitySession = this.observedActivitySessionsByActivityId.get(activityId);

    if (!observedActivitySession) {
      return;
    }

    this.observedActivitySessionsByActivityId.delete(activityId);
    const activity = this.activityManager.getActivity(activityId)
      ?? observedActivitySession.activity;

    if (observedActivitySession.pendingResolutionBranch) {
      this.resolveActivityFromRoll(
        activity,
        observedActivitySession.pendingResolutionBranch,
      );
      return;
    }

    const endedActivity = this.activityManager.endActivity(activityId) ?? activity;

    this.playActivityEndPerformance(endedActivity, Date.now());
    this.notifyActivitiesChanged();
  }
}
