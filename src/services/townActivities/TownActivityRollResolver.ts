import { Feeling } from '~/constants/character';
import type {
  CharacterEventActivity,
  CharacterEventActivityRollBranch,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import {
  selectActivityRollBranch,
  type ActivityRollRuleContext,
  type ActivityRollSelection,
} from '~/services/characterEvents/activityRolls';
import type {
  CharacterPerformanceActivityRollRequest,
} from '~/services/characterEvents/characterPerformanceRunner';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import type { TownActivityDialogueObserver } from '~/services/townActivities/TownActivityDialogueObserver';

interface TownActivityRollResolverOptions {
  activityManager: JoinableActivityManager;
  dialogueObserver: TownActivityDialogueObserver;
  getActivityDefinition: (activity: JoinableActivity) => CharacterEventActivity | undefined;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getCharacterPersonality: (characterId: string) => CharacterPersonality;
  isActivityEnding: (activityId: string) => boolean;
  resolveActivityFromRoll: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => void;
  playActivityRollBranchPerformance: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => number;
}

export class TownActivityRollResolver {
  private readonly rollSelectionsByActivityId = new Map<
    string,
    Readonly<Record<string, ActivityRollSelection>>
  >();
  private readonly activityManager: JoinableActivityManager;
  private readonly dialogueObserver: TownActivityDialogueObserver;
  private readonly getActivityDefinition: (
    activity: JoinableActivity,
  ) => CharacterEventActivity | undefined;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterPersonality: (characterId: string) => CharacterPersonality;
  private readonly isActivityEnding: (activityId: string) => boolean;
  private readonly resolveActivityFromRoll: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => void;
  private readonly playActivityRollBranchPerformance: (
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ) => number;

  constructor(options: TownActivityRollResolverOptions) {
    this.activityManager = options.activityManager;
    this.dialogueObserver = options.dialogueObserver;
    this.getActivityDefinition = options.getActivityDefinition;
    this.getCharacterContext = options.getCharacterContext;
    this.getCharacterPersonality = options.getCharacterPersonality;
    this.isActivityEnding = options.isActivityEnding;
    this.resolveActivityFromRoll = options.resolveActivityFromRoll;
    this.playActivityRollBranchPerformance = options.playActivityRollBranchPerformance;
  }

  resolveActivityRoll(request: CharacterPerformanceActivityRollRequest): string | null {
    const activity = this.activityManager.getActivity(request.activityId);

    if (!activity || activity.phase !== 'active' || this.isActivityEnding(activity.id)) {
      return null;
    }

    const activityDefinition = this.getActivityDefinition(activity);
    const roll = activityDefinition?.rolls?.find(candidate => candidate.id === request.rollId);
    const previousSelections = this.rollSelectionsByActivityId.get(activity.id) ?? {};

    if (!roll || previousSelections[roll.id]) {
      return previousSelections[request.rollId]?.selectedBranchId ?? null;
    }

    const context = this.createActivityRollRuleContext(activity, previousSelections);
    const selectedBranch = context
      ? selectActivityRollBranch(roll, context)
      : null;

    if (!selectedBranch) {
      return null;
    }

    this.rollSelectionsByActivityId.set(activity.id, {
      ...previousSelections,
      [roll.id]: {
        selectedBranchId: selectedBranch.id,
      },
    });

    if (roll.resolvesActivity) {
      if (this.dialogueObserver.deferActivityResolution(activity, selectedBranch)) {
        return selectedBranch.id;
      }

      this.resolveActivityFromRoll(activity, selectedBranch);
      return selectedBranch.id;
    }

    this.playActivityRollBranchPerformance(activity, selectedBranch);
    return selectedBranch.id;
  }

  deleteSelectionsForActivity(activityId: string): void {
    this.rollSelectionsByActivityId.delete(activityId);
  }

  clearSelections(): void {
    this.rollSelectionsByActivityId.clear();
  }

  private createActivityRollRuleContext(
    activity: JoinableActivity,
    rolls: Readonly<Record<string, ActivityRollSelection>>,
  ): ActivityRollRuleContext | null {
    const initiatorId = activity.hostCharacterIds[0] ?? activity.participantIds[0];
    const targetId = activity.participantIds.find(characterId => characterId !== initiatorId);

    if (!initiatorId || !targetId) {
      return null;
    }

    const initiatorContext = this.getCharacterContext(initiatorId);
    const targetContext = this.getCharacterContext(targetId);

    if (!initiatorContext || !targetContext) {
      return null;
    }

    const initiatorRelationship = initiatorContext.relationships
      .find(relationship => relationship.targetCharId === targetId);
    const targetRelationship = targetContext.relationships
      .find(relationship => relationship.targetCharId === initiatorId);
    const relationshipToTarget = {
      feeling: initiatorRelationship?.feeling ?? Feeling.Neutral,
      intimacy: initiatorRelationship?.intimacy ?? 0,
    };
    const relationshipToInitiator = {
      feeling: targetRelationship?.feeling ?? Feeling.Neutral,
      intimacy: targetRelationship?.intimacy ?? 0,
    };

    return {
      initiator: {
        status: initiatorContext.status,
        personality: this.getCharacterPersonality(initiatorId),
        relationshipToOther: relationshipToTarget,
        relationshipToTarget,
      },
      target: {
        status: targetContext.status,
        personality: this.getCharacterPersonality(targetId),
        relationshipToOther: relationshipToInitiator,
        relationshipToInitiator,
      },
      activity: {
        participantCount: activity.participantIds.length,
        rolls,
      },
    };
  }
}
