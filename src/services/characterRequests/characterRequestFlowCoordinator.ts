import type { Position } from '~/constants/character';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterSnapshot, SendCharacterEvent } from '~/services/townCharacterTypes';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { ItemDefinition } from '~/typing/item';
import type { CharacterRequestService } from './characterRequestService';
import type { CharacterRequestFulfillmentCoordinator } from './requestFulfillmentCoordinator';
import type {
  CharacterRequest,
  CharacterRequestItemMatchInput,
} from './types';

type CharacterContext = CharacterSnapshot['context'];

interface RelationshipMomentRequestInput {
  overlayId: string;
  actorId: string;
  targetCharacterId: string;
}

interface CharacterRequestFlowCoordinatorOptions {
  requestService: CharacterRequestService;
  fulfillmentCoordinator: CharacterRequestFulfillmentCoordinator;
  getActivityByParticipant: (characterId: string) => JoinableActivity | null;
  getActivityById: (activityId: string) => JoinableActivity | null;
  getCharacterContext: (characterId: string) => CharacterContext | null;
  leaveActivity: (activityId: string, characterId: string) => void;
  captureResumeTargets: (characterIds: readonly string[]) => Map<string, Position>;
  resumeTargets: (resumeTargets: ReadonlyMap<string, Position>) => void;
  sendToCharacter: SendCharacterEvent;
  showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  deferCharactersDecision: (characterIds: readonly string[], durationMs: number) => void;
  notifyActivitiesChanged: () => void;
  notifyRequestsChanged: () => void;
  decisionGraceMs: number;
}

export class CharacterRequestFlowCoordinator {
  private readonly requestService: CharacterRequestService;
  private readonly fulfillmentCoordinator: CharacterRequestFulfillmentCoordinator;
  private readonly getActivityByParticipant: (characterId: string) => JoinableActivity | null;
  private readonly getActivityById: (activityId: string) => JoinableActivity | null;
  private readonly getCharacterContext: (characterId: string) => CharacterContext | null;
  private readonly leaveActivity: (activityId: string, characterId: string) => void;
  private readonly captureResumeTargets: (characterIds: readonly string[]) => Map<string, Position>;
  private readonly resumeTargets: (resumeTargets: ReadonlyMap<string, Position>) => void;
  private readonly sendToCharacter: SendCharacterEvent;
  private readonly showCharacterBubble: (characterId: string, text: string, durationMs?: number) => void;
  private readonly deferCharactersDecision: (characterIds: readonly string[], durationMs: number) => void;
  private readonly notifyActivitiesChanged: () => void;
  private readonly notifyRequestsChanged: () => void;
  private readonly decisionGraceMs: number;
  private readonly requestIdsByRelationshipOverlayId = new Map<string, string>();
  private readonly resumeTargetsByRequestId = new Map<string, Map<string, Position>>();

  constructor(options: CharacterRequestFlowCoordinatorOptions) {
    this.requestService = options.requestService;
    this.fulfillmentCoordinator = options.fulfillmentCoordinator;
    this.getActivityByParticipant = options.getActivityByParticipant;
    this.getActivityById = options.getActivityById;
    this.getCharacterContext = options.getCharacterContext;
    this.leaveActivity = options.leaveActivity;
    this.captureResumeTargets = options.captureResumeTargets;
    this.resumeTargets = options.resumeTargets;
    this.sendToCharacter = options.sendToCharacter;
    this.showCharacterBubble = options.showCharacterBubble;
    this.deferCharactersDecision = options.deferCharactersDecision;
    this.notifyActivitiesChanged = options.notifyActivitiesChanged;
    this.notifyRequestsChanged = options.notifyRequestsChanged;
    this.decisionGraceMs = options.decisionGraceMs;
  }

  completeRequest(requestId: string): void {
    const request = this.requestService.markRequestResolving(requestId);

    if (!request) {
      return;
    }

    this.startFulfillment(request);
    this.notifyRequestsChanged();
  }

  markItemReceived(
    input: CharacterRequestItemMatchInput,
    rewardText: string,
    fulfilledItemDefinition?: ItemDefinition,
  ): CharacterRequest | null {
    const result = this.requestService.markMatchingItemRequestResolving(input);

    if (!result.request) {
      return null;
    }

    this.startFulfillment(result.request, rewardText, fulfilledItemDefinition);
    this.notifyRequestsChanged();
    return result.request;
  }

  markSocialRequestResolving(input: RelationshipMomentRequestInput): void {
    const result = this.requestService.markMatchingSocialRequestResolving({
      actorId: input.actorId,
      targetCharacterId: input.targetCharacterId,
    });

    if (!result.request) {
      return;
    }

    this.showCharacterBubble(result.request.characterId, '就是這個！', 1200);
    this.requestIdsByRelationshipOverlayId.set(input.overlayId, result.request.id);
    this.notifyRequestsChanged();
  }

  finishRelationshipMoment(
    input: RelationshipMomentRequestInput,
    rewardText: string,
  ): boolean {
    const request = this.getRequestResolvedByRelationshipMoment(input);

    if (!request) {
      return false;
    }

    this.startFulfillment(request, rewardText);
    return true;
  }

  startFulfillment(
    request: CharacterRequest,
    rewardText?: string,
    fulfilledItemDefinition?: ItemDefinition,
  ): void {
    const participantIds = this.getFulfillmentParticipantIds(request);
    const sourceActivityIds = this.getActivityIdsByParticipants(participantIds);
    const observerIds = this.getObserverIdsForActivities(sourceActivityIds, participantIds);
    const timestamp = Date.now();
    const resumeTargets = this.captureResumeTargets(participantIds);

    this.clearPendingActivityJoins(participantIds, timestamp);

    if (resumeTargets.size > 0) {
      this.resumeTargetsByRequestId.set(request.id, resumeTargets);
    }

    const fulfillment = this.fulfillmentCoordinator.start({
      request,
      participantIds,
      observerIds,
      sourceActivityIds,
      timestamp,
      rewardText,
      fulfilledItemDefinition,
    });

    if (fulfillment) {
      this.deferCharactersDecision(
        participantIds,
        Math.max(0, fulfillment.endsAt - Date.now()) + this.decisionGraceMs,
      );
      return;
    }

    this.finishFulfillment(request);
  }

  finishFulfillment(request: CharacterRequest): void {
    const resumeTargets = this.resumeTargetsByRequestId.get(request.id)
      ?? new Map<string, Position>();
    this.resumeTargetsByRequestId.delete(request.id);

    const completedRequest = this.requestService.completeRequest(request.id);

    if (!completedRequest) {
      this.resumeTargets(resumeTargets);
      return;
    }

    if (completedRequest.satisfiedEffects?.length) {
      this.sendToCharacter(completedRequest.characterId, {
        type: EventType.ApplyRequestEffects,
        requestEffects: completedRequest.satisfiedEffects,
      });
    }

    this.resumeTargets(resumeTargets);
    this.notifyRequestsChanged();
  }

  clear(): void {
    this.requestIdsByRelationshipOverlayId.clear();
    this.resumeTargetsByRequestId.clear();
  }

  private getRequestResolvedByRelationshipMoment(input: RelationshipMomentRequestInput): CharacterRequest | null {
    const requestId = this.requestIdsByRelationshipOverlayId.get(input.overlayId);

    if (requestId) {
      this.requestIdsByRelationshipOverlayId.delete(input.overlayId);
      return this.requestService.getRequests()
        .find(candidate => candidate.id === requestId) ?? null;
    }

    const result = this.requestService.markMatchingSocialRequestResolving({
      actorId: input.actorId,
      targetCharacterId: input.targetCharacterId,
    });

    if (!result.request) {
      return null;
    }

    this.notifyRequestsChanged();
    return result.request;
  }

  private getFulfillmentParticipantIds(request: CharacterRequest): string[] {
    return uniqueStrings([
      request.characterId,
      ...(request.target?.targetCharacterId ? [request.target.targetCharacterId] : []),
    ]);
  }

  private getActivityIdsByParticipants(participantIds: readonly string[]): string[] {
    return uniqueStrings(
      participantIds
        .map(participantId => this.getActivityByParticipant(participantId)?.id)
        .filter((activityId): activityId is string => activityId !== undefined),
    );
  }

  private getObserverIdsForActivities(
    activityIds: readonly string[],
    participantIds: readonly string[],
  ): string[] {
    const participantIdSet = new Set(participantIds);

    return uniqueStrings(
      activityIds.flatMap(activityId => (
        this.getActivityById(activityId)?.participantIds ?? []
      )).filter(participantId => !participantIdSet.has(participantId)),
    );
  }

  private clearPendingActivityJoins(participantIds: readonly string[], timestamp: number): void {
    let didChangeActivity = false;

    participantIds.forEach(participantId => {
      const pendingActivityJoin = this.getCharacterContext(participantId)?.pendingActivityJoin;

      if (!pendingActivityJoin) {
        return;
      }

      this.leaveActivity(pendingActivityJoin.activityId, participantId);
      didChangeActivity = true;
      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId: pendingActivityJoin.activityId,
        timestamp,
      });
    });

    if (didChangeActivity) {
      this.notifyActivitiesChanged();
    }
  }
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
