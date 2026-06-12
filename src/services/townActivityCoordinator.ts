import { Feeling, SocialStatus, type Position } from '~/constants/character';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
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
  CharacterPerformanceRunner,
} from '~/services/characterEvents/characterPerformanceRunner';
import {
  selectActivityRollBranch,
  type ActivityRollRuleContext,
  type ActivityRollSelection,
} from '~/services/characterEvents/activityRolls';
import type {
  JoinableActivity,
  JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import type {
  ResolveActivityOutcomeInput,
  ResolvedActivityOutcome,
} from '~/services/characterEvents/activityOutcomeResolver';
import { resolveDialogueContent } from '~/services/dialogueContentResolver';

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
  private readonly arrivedCharacterIdsByActivityId = new Map<string, Set<string>>();
  private readonly endingActivityIds = new Set<string>();
  private readonly rollSelectionsByActivityId = new Map<
    string,
    Readonly<Record<string, ActivityRollSelection>>
  >();
  private readonly dialogueSubjectIdsByActivityId = new Map<
    string,
    Readonly<Record<string, string>>
  >();
  private readonly selectedDialogueSubjectIdByActivityId = new Map<string, string>();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getCharacterName: (characterId: string) => string;
  private readonly getCharacterPersonality: (characterId: string) => CharacterPersonality;
  private readonly getCharacterPosition: (characterId: string) => Position | null;
  private readonly getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  private readonly getNearbyCharacterIds: (characterId: string, range: number) => string[];
  private readonly getTravelTarget: (destination: Position) => Position;
  private readonly actorHasItem: (characterId: string, itemId: string) => boolean;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
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
    this.getTravelTarget = options.getTravelTarget;
    this.actorHasItem = options.actorHasItem;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.resolveActivityOutcome = options.resolveActivityOutcome;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
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
    const activityJoin = snapshot.context.pendingActivityJoin;

    if (!activityJoin) {
      return;
    }

    if (snapshot.context.controlState !== CharacterControlState.Normal) {
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
    this.showCharacterBubble(characterId, this.getJoinBubbleText(joinedActivity), 2200);

    if (joinedActivity.phase === 'traveling') {
      this.sendParticipantToActivityLocation(joinedActivity, characterId);
    } else {
      this.playActivityPerformance(joinedActivity);
    }

    this.notifyActivitiesChanged();
  }

  handleActivityTravelProgress(characterId: string, snapshot: CharacterSnapshot): void {
    this.removeStaleActivityParticipations(characterId, snapshot);

    const activityId = snapshot.context.currentActivity?.activityId;

    if (!activityId) {
      return;
    }

    const activity = this.activityManager.getActivity(activityId);

    if (!activity || activity.phase !== 'traveling' || !activity.location || snapshot.context.target) {
      return;
    }

    if (!isNearPosition(snapshot.context.position, activity.location, 2)) {
      return;
    }

    this.arrivedCharacterIdsByActivityId.set(
      activity.id,
      new Set([
        ...(this.arrivedCharacterIdsByActivityId.get(activity.id) ?? []),
        characterId,
      ]),
    );

    const arrivedCharacterIds = this.arrivedCharacterIdsByActivityId.get(activity.id) ?? new Set<string>();
    const hasEveryoneArrived = activity.participantIds.every(participantId => arrivedCharacterIds.has(participantId));

    if (!hasEveryoneArrived) {
      return;
    }

    const timestamp = Date.now();
    const activeActivity = this.activityManager.updateActivityPhase(activity.id, 'active', activity.location);
    const refreshedActivity = activeActivity
      ? this.activityManager.refreshActivityDuration(activeActivity.id, timestamp)
      : null;

    if (!refreshedActivity) {
      return;
    }

    refreshedActivity.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.JoinActivityAccepted,
        activityId: refreshedActivity.id,
        sourceEventId: refreshedActivity.sourceEventId,
      });
    });
    this.playActivityPerformance(refreshedActivity);
    this.notifyActivitiesChanged();
  }

  handleCharacterPickedUp(characterId: string): boolean {
    const activity = this.activityManager.getActivities()
      .find(candidate => candidate.participantIds.includes(characterId));

    if (!activity) {
      return false;
    }

    const previousParticipantCount = activity.participantIds.length;
    const nextActivity = this.activityManager.leaveActivity(activity.id, characterId);

    this.arrivedCharacterIdsByActivityId.get(activity.id)?.delete(characterId);
    this.dialogueSubjectIdsByActivityId.delete(activity.id);
    this.selectedDialogueSubjectIdByActivityId.delete(activity.id);
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.performanceRunner.clearActivityActiveVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );

    if (activity.phase === 'inviting') {
      const endedActivity = this.activityManager.endActivity(activity.id) ?? activity;

      this.clearActivityVisuals(endedActivity);
      this.rollSelectionsByActivityId.delete(activity.id);
      endedActivity.participantIds
        .filter(participantId => participantId !== characterId)
        .forEach(participantId => {
          this.sendToCharacter(participantId, {
            type: EventType.EndJoinedActivity,
            activityId: activity.id,
            timestamp: Date.now(),
          });
        });
      this.notifyActivitiesChanged();
      return true;
    }

    if (!nextActivity) {
      this.clearActivityVisuals(activity);
      this.rollSelectionsByActivityId.delete(activity.id);
      this.notifyActivitiesChanged();
      return true;
    }

    nextActivity.participantIds.forEach(participantId => {
      this.sendToCharacter(participantId, {
        type: EventType.JoinActivityAccepted,
        activityId: nextActivity.id,
        sourceEventId: nextActivity.sourceEventId,
      });
    });
    this.playParticipantLeftPerformance(nextActivity, previousParticipantCount);
    this.notifyActivitiesChanged();
    return true;
  }

  clearLiveActivitiesForOfflineApply(): void {
    const activities = this.activityManager.getActivities();

    if (activities.length === 0) {
      this.arrivedCharacterIdsByActivityId.clear();
      this.endingActivityIds.clear();
      this.rollSelectionsByActivityId.clear();
      this.dialogueSubjectIdsByActivityId.clear();
      this.selectedDialogueSubjectIdByActivityId.clear();
      return;
    }

    activities.forEach(activity => {
      this.clearActivityVisuals(activity);
      this.arrivedCharacterIdsByActivityId.delete(activity.id);
      this.endingActivityIds.delete(activity.id);
      this.rollSelectionsByActivityId.delete(activity.id);
      this.dialogueSubjectIdsByActivityId.delete(activity.id);
      this.selectedDialogueSubjectIdByActivityId.delete(activity.id);
      this.performanceRunner.cancelActivityPerformance(activity.id);
    });
    this.activityManager.clear();
    this.arrivedCharacterIdsByActivityId.clear();
    this.endingActivityIds.clear();
    this.rollSelectionsByActivityId.clear();
    this.dialogueSubjectIdsByActivityId.clear();
    this.selectedDialogueSubjectIdByActivityId.clear();
    this.notifyActivitiesChanged();
  }

  removeStaleActivityParticipations(characterId: string, snapshot: CharacterSnapshot): void {
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
      this.arrivedCharacterIdsByActivityId.get(activity.id)?.delete(characterId);
      this.dialogueSubjectIdsByActivityId.delete(activity.id);
      this.selectedDialogueSubjectIdByActivityId.delete(activity.id);

      if (!nextActivity) {
        this.rollSelectionsByActivityId.delete(activity.id);
      }
    });
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
      this.arrivedCharacterIdsByActivityId.delete(activity.id);
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
    const activity = this.activityManager.getActivity(request.activityId);

    if (!activity || activity.phase !== 'active' || this.endingActivityIds.has(activity.id)) {
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
      this.resolveActivityFromRoll(activity, selectedBranch);
      return selectedBranch.id;
    }

    this.playActivityRollBranchPerformance(activity, selectedBranch);
    return selectedBranch.id;
  }

  createActivityDialogueRequest(
    activityId: string,
  ): CharacterPerformanceDialogueRequest | null {
    const activity = this.activityManager.getActivity(activityId);

    if (
      !activity
      || activity.phase !== 'active'
      || activity.pausedAt !== undefined
      || this.endingActivityIds.has(activity.id)
    ) {
      return null;
    }

    const activityDefinition = this.getActivityDefinition(activity);
    const dialogueScriptId = activityDefinition?.dialogueScriptId;
    const initiatorId = activity.hostCharacterIds[0] ?? activity.participantIds[0];
    const targetId = activity.participantIds.find(characterId => characterId !== initiatorId);

    if (!dialogueScriptId || !initiatorId || !targetId) {
      return null;
    }

    const dialogueSubjects = this.dialogueSubjectIdsByActivityId.get(activity.id)
      ?? this.prepareActivityDialogueSubjects(activity, activityDefinition);

    if (
      activityDefinition.dialogueSubjectSelection
      && Object.keys(dialogueSubjects).length < activityDefinition.dialogueSubjectSelection.count
    ) {
      return null;
    }

    this.activityManager.pauseActivity(activity.id, Date.now());
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.notifyActivitiesChanged();

    return {
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
      resolveActivityRoll: rollId => this.resolveActivityRoll({
        activityId: activity.id,
        rollId,
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
          relationships: subjectContext.relationships,
          getCharacterName: this.getCharacterName,
        });

        if (!content) {
          return null;
        }

        this.selectedDialogueSubjectIdByActivityId.set(activity.id, subjectId);
        return [{
          type: 'SAY',
          speakerId: initiatorId,
          text: content.text,
          expression: content.expression,
        }];
      },
      onClose: () => {
        this.resumeActivityAfterDialogue(activity.id);
      },
    };
  }

  private selectDialogueSubjects(
    activity: JoinableActivity,
    initiatorId: string,
    targetId: string,
    selection: NonNullable<CharacterEventActivity['dialogueSubjectSelection']>,
  ): Readonly<Record<string, string>> {
    const sourceId = selection.sourceRole === 'initiator'
      ? initiatorId
      : targetId;
    const sourceContext = this.getCharacterContext(sourceId);

    if (!sourceContext) {
      return {};
    }

    const excludedCharacterIds = selection.excludeParticipants
      ? new Set(activity.participantIds)
      : new Set<string>();
    const candidateIds = sourceContext.relationships
      .filter(relationship => (
        relationship.charId === sourceId
        && !excludedCharacterIds.has(relationship.targetCharId)
        && this.getCharacterContext(relationship.targetCharId) !== null
        && relationship.memories[selection.memoryType].counts >= selection.minCount
      ))
      .map(relationship => relationship.targetCharId);
    const selectedIds = sampleWithoutReplacement(candidateIds, selection.count);

    return Object.fromEntries(
      selectedIds.map((characterId, index) => [
        `subject${String.fromCharCode(65 + index)}`,
        characterId,
      ]),
    );
  }

  private prepareActivityDialogueSubjects(
    activity: JoinableActivity,
    activityDefinition: CharacterEventActivity,
  ): Readonly<Record<string, string>> {
    const existingSubjects = this.dialogueSubjectIdsByActivityId.get(activity.id);

    if (existingSubjects) {
      return existingSubjects;
    }

    const selection = activityDefinition.dialogueSubjectSelection;
    const initiatorId = activity.hostCharacterIds[0] ?? activity.participantIds[0];
    const targetId = activity.participantIds.find(characterId => characterId !== initiatorId);

    if (!selection || !initiatorId || !targetId) {
      return {};
    }

    const subjects = this.selectDialogueSubjects(
      activity,
      initiatorId,
      targetId,
      selection,
    );

    if (Object.keys(subjects).length < selection.count) {
      return {};
    }

    this.dialogueSubjectIdsByActivityId.set(activity.id, subjects);
    const subjectIds = Object.values(subjects);
    const defaultSubjectId = subjectIds[Math.floor(Math.random() * subjectIds.length)];

    if (defaultSubjectId) {
      this.selectedDialogueSubjectIdByActivityId.set(activity.id, defaultSubjectId);
    }

    return subjects;
  }

  private rejectActivityJoin(characterId: string, activityId: string): void {
    this.sendToCharacter(characterId, {
      type: EventType.JoinActivityRejected,
      activityId,
    });
  }

  private resumeActivityAfterDialogue(activityId: string): void {
    const activity = this.activityManager.getActivity(activityId);

    if (
      !activity
      || activity.pausedAt === undefined
      || this.endingActivityIds.has(activity.id)
    ) {
      return;
    }

    const resumedActivity = this.activityManager.resumeActivity(activity.id, Date.now());

    if (!resumedActivity) {
      return;
    }

    this.playActivityPerformance(resumedActivity);
    this.notifyActivitiesChanged();
  }

  private getInvitedParticipantIds(hostCharacterId: string, activityDefinition: CharacterEventActivity): string[] {
    const maxParticipants = getGroupMaxParticipants(activityDefinition);

    if (maxParticipants <= 1) {
      return [hostCharacterId];
    }

    const inviteNearbyRange = activityDefinition.group.inviteNearbyRange ?? 0;
    const invitedParticipantIds = this.getNearbyCharacterIds(hostCharacterId, inviteNearbyRange)
      .filter(characterId => this.canInviteCharacterToActivity(characterId, activityDefinition))
      .slice(0, Math.max(0, maxParticipants - 1));

    return [hostCharacterId, ...invitedParticipantIds];
  }

  private canInviteCharacterToActivity(
    characterId: string,
    activityDefinition: CharacterEventActivity,
  ): boolean {
    const context = this.getCharacterContext(characterId);

    if (!context) {
      return false;
    }

    if (
      context.controlState !== CharacterControlState.Normal ||
      context.currentMotivation !== 'idle' ||
      context.target ||
      context.currentActivity ||
      context.pendingActivityJoin
    ) {
      return false;
    }

    if (!activityDefinition.joinRequirements || activityDefinition.joinRequirements.type === 'none') {
      return true;
    }

    const requiredItemId = activityDefinition.joinRequirements.itemId;

    return this.actorHasItem(characterId, requiredItemId);
  }

  private handleGroupInviteResolution(
    activity: JoinableActivity,
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
  ): void {
    const inviteeIds = activity.participantIds.filter(participantId => participantId !== hostCharacterId);
    const acceptedInviteeIds = inviteeIds.filter(inviteeId => (
      this.canInviteeAcceptActivity(inviteeId, hostCharacterId, activity)
    ));
    const acceptedParticipantIds = [hostCharacterId, ...acceptedInviteeIds];

    if (inviteeIds.length > 0) {
      this.performanceRunner.playActivityPerformanceSteps({
        selection: this.getActivityPerformanceSelection(activity),
        phase: 'proposal',
        activityId: activity.id,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      });
      this.recordInviteCooldowns(activity, hostCharacterId, inviteeIds);
    }

    if (acceptedParticipantIds.length < getGroupMinParticipants(activityDefinition)) {
      this.performanceRunner.playActivityPerformanceSteps({
        selection: this.getActivityPerformanceSelection(activity),
        phase: 'rejectedMood',
        activityId: activity.id,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      });
      window.setTimeout(() => {
        const endedActivity = this.activityManager.endActivity(activity.id);

        if (endedActivity) {
          this.clearActivityVisuals(endedActivity);
        }

        this.sendToCharacter(hostCharacterId, {
          type: EventType.EndJoinedActivity,
          activityId: activity.id,
          timestamp: Date.now(),
        });
        this.notifyActivitiesChanged();
      }, DEFAULT_ACTIVITY_RESPONSE_DELAY_MS);
      return;
    }

    const acceptedInviteeIdSet = new Set(acceptedInviteeIds);
    const acceptedActivity = inviteeIds
      .filter(inviteeId => !acceptedInviteeIdSet.has(inviteeId))
      .reduce<JoinableActivity>(
        (nextActivity, rejectedInviteeId) => (
          this.activityManager.leaveActivity(nextActivity.id, rejectedInviteeId) ?? nextActivity
        ),
        activity,
      );

    acceptedInviteeIds.forEach(inviteeId => {
      this.sendToCharacter(inviteeId, {
        type: EventType.JoinActivityAccepted,
        activityId: acceptedActivity.id,
        sourceEventId: acceptedActivity.sourceEventId,
      });
    });

    if (acceptedInviteeIds.length > 0) {
      this.performanceRunner.playActivityPerformanceSteps({
        selection: this.getActivityPerformanceSelection(acceptedActivity),
        phase: 'accepted',
        activityId: acceptedActivity.id,
        participantIds: acceptedActivity.participantIds,
        hostCharacterIds: acceptedActivity.hostCharacterIds,
      });
    }

    window.setTimeout(() => {
      const nextPhase = getPostInviteActivityPhase(activityDefinition);
      const activeActivity = this.activityManager.updateActivityPhase(
        acceptedActivity.id,
        nextPhase,
        acceptedActivity.location,
      );
      const refreshedActivity = activeActivity
        ? this.activityManager.refreshActivityDuration(activeActivity.id, Date.now())
        : null;

      if (!refreshedActivity) {
        return;
      }

      if (nextPhase === 'traveling') {
        this.sendParticipantsToActivityLocation(refreshedActivity);
      } else {
        this.playActivityPerformance(refreshedActivity);
      }
      this.notifyActivitiesChanged();
    }, DEFAULT_ACTIVITY_RESPONSE_DELAY_MS);
  }

  private canInviteeAcceptActivity(
    inviteeId: string,
    hostCharacterId: string,
    activity: JoinableActivity,
  ): boolean {
    const context = this.getCharacterContext(inviteeId);
    const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId];

    if (!context || !definition) {
      return false;
    }

    const acceptance = definition.acceptance;

    if (!acceptance) {
      return true;
    }

    const meetsMinMood = acceptance.minMoodValue === undefined ||
      context.status.moodValue >= acceptance.minMoodValue;
    const meetsAllowedMood = !acceptance.allowedMoods?.length ||
      acceptance.allowedMoods.includes(context.status.mood);
    const meetsRelationship = !acceptance.relationships?.length ||
      acceptance.relationships.some(requirement => {
        const relationship = context.relationships.find(entry => entry.targetCharId === hostCharacterId);
        const intimacy = relationship?.intimacy ?? 0;
        const socialStatus = this.getRelationshipStatus(inviteeId, hostCharacterId) ?? SocialStatus.Stranger;

        if (requirement.minIntimacy !== undefined && intimacy < requirement.minIntimacy) {
          return false;
        }

        if (requirement.maxIntimacy !== undefined && intimacy > requirement.maxIntimacy) {
          return false;
        }

        const feeling = relationship?.feeling ?? Feeling.Neutral;

        if (requirement.allowedFeelings?.length && !requirement.allowedFeelings.includes(feeling)) {
          return false;
        }

        if (
          requirement.allowedSocialStatuses?.length &&
          !requirement.allowedSocialStatuses.includes(socialStatus)
        ) {
          return false;
        }

        return true;
      });

    if (meetsMinMood && meetsAllowedMood && meetsRelationship) {
      return true;
    }

    return Math.random() <= (acceptance.fallbackChance ?? 0);
  }

  private recordInviteCooldowns(
    activity: JoinableActivity,
    hostCharacterId: string,
    inviteeIds: readonly string[],
  ): void {
    if (inviteeIds.length === 0) {
      return;
    }

    const timestamp = Date.now();

    this.sendToCharacter(hostCharacterId, {
      type: EventType.RecordActivityCooldown,
      partnerCharIds: [...inviteeIds],
      role: 'initiator',
      sourceEventId: activity.sourceEventId,
      timestamp,
    });
    inviteeIds.forEach(inviteeId => {
      this.sendToCharacter(inviteeId, {
        type: EventType.RecordActivityCooldown,
        partnerCharIds: [hostCharacterId],
        role: 'target',
        sourceEventId: activity.sourceEventId,
        timestamp,
      });
    });
  }

  private acceptInvitedParticipants(activity: JoinableActivity, hostCharacterId: string): void {
    activity.participantIds
      .filter(participantId => participantId !== hostCharacterId)
      .forEach(participantId => {
        this.sendToCharacter(participantId, {
          type: EventType.JoinActivityAccepted,
          activityId: activity.id,
          sourceEventId: activity.sourceEventId,
        });
        this.showCharacterBubble(participantId, this.getJoinBubbleText(activity), 2200);
      });
  }

  private sendParticipantsToActivityLocation(activity: JoinableActivity): void {
    activity.participantIds.forEach(participantId => {
      this.sendParticipantToActivityLocation(activity, participantId);
    });
  }

  private sendParticipantToActivityLocation(
    activity: JoinableActivity,
    characterId: string,
  ): void {
    if (!activity.location) {
      return;
    }

    this.sendToCharacter(characterId, {
      type: EventType.MoveTo,
      target: this.getTravelTarget(activity.location),
    });
  }

  private getSelectedActivityDefinition(snapshot: CharacterSnapshot): CharacterEventActivity | undefined {
    const definitionId = snapshot.context.lastEventDecision?.selectedCandidateId;
    const variantId = snapshot.context.lastEventDecision?.selectedPresentationVariantId;

    if (!definitionId || !variantId) {
      return undefined;
    }

    return CHARACTER_EVENT_DEFINITIONS_BY_ID[definitionId]?.presentationVariants
      ?.find(variant => variant.id === variantId)
      ?.activity;
  }

  private playActivityPerformance(activity: JoinableActivity): void {
    const activityDefinition = this.getActivityDefinition(activity);

    if (activityDefinition) {
      this.prepareActivityDialogueSubjects(activity, activityDefinition);
    }

    this.performanceRunner.playActivityPerformanceSteps({
      selection: this.getActivityPerformanceSelection(activity),
      phase: 'active',
      activityId: activity.id,
      participantIds: activity.participantIds,
      hostCharacterIds: activity.hostCharacterIds,
    });
  }

  private playActivityRollBranchPerformance(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): number {
    if (!branch.performanceId) {
      return 0;
    }

    const dialogueSubjectId = this.selectedDialogueSubjectIdByActivityId.get(activity.id);

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

  private resolveActivityFromRoll(
    activity: JoinableActivity,
    branch: CharacterEventActivityRollBranch,
  ): void {
    const dialogueSubjectId = this.selectedDialogueSubjectIdByActivityId.get(activity.id);

    this.endingActivityIds.add(activity.id);
    this.performanceRunner.cancelActivityPerformance(activity.id);
    this.performanceRunner.clearActivityActiveVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
    this.activityManager.endActivity(activity.id);

    const durationMs = this.playActivityRollBranchPerformance(activity, branch);
    const cleanupDelayMs = durationMs || DEFAULT_ACTIVITY_END_DURATION_MS;

    this.notifyActivitiesChanged();
    window.setTimeout(() => {
      this.clearActivityVisuals(activity);
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
      this.rollSelectionsByActivityId.delete(activity.id);
      this.dialogueSubjectIdsByActivityId.delete(activity.id);
      this.selectedDialogueSubjectIdByActivityId.delete(activity.id);
      this.endingActivityIds.delete(activity.id);
      this.notifyActivitiesChanged();
    }, cleanupDelayMs);
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

  private clearActivityVisuals(activity: JoinableActivity): void {
    this.performanceRunner.clearActivityVisuals(
      this.getActivityPerformanceSelection(activity),
      activity.id,
      activity.participantIds,
      activity.hostCharacterIds,
    );
  }

  private playActivityEndPerformance(activity: JoinableActivity, timestamp: number): void {
    this.endingActivityIds.add(activity.id);
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
    const cleanupDelayMs = durationMs || DEFAULT_ACTIVITY_END_DURATION_MS;
    const activityEffects = this.getActivityEffects(activity);
    const activityEffectsByRole = this.getActivityEffectsByRole(activity);

    window.setTimeout(() => {
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
      this.endingActivityIds.delete(activity.id);
      this.rollSelectionsByActivityId.delete(activity.id);
      this.dialogueSubjectIdsByActivityId.delete(activity.id);
      this.selectedDialogueSubjectIdByActivityId.delete(activity.id);
      this.notifyActivitiesChanged();
    }, cleanupDelayMs);
  }

  private playParticipantLeftPerformance(
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

    window.setTimeout(() => {
      const currentActivity = this.activityManager.getActivity(activity.id);

      if (!currentActivity || currentActivity.phase !== 'active') {
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
    }, 5000);
  }

  private getActivityDefinition(activity: JoinableActivity): CharacterEventActivity | undefined {
    return CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
      ?.find(variant => variant.activity?.key === activity.activityKey)
      ?.activity;
  }

  private getActivityPerformanceSelection(activity: JoinableActivity) {
    return {
      definitionId: activity.sourceEventId,
      variantId: CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
        ?.find(variant => variant.activity?.key === activity.activityKey)
        ?.id,
    };
  }

  private getActivityEffects(activity: JoinableActivity): CharacterEventActivityEffects | undefined {
    return CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
      ?.find(variant => variant.activity?.key === activity.activityKey)
      ?.activity
      ?.effects;
  }

  private getActivityEffectsByRole(
    activity: JoinableActivity,
  ): CharacterEventActivity['effectsByRole'] {
    return CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId]?.presentationVariants
      ?.find(variant => variant.activity?.key === activity.activityKey)
      ?.activity
      ?.effectsByRole;
  }

  private getJoinBubbleText(activity: JoinableActivity): string {
    if (activity.type === 'playWithItem') {
      return '我也有，加入！';
    }

    return '我也要一起玩！';
  }
}

function sampleWithoutReplacement<T>(
  candidates: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const remaining = [...new Set(candidates)];

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }

  return remaining.slice(0, count);
}

function isNearPosition(position: Position, target: Position, range: number): boolean {
  return Math.max(
    Math.abs(position.x - target.x),
    Math.abs(position.y - target.y),
  ) <= range;
}

function shouldResolveGroupInvites(activityDefinition: CharacterEventActivity): boolean {
  return getGroupMaxParticipants(activityDefinition) > 1 || getGroupMinParticipants(activityDefinition) > 1;
}

function getPostInviteActivityPhase(activityDefinition: CharacterEventActivity): 'active' | 'traveling' {
  if (activityDefinition.startPhase) {
    return activityDefinition.startPhase;
  }

  return activityDefinition.destination ? 'traveling' : 'active';
}

function getGroupMinParticipants(activityDefinition: CharacterEventActivity): number {
  return activityDefinition.group.minParticipants ?? 1;
}

function getGroupMaxParticipants(activityDefinition: CharacterEventActivity): number {
  const minParticipants = getGroupMinParticipants(activityDefinition);
  return Math.max(minParticipants, activityDefinition.group.maxParticipants ?? minParticipants);
}
