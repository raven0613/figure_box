import { SocialStatus, type Position } from '~/constants/character';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import {
  RelationshipMomentOverlayCoordinator,
  type RelationshipMomentOverlay,
} from '~/services/relationshipMomentOverlayCoordinator';
import type { TransientMomentCoordinator } from '~/services/transientMomentCoordinator';
import type { SendCharacterEvent } from '~/services/townCharacterTypes';
import { EventType } from '~/stateMachines/gameFlow/events';

interface StartRelationshipMomentByGodDropInput {
  actorId: string;
  targetCharacterId: string;
  label: string;
  timestamp?: number;
}

interface RelationshipMomentRequestInput {
  overlayId: string;
  actorId: string;
  targetCharacterId: string;
}

interface RelationshipMomentFlowCoordinatorOptions {
  momentCoordinator: TransientMomentCoordinator;
  getActivityByParticipant: (characterId: string) => JoinableActivity | null;
  getActivityParticipantIds: (activityId: string) => readonly string[];
  getRelationshipStatus: (actorId: string, targetCharacterId: string) => SocialStatus;
  promoteStrangerRelationship: (actorId: string, targetCharacterId: string, timestamp: number) => void;
  markSocialRequestResolving: (input: RelationshipMomentRequestInput) => void;
  finishRelationshipMomentRequest: (input: RelationshipMomentRequestInput, rewardText: string) => boolean;
  captureResumeTargets: (characterIds: readonly string[]) => Map<string, Position>;
  resumeTargets: (resumeTargets: ReadonlyMap<string, Position>) => void;
  deferCharactersDecision: (characterIds: readonly string[], durationMs: number) => void;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  durationMs: number;
  decisionGraceMs: number;
}

export class RelationshipMomentFlowCoordinator {
  private readonly overlayCoordinator: RelationshipMomentOverlayCoordinator;
  private readonly getActivityByParticipant: RelationshipMomentFlowCoordinatorOptions['getActivityByParticipant'];
  private readonly getActivityParticipantIds: RelationshipMomentFlowCoordinatorOptions['getActivityParticipantIds'];
  private readonly getRelationshipStatus: RelationshipMomentFlowCoordinatorOptions['getRelationshipStatus'];
  private readonly promoteStrangerRelationship: RelationshipMomentFlowCoordinatorOptions['promoteStrangerRelationship'];
  private readonly markSocialRequestResolving: RelationshipMomentFlowCoordinatorOptions['markSocialRequestResolving'];
  private readonly finishRelationshipMomentRequest: RelationshipMomentFlowCoordinatorOptions['finishRelationshipMomentRequest'];
  private readonly captureResumeTargets: RelationshipMomentFlowCoordinatorOptions['captureResumeTargets'];
  private readonly resumeTargets: RelationshipMomentFlowCoordinatorOptions['resumeTargets'];
  private readonly deferCharactersDecision: RelationshipMomentFlowCoordinatorOptions['deferCharactersDecision'];
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly durationMs: number;
  private readonly decisionGraceMs: number;
  private readonly resumeTargetsByOverlayId = new Map<string, Map<string, Position>>();

  constructor(options: RelationshipMomentFlowCoordinatorOptions) {
    this.overlayCoordinator = new RelationshipMomentOverlayCoordinator({
      momentCoordinator: options.momentCoordinator,
      showCharacterBubble: options.showCharacterBubble,
      onOverlayFinished: overlay => {
        this.finish(overlay);
      },
    });
    this.getActivityByParticipant = options.getActivityByParticipant;
    this.getActivityParticipantIds = options.getActivityParticipantIds;
    this.getRelationshipStatus = options.getRelationshipStatus;
    this.promoteStrangerRelationship = options.promoteStrangerRelationship;
    this.markSocialRequestResolving = options.markSocialRequestResolving;
    this.finishRelationshipMomentRequest = options.finishRelationshipMomentRequest;
    this.captureResumeTargets = options.captureResumeTargets;
    this.resumeTargets = options.resumeTargets;
    this.deferCharactersDecision = options.deferCharactersDecision;
    this.sendToCharacter = options.sendToCharacter;
    this.durationMs = options.durationMs;
    this.decisionGraceMs = options.decisionGraceMs;
  }

  startByGodDrop(input: StartRelationshipMomentByGodDropInput): void {
    if (
      this.overlayCoordinator.isCharacterInOverlay(input.actorId) ||
      this.overlayCoordinator.isCharacterInOverlay(input.targetCharacterId)
    ) {
      return;
    }

    const timestamp = input.timestamp ?? Date.now();
    const targetActivity = this.getActivityByParticipant(input.targetCharacterId);
    const observerIds = this.getObserverIds(input, targetActivity);
    const participantIds = [input.actorId, input.targetCharacterId];
    const resumeTargets = this.captureResumeTargets([...participantIds, ...observerIds]);
    const relationshipStatus = this.getRelationshipStatus(input.actorId, input.targetCharacterId);
    const overlay = this.overlayCoordinator.start({
      actorId: input.actorId,
      targetCharacterId: input.targetCharacterId,
      label: input.label,
      targetBubbleText: getRelationshipMomentTargetBubble(relationshipStatus),
      observerIds,
      sourceActivityId: targetActivity?.id,
      timestamp,
      durationMs: this.durationMs,
    });

    if (!overlay) {
      return;
    }

    if (resumeTargets.size > 0) {
      this.resumeTargetsByOverlayId.set(overlay.id, resumeTargets);
    }

    this.markSocialRequestResolving({
      overlayId: overlay.id,
      actorId: input.actorId,
      targetCharacterId: input.targetCharacterId,
    });
    this.deferCharactersDecision(
      participantIds,
      this.durationMs + this.decisionGraceMs,
    );
    this.sendToCharacter(input.actorId, {
      type: EventType.PassBy,
      targetCharId: input.targetCharacterId,
      timestamp,
    });
    this.sendToCharacter(input.targetCharacterId, {
      type: EventType.PassBy,
      targetCharId: input.actorId,
      timestamp,
    });

    if (relationshipStatus === SocialStatus.Stranger) {
      this.promoteStrangerRelationship(input.actorId, input.targetCharacterId, timestamp);
    }
  }

  isCharacterInMoment(characterId: string): boolean {
    return this.overlayCoordinator.isCharacterInOverlay(characterId);
  }

  dispose(): void {
    this.overlayCoordinator.dispose();
    this.resumeTargetsByOverlayId.clear();
  }

  private finish(overlay: RelationshipMomentOverlay): void {
    const resumeTargets = this.resumeTargetsByOverlayId.get(overlay.id)
      ?? new Map<string, Position>();
    this.resumeTargetsByOverlayId.delete(overlay.id);

    this.deferCharactersDecision(
      [overlay.actorId, overlay.targetCharacterId],
      this.decisionGraceMs,
    );

    const didStartFulfillment = this.finishRelationshipMomentRequest({
      overlayId: overlay.id,
      actorId: overlay.actorId,
      targetCharacterId: overlay.targetCharacterId,
    }, '謝謝你幫我完成心願');

    if (!didStartFulfillment) {
      this.resumeTargets(resumeTargets);
    }
  }

  private getObserverIds(
    input: StartRelationshipMomentByGodDropInput,
    targetActivity: JoinableActivity | null,
  ): string[] {
    if (!targetActivity) {
      return [];
    }

    return uniqueStrings([
      ...targetActivity.participantIds,
      ...this.getActivityParticipantIds(targetActivity.id),
    ]).filter(characterId => (
      characterId !== input.actorId &&
      characterId !== input.targetCharacterId
    ));
  }
}

function getRelationshipMomentTargetBubble(status: SocialStatus): string {
  if (status === SocialStatus.Stranger) {
    return '你好？';
  }

  if (status === SocialStatus.Lovers || status === SocialStatus.Married) {
    return '嗯，我在聽。';
  }

  return '怎麼了？';
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
