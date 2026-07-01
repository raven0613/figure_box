import { SocialStatus } from '~/constants/character';
import {
  CHARACTER_EVENT_DEFINITIONS_BY_ID,
  type CharacterEventActivity,
} from '~/constants/charactarEventsDefinitions';
import type { CharacterPerformanceSelection, CharacterPerformanceRunner } from '~/services/characterEvents/characterPerformanceRunner';
import type { JoinableActivity, JoinableActivityManager } from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import { EventType } from '~/stateMachines/gameFlow/events';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import { canAcceptCharacterEventInvitation } from '~/services/characterEvents/acceptance';
import {
  getSocialOpportunityScore,
  type CharacterSocialOpportunity,
} from '~/services/characterEvents/socialOpportunity';
import {
  getAvailableActivityTargetIds,
  isActivityDefinitionCoolingDown,
} from '~/services/characterEvents/activityCooldowns';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import { getFeelingForIntimacy } from '~/stateMachines/gameFlow/relationships';
import {
  getItemJoinRequirementScope,
  getGroupMaxParticipants,
  getGroupMinParticipants,
  getPostInviteActivityPhase,
} from './townActivityRules';

const SINGLE_INVITE_BASE_WEIGHT = 1;
const STROLL_TOGETHER_ACTIVITY_KEY = 'life.stroll-together';

interface TownActivityInviteResolverOptions {
  activityManager: JoinableActivityManager;
  performanceRunner: CharacterPerformanceRunner;
  getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  getNearbyCharacterIds: (characterId: string, range: number) => string[];
  actorHasItem: (characterId: string, itemId: string) => boolean;
  sendToCharacter: SendCharacterEvent;
  scheduleActivityTimeout: (activityId: string, callback: () => void, delayMs: number) => void;
  getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  clearActivityVisuals: (activity: JoinableActivity) => void;
  sendParticipantsToActivityLocation: (activity: JoinableActivity) => void;
  playActivityPerformance: (activity: JoinableActivity) => void;
  notifyActivitiesChanged: () => void;
  activityResponseDelayMs: number;
}

export class TownActivityInviteResolver {
  private readonly inviteCandidateSelector = new WeightedDecisionSelector();
  private readonly activityManager: JoinableActivityManager;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly getCharacterContext: (characterId: string) => CharacterSnapshot['context'] | null;
  private readonly getRelationshipStatus: (characterId: string, targetCharacterId: string) => SocialStatus;
  private readonly getNearbyCharacterIds: (characterId: string, range: number) => string[];
  private readonly actorHasItem: (characterId: string, itemId: string) => boolean;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly scheduleActivityTimeout: (activityId: string, callback: () => void, delayMs: number) => void;
  private readonly getActivityPerformanceSelection: (activity: JoinableActivity) => CharacterPerformanceSelection;
  private readonly clearActivityVisuals: (activity: JoinableActivity) => void;
  private readonly sendParticipantsToActivityLocation: (activity: JoinableActivity) => void;
  private readonly playActivityPerformance: (activity: JoinableActivity) => void;
  private readonly notifyActivitiesChanged: () => void;
  private readonly activityResponseDelayMs: number;

  constructor(options: TownActivityInviteResolverOptions) {
    this.activityManager = options.activityManager;
    this.performanceRunner = options.performanceRunner;
    this.getCharacterContext = options.getCharacterContext;
    this.getRelationshipStatus = options.getRelationshipStatus;
    this.getNearbyCharacterIds = options.getNearbyCharacterIds;
    this.actorHasItem = options.actorHasItem;
    this.sendToCharacter = options.sendToCharacter;
    this.scheduleActivityTimeout = options.scheduleActivityTimeout;
    this.getActivityPerformanceSelection = options.getActivityPerformanceSelection;
    this.clearActivityVisuals = options.clearActivityVisuals;
    this.sendParticipantsToActivityLocation = options.sendParticipantsToActivityLocation;
    this.playActivityPerformance = options.playActivityPerformance;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
    this.activityResponseDelayMs = options.activityResponseDelayMs;
  }

  getInvitedParticipantIds(
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
    sourceEventId: string,
  ): string[] {
    const maxParticipants = getGroupMaxParticipants(activityDefinition);

    if (maxParticipants <= 1) {
      return [hostCharacterId];
    }

    const inviteNearbyRange = activityDefinition.group.inviteNearbyRange ?? 0;
    const hostContext = this.getCharacterContext(hostCharacterId);
    const eventDefinition = CHARACTER_EVENT_DEFINITIONS_BY_ID[sourceEventId];
    const inviteCandidateIds = this.getNearbyCharacterIds(hostCharacterId, inviteNearbyRange)
      .filter(characterId => this.canInviteCharacterToActivity(characterId, activityDefinition));
    const availableCandidateIds = eventDefinition && hostContext
      ? getAvailableActivityTargetIds(hostContext, eventDefinition, inviteCandidateIds, Date.now())
      : inviteCandidateIds;
    const inviteCandidates = availableCandidateIds.map((characterId, index) => ({
      characterId,
      index,
      score: this.getInviteSocialOpportunityScore(hostContext, hostCharacterId, characterId),
    }));

    if (activityDefinition.key === STROLL_TOGETHER_ACTIVITY_KEY && maxParticipants === 2) {
      const selectedCandidate = this.inviteCandidateSelector.select(
        inviteCandidates.map(candidate => ({
          item: candidate,
          weight: SINGLE_INVITE_BASE_WEIGHT + candidate.score,
        })),
      );

      return selectedCandidate
        ? [hostCharacterId, selectedCandidate.characterId]
        : [hostCharacterId];
    }

    const invitedParticipantIds = inviteCandidates
      .sort((left, right) => (
        right.score - left.score || left.index - right.index
      ))
      .map(candidate => candidate.characterId)
      .slice(0, Math.max(0, maxParticipants - 1));

    return [hostCharacterId, ...invitedParticipantIds];
  }

  canInviteCharacterToActivity(
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

    if (getItemJoinRequirementScope(activityDefinition.joinRequirements) === 'host') {
      return true;
    }

    return this.actorHasItem(characterId, activityDefinition.joinRequirements.itemId);
  }

  private getInviteSocialOpportunityScore(
    hostContext: CharacterSnapshot['context'] | null,
    hostCharacterId: string,
    targetCharacterId: string,
  ): number {
    return getSocialOpportunityScore(
      this.createInviteSocialOpportunity(hostContext, hostCharacterId, targetCharacterId),
    );
  }

  private createInviteSocialOpportunity(
    hostContext: CharacterSnapshot['context'] | null,
    hostCharacterId: string,
    targetCharacterId: string,
  ): CharacterSocialOpportunity {
    const relationship = hostContext?.relationships.find(entry => (
      entry.targetCharId === targetCharacterId
    ));
    const intimacy = relationship?.intimacy ?? 0;

    return {
      characterId: targetCharacterId,
      feeling: relationship?.feeling ?? getFeelingForIntimacy(intimacy),
      intimacy,
      socialStatus: this.getRelationshipStatus(hostCharacterId, targetCharacterId) ?? SocialStatus.Stranger,
    };
  }

  handleGroupInviteResolution(
    activity: JoinableActivity,
    hostCharacterId: string,
    activityDefinition: CharacterEventActivity,
  ): void {
    const inviteeIds = activity.participantIds.filter(participantId => participantId !== hostCharacterId);
    const acceptedInviteeIds = inviteeIds.filter(inviteeId => (
      this.canInviteeAcceptActivity(inviteeId, hostCharacterId, activity)
    ));
    const acceptedParticipantIds = [hostCharacterId, ...acceptedInviteeIds];
    const eventDefinition = CHARACTER_EVENT_DEFINITIONS_BY_ID[activity.sourceEventId];
    const hostContext = this.getCharacterContext(hostCharacterId);
    const shouldCancelCooldownSoloFallback = acceptedInviteeIds.length === 0 &&
      eventDefinition !== undefined &&
      hostContext !== null &&
      isActivityDefinitionCoolingDown(hostContext, eventDefinition, Date.now());

    if (inviteeIds.length > 0) {
      this.performanceRunner.playActivityPerformanceSteps({
        selection: this.getActivityPerformanceSelection(activity),
        phase: 'proposal',
        activityId: activity.id,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      });
    }

    if (shouldCancelCooldownSoloFallback) {
      this.cancelInviteActivity(activity, hostCharacterId, inviteeIds.length > 0, true);
      return;
    }

    if (inviteeIds.length > 0) {
      this.recordInviteCooldowns(activity, hostCharacterId, inviteeIds);
    }

    if (acceptedParticipantIds.length < getGroupMinParticipants(activityDefinition)) {
      this.cancelInviteActivity(activity, hostCharacterId, true, false);
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

    this.scheduleActivityTimeout(acceptedActivity.id, () => {
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
    }, this.activityResponseDelayMs);
  }

  private cancelInviteActivity(
    activity: JoinableActivity,
    hostCharacterId: string,
    playRejectedMood: boolean,
    cancelled: boolean,
  ): void {
    if (playRejectedMood) {
      this.performanceRunner.playActivityPerformanceSteps({
        selection: this.getActivityPerformanceSelection(activity),
        phase: 'rejectedMood',
        activityId: activity.id,
        participantIds: activity.participantIds,
        hostCharacterIds: activity.hostCharacterIds,
      });
    }

    this.scheduleActivityTimeout(activity.id, () => {
      const endedActivity = this.activityManager.endActivity(activity.id);

      if (endedActivity) {
        this.clearActivityVisuals(endedActivity);
      }

      this.sendToCharacter(hostCharacterId, {
        type: EventType.EndJoinedActivity,
        activityId: activity.id,
        cancelled,
        timestamp: Date.now(),
      });
      this.notifyActivitiesChanged();
    }, this.activityResponseDelayMs);
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

    return canAcceptCharacterEventInvitation({
      candidate: context,
      hostCharacterId,
      hostSocialStatus: this.getRelationshipStatus(inviteeId, hostCharacterId)
        ?? SocialStatus.Stranger,
      acceptance: definition.acceptance,
    });
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
}
