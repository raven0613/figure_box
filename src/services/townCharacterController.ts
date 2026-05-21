import { createActor } from 'xstate';
import { CHARACTER_SEEDS, Expression, SocialStatus, type Position } from '~/constants/character';
import { characterMachine } from '~/stateMachines/gameFlow/children/character';
import { CharacterPerformanceRunner } from '~/services/characterEvents/characterPerformanceRunner';
import { getRandomDestinationTarget } from '~/services/characterEvents/targets';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import {
  createJoinableActivityManager,
  type JoinableActivity,
  type JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { CharacterHeldItem } from '~/stateMachines/gameFlow/context';
import {
  createRelationshipStore,
  getFeelingForIntimacy,
  normalizeRelationshipPair,
  updateMutualRelationshipStatus,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import { TownActivityCoordinator } from '~/services/townActivityCoordinator';
import { TownMovementCoordinator } from '~/services/townMovementCoordinator';
import { TownRelationshipTicker } from '~/services/townRelationshipTicker';
import { ActivityInterruptionMomentCoordinator } from '~/services/activityInterruptionMomentCoordinator';
import {
  GOD_DROP_SCAN_RADIUS,
  GodDropOpportunityService,
  type GodDropOpportunity,
  type GodDropOpportunityCandidate,
} from '~/services/godDropOpportunityService';
import { CHARACTER_REQUEST_DEFINITIONS } from '~/constants/characterRequestDefinitions';
import { CharacterRequestService } from '~/services/characterRequests/characterRequestService';
import { getVisibleRequestIndicators, type RequestVisibilityIndicator } from '~/services/characterRequests/visibility';
import type {
  CharacterRequest,
  CharacterRequestCharacterTarget,
  CharacterRequestItemMatchInput,
} from '~/services/characterRequests/types';
import { CharacterRequestFulfillmentCoordinator } from '~/services/characterRequests/requestFulfillmentCoordinator';
import { RelationshipMomentOverlayCoordinator } from '~/services/relationshipMomentOverlayCoordinator';
import type { RelationshipMomentOverlay } from '~/services/relationshipMomentOverlayCoordinator';
import type {
  CharacterActor,
  CharacterSeed,
  CharacterSnapshot,
} from '~/services/townCharacterTypes';
import type { CharacterEventNearbyRelationship } from '~/services/characterEvents/types';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';
import {
  TOWN_APARTMENT_ENTRANCE_TILES,
  TOWN_APARTMENT_SPACE_ID,
  TOWN_WORLD_SPACE_ID,
} from '~/constants/townMap';
import type { ItemDefinition, ItemDefinitionId, ItemInstanceId } from '~/typing/item';
import { itemHoldingService } from '~/services/items/itemHoldingService';
import { itemService } from '~/services/items/itemService';

type Subscription = {
  unsubscribe: () => void;
};

interface ActivityHeldItemRecord {
  itemInstanceId: ItemInstanceId;
}

export type { CharacterSnapshot } from '~/services/townCharacterTypes';

const INITIAL_DECISION_STAGGER_MIN_MS = 500;
const INITIAL_DECISION_STAGGER_MAX_MS = 4500;
const DECISION_INTERVAL_MIN_MS = 2500;
const DECISION_INTERVAL_MAX_MS = 5500;
const RELATIONSHIP_MOMENT_DURATION_MS = 3000;
const RELATIONSHIP_MOMENT_DECISION_GRACE_MS = 1800;
const GOD_DROP_DECISION_GRACE_MS = 2600;
const APARTMENT_EXIT_FOOD_SCORE_THRESHOLD = 65;
const APARTMENT_EXIT_PLAY_SCORE_THRESHOLD = 72;

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  onGodDropOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;
  onCharacterRequestsChange?: (requests: readonly CharacterRequest[]) => void;
}

export class TownCharacterController {
  private readonly widget: FabricTownMapWidget;
  private readonly characterActors = new Map<string, CharacterActor>();
  private readonly characterSubscriptions = new Map<string, Subscription>();
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly activityManager: JoinableActivityManager;
  private readonly activityCoordinator: TownActivityCoordinator;
  private readonly movementCoordinator: TownMovementCoordinator;
  private readonly relationshipTicker: TownRelationshipTicker;
  private readonly activityInterruptionMomentCoordinator: ActivityInterruptionMomentCoordinator;
  private readonly relationshipMomentOverlayCoordinator: RelationshipMomentOverlayCoordinator;
  private readonly requestFulfillmentCoordinator: CharacterRequestFulfillmentCoordinator;
  private readonly godDropOpportunityService = new GodDropOpportunityService();
  private readonly characterRequestService = new CharacterRequestService({
    definitions: CHARACTER_REQUEST_DEFINITIONS,
  });
  private readonly nextDecisionAtByCharacterId = new Map<string, number>();
  private relationshipStore = createRelationshipStore();
  private tickTimer: number | null = null;
  private godDropAutoTimer: number | null = null;
  private godDropExpireTimer: number | null = null;
  private currentGodDropOpportunity: GodDropOpportunity | null = null;
  private readonly activeRequestIndicatorCharacterIds = new Set<string>();
  private readonly activeRequestMapMarkerIds = new Set<string>();
  private readonly requestIdsByRelationshipOverlayId = new Map<string, string>();
  private readonly renderedHeldItemInstanceIdByCharacterId = new Map<string, string>();
  private readonly activityHeldItemsByCharacterId = new Map<string, ActivityHeldItemRecord>();
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private readonly onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  private readonly onGodDropOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;
  private readonly onCharacterRequestsChange?: (requests: readonly CharacterRequest[]) => void;

  constructor(options: TownCharacterControllerOptions) {
    this.widget = options.widget;
    this.activityManager = createJoinableActivityManager();
    this.performanceRunner = new CharacterPerformanceRunner({
      getCharacterName: characterId => this.getCharacterName(characterId),
      setCharacterExpression: (characterId, expression) => {
        this.setCharacterExpression(characterId, expression);
      },
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      removeCharacterBubble: characterId => {
        this.widget.removeCharacterBubble(characterId);
      },
      showCharacterEmote: (characterId, text, durationMs) => {
        this.widget.showCharacterEmote(characterId, text, durationMs);
      },
      showMapActivity: (activity, durationMs) => {
        this.widget.showMapActivity(activity, durationMs);
      },
      removeMapActivity: activityId => {
        this.widget.removeMapActivity(activityId);
      },
    });
    this.movementCoordinator = new TownMovementCoordinator({
      widget: this.widget,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.activityInterruptionMomentCoordinator = new ActivityInterruptionMomentCoordinator({
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      showMapActivity: (activity, durationMs) => {
        this.widget.showMapActivity(activity, durationMs);
      },
      pauseActivity: (activityId, timestamp) => {
        this.activityManager.pauseActivity(activityId, timestamp);
        this.notifyJoinableActivitiesChanged();
      },
      resumeActivity: (activityId, timestamp) => {
        const resumedActivity = this.activityManager.resumeActivity(activityId, timestamp);
        this.notifyJoinableActivitiesChanged();

        if (!resumedActivity) {
          return;
        }

        // Let interruption cleanup release temporary presentation items before restoring activity visuals.
        window.setTimeout(() => {
          this.activityCoordinator.replayActivityActiveVisuals(activityId);
        }, 0);
      },
      pauseCharacterWalk: (characterId, durationMs) => {
        this.movementCoordinator.pauseCharacterWalk(characterId, durationMs);
      },
    });
    this.relationshipMomentOverlayCoordinator = new RelationshipMomentOverlayCoordinator({
      momentCoordinator: this.activityInterruptionMomentCoordinator,
      pauseCharacterWalk: (characterId, durationMs) => {
        this.movementCoordinator.pauseCharacterWalk(characterId, durationMs);
      },
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      onOverlayFinished: overlay => {
        this.handleRelationshipMomentFinished(overlay);
      },
    });
    this.requestFulfillmentCoordinator = new CharacterRequestFulfillmentCoordinator({
      momentCoordinator: this.activityInterruptionMomentCoordinator,
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      holdItem: (characterId, itemDefinition) => {
        this.widget.holdItem(characterId, itemDefinition);
      },
      releaseHeldItem: characterId => {
        this.widget.releaseHeldItem(characterId);
        this.syncCharacterHeldItemWithWidget(
          characterId,
          this.getCharacterSnapshot(characterId)?.context.heldItem ?? null,
          true,
        );
      },
      playPresentation: (characterId, presentationId) => {
        this.widget.playPresentation(characterId, presentationId);
      },
      onFulfillmentFinished: request => {
        this.finishCharacterRequestFulfillment(request);
      },
    });
    this.relationshipTicker = new TownRelationshipTicker({
      widget: this.widget,
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.activityCoordinator = new TownActivityCoordinator({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      getCharacterContext: characterId => this.getCharacterSnapshot(characterId)?.context ?? null,
      getCharacterPosition: characterId => this.getCharacterPosition(characterId),
      getNearbyCharacterIds: (characterId, range) => this.getNearbyCharacterIds(characterId, range),
      getTravelTarget: (destination, characterId, index) => (
        index === 0
          ? destination
          : this.movementCoordinator.findNearbyEmptyTile(destination, characterId, 2) ?? destination
      ),
      actorHasItem: (characterId, itemId) => (
        itemService.getActorItems(characterId)
          .some(itemInstance => (
            itemInstance.definitionId === itemId &&
            (itemInstance.state === 'stored' || itemInstance.state === 'held')
          ))
      ),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      notifyActivitiesChanged: () => this.notifyJoinableActivitiesChanged(),
    });
    this.onCharacterSnapshot = options.onCharacterSnapshot;
    this.onRelationshipStoreChange = options.onRelationshipStoreChange;
    this.onJoinableActivitiesChange = options.onJoinableActivitiesChange;
    this.onGodDropOpportunityChange = options.onGodDropOpportunityChange;
    this.onCharacterRequestsChange = options.onCharacterRequestsChange;
  }

  start(): void {
    CHARACTER_SEEDS.forEach(character => {
      this.seedCharacterItems(character);
      this.spawnCharacterActor(character);
    });
    this.tickTimer = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  showMapDialoguePresentation(presentation: EventDialoguePresentation): (() => void) | undefined {
    if (presentation.activity) {
      this.widget.showMapActivity(presentation.activity);
    }

    if (!presentation.bubbleSequence) {
      return undefined;
    }

    return this.widget.playMapBubbleSequence(presentation.bubbleSequence, line => {
      if (line.expression) {
        this.setCharacterExpression(line.characterId, line.expression);
      }
    });
  }

  pickUpCharacter(characterId: string): void {
    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '對話中...');
      return;
    }

    this.activityCoordinator.handleCharacterPickedUp(characterId);

    this.sendToCharacter(characterId, { type: EventType.PickUp });
  }

  dropCharacter(characterId: string, tile: GridCoordinate | null): void {
    const actor = this.characterActors.get(characterId);

    if (!actor) {
      return;
    }

    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '等一下...');
      return;
    }

    if (tile && this.widget.moveCharacter(characterId, tile)) {
      this.sendToCharacter(characterId, { type: EventType.Drop, position: tile });
      this.deferCharacterDecision(characterId, GOD_DROP_DECISION_GRACE_MS);
      this.openGodDropOpportunity(characterId, tile);
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.Drop });
    this.clearGodDropOpportunity();
  }

  leaveApartment(characterId: string): void {
    this.leaveApartmentWithFollowUp(characterId);
  }

  syncRequestIndicators(zoom = this.widget.getZoom()): void {
    const indicators = getVisibleRequestIndicators({
      requests: this.characterRequestService.getRequests(),
      snapshots: this.getCharacterSnapshotsById(),
      zoom,
    });
    const nextCharacterIds = new Set(
      indicators
        .filter((indicator): indicator is RequestVisibilityIndicator & { anchor: { type: 'character'; characterId: string } } => indicator.anchor.type === 'character')
        .map(indicator => indicator.anchor.characterId),
    );
    const nextSpaceMarkerIds = new Set(
      indicators
        .filter(indicator => indicator.anchor.type === 'space')
        .map(indicator => indicator.id),
    );

    this.activeRequestIndicatorCharacterIds.forEach(characterId => {
      if (!nextCharacterIds.has(characterId)) {
        this.widget.updateCharacterRequestMarker(characterId, null);
      }
    });
    this.activeRequestIndicatorCharacterIds.clear();

    this.activeRequestMapMarkerIds.forEach(markerId => {
      if (!nextSpaceMarkerIds.has(markerId)) {
        this.widget.removeMapActivity(markerId);
      }
    });
    this.activeRequestMapMarkerIds.clear();

    indicators.forEach(indicator => {
      if (indicator.anchor.type === 'character') {
        this.widget.updateCharacterRequestMarker(indicator.anchor.characterId, {
          label: indicator.label,
          level: indicator.request.level,
        });
        this.activeRequestIndicatorCharacterIds.add(indicator.anchor.characterId);
        return;
      }

      this.widget.showMapActivity({
        id: indicator.id,
        label: indicator.label,
        tone: indicator.request.level,
        participantIds: [],
        anchorTile: this.getRequestSpaceMarkerTile(indicator.anchor.spaceId),
      }, null);
      this.activeRequestMapMarkerIds.add(indicator.id);
    });
  }

  chooseGodDropCandidate(candidateId: string): void {
    const opportunity = this.currentGodDropOpportunity;
    const candidate = opportunity?.candidates.find(item => item.id === candidateId);

    if (!opportunity || !candidate) {
      return;
    }

    this.executeGodDropCandidate(opportunity, candidate, 'player');
  }

  completeCharacterRequest(requestId: string): void {
    const request = this.characterRequestService.markRequestResolving(requestId);

    if (!request) {
      return;
    }

    this.startCharacterRequestFulfillment(request);
    this.notifyCharacterRequestsChanged();
  }

  markCharacterRequestItemReceived(input: CharacterRequestItemMatchInput): CharacterRequest | null {
    const result = this.characterRequestService.markMatchingItemRequestResolving(input);

    if (!result.request) {
      return null;
    }

    this.startCharacterRequestFulfillment(result.request, '收到了，謝謝你', input.itemDefinition);
    this.notifyCharacterRequestsChanged();
    return result.request;
  }

  setCharacterExpression(characterId: string, expression: Expression): void {
    this.sendToCharacter(characterId, {
      type: EventType.SetExpression,
      expression,
    });
  }

  dispose(): void {
    if (this.tickTimer !== null) {
      window.clearInterval(this.tickTimer);
      this.tickTimer = null;
    }

    this.movementCoordinator.dispose();
    this.relationshipMomentOverlayCoordinator.dispose();
    this.activityInterruptionMomentCoordinator.dispose();
    this.performanceRunner.dispose();
    itemHoldingService.clear();
    this.activityManager.clear();
    this.nextDecisionAtByCharacterId.clear();
    this.requestIdsByRelationshipOverlayId.clear();
    this.renderedHeldItemInstanceIdByCharacterId.clear();
    this.activityHeldItemsByCharacterId.clear();
    this.clearRequestIndicators();

    this.characterSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.characterSubscriptions.clear();

    this.characterActors.forEach(actor => {
      actor.stop();
    });
    this.characterActors.clear();

    this.relationshipStore = createRelationshipStore();
    this.onRelationshipStoreChange?.(this.relationshipStore);
    this.clearGodDropOpportunity();
    this.characterRequestService.clear();
    this.notifyCharacterRequestsChanged();
    this.notifyJoinableActivitiesChanged();
  }

  private openGodDropOpportunity(characterId: string, droppedAt: GridCoordinate): void {
    const timestamp = Date.now();
    const nearbyCharacterIds = this.widget.getOccupiedNeighborIds(
      droppedAt.x,
      droppedAt.y,
      GOD_DROP_SCAN_RADIUS,
      characterId,
    );
    const opportunity = this.godDropOpportunityService.createOpportunity({
      actorId: characterId,
      droppedAt,
      timestamp,
      nearbyCharacterIds,
      nearbyObjects: this.widget.getMapObjectsInRadius(droppedAt.x, droppedAt.y, GOD_DROP_SCAN_RADIUS),
      nearbyActivities: this.activityManager.findNearbyActivities({
        position: droppedAt,
        timestamp,
        phases: ['forming', 'traveling', 'active'],
      }),
      isCharacterUnavailable: targetCharacterId => (
        this.isCharacterInBlockingMoment(targetCharacterId)
      ),
      getCharacterName: targetCharacterId => this.getCharacterName(targetCharacterId),
      getCharacterDistance: targetCharacterId => this.widget.getDistanceToCharacter(
        droppedAt.x,
        droppedAt.y,
        targetCharacterId,
      ),
      getRelationshipStatus: targetCharacterId => this.getMutualRelationshipStatus(characterId, targetCharacterId),
    });

    this.clearGodDropOpportunity();

    if (!opportunity) {
      return;
    }

    this.currentGodDropOpportunity = opportunity;
    this.onGodDropOpportunityChange?.(opportunity);
    this.widget.showCharacterBubble(characterId, this.getOpportunityBubbleText(opportunity), 1400);
    this.godDropAutoTimer = window.setTimeout(() => {
      this.autoChooseGodDropCandidate(opportunity.id);
    }, Math.max(0, opportunity.autoDecisionAt - timestamp));
    this.godDropExpireTimer = window.setTimeout(() => {
      if (this.currentGodDropOpportunity?.id === opportunity.id) {
        this.clearGodDropOpportunity();
      }
    }, Math.max(0, opportunity.expiresAt - timestamp));
  }

  private autoChooseGodDropCandidate(opportunityId: string): void {
    const opportunity = this.currentGodDropOpportunity;

    if (!opportunity || opportunity.id !== opportunityId) {
      return;
    }

    const candidate = this.godDropOpportunityService.selectCandidate(opportunity);

    if (!candidate) {
      this.clearGodDropOpportunity();
      return;
    }

    this.executeGodDropCandidate(opportunity, candidate, 'auto');
  }

  private executeGodDropCandidate(
    opportunity: GodDropOpportunity,
    candidate: GodDropOpportunityCandidate,
    source: 'auto' | 'player',
  ): void {
    this.clearGodDropOpportunity();

    if (candidate.kind === 'object') {
      this.widget.showCharacterBubble(
        opportunity.actorId,
        source === 'player' ? `我去看看${candidate.label.replace('看看', '')}` : candidate.label,
        2200,
      );
      this.widget.showCharacterEmote(opportunity.actorId, '!', 900);
      return;
    }

    if (candidate.branch === 'activityFocused' && candidate.activityId) {
      if (this.activityCoordinator.joinActivityByGodDrop(opportunity.actorId, candidate.activityId)) {
        this.widget.showCharacterBubble(opportunity.actorId, candidate.label, 1800);
      }
      return;
    }

    if (candidate.branch === 'relationshipFocused' && candidate.participantId) {
      this.playRelationshipMomentByGodDrop(opportunity.actorId, candidate.participantId, candidate.label);
    }
  }

  private playRelationshipMomentByGodDrop(
    actorId: string,
    targetCharacterId: string,
    label: string,
  ): void {
    if (
      this.relationshipMomentOverlayCoordinator.isCharacterInOverlay(actorId) ||
      this.relationshipMomentOverlayCoordinator.isCharacterInOverlay(targetCharacterId)
    ) {
      return;
    }

    const timestamp = Date.now();
    const targetActivity = this.getActivityByParticipant(targetCharacterId);
    const observerIds = targetActivity?.participantIds
      .filter(participantId => participantId !== targetCharacterId)
      ?? [];
    const relationshipStatus = this.getMutualRelationshipStatus(actorId, targetCharacterId);

    const overlay = this.relationshipMomentOverlayCoordinator.start({
      actorId,
      targetCharacterId,
      label,
      targetBubbleText: this.getRelationshipMomentTargetBubble(relationshipStatus),
      observerIds,
      sourceActivityId: targetActivity?.id,
      timestamp,
      durationMs: RELATIONSHIP_MOMENT_DURATION_MS,
    });

    if (!overlay) {
      return;
    }

    this.markSocialRequestResolving(overlay.id, actorId, targetCharacterId);
    this.deferCharactersDecision(
      [actorId, targetCharacterId],
      RELATIONSHIP_MOMENT_DURATION_MS + RELATIONSHIP_MOMENT_DECISION_GRACE_MS,
    );
    this.sendToCharacter(actorId, { type: EventType.PassBy, targetCharId: targetCharacterId, timestamp });
    this.sendToCharacter(targetCharacterId, { type: EventType.PassBy, targetCharId: actorId, timestamp });

    if (relationshipStatus === SocialStatus.Stranger) {
      this.relationshipStore = updateMutualRelationshipStatus(
        this.relationshipStore,
        actorId,
        targetCharacterId,
        SocialStatus.Acquaintance,
        timestamp,
      );
      this.onRelationshipStoreChange?.(this.relationshipStore);
    }
  }

  private markSocialRequestResolving(overlayId: string, actorId: string, targetCharacterId: string): void {
    const result = this.characterRequestService.markMatchingSocialRequestResolving({
      actorId,
      targetCharacterId,
    });

    if (!result.request) {
      return;
    }

    this.widget.showCharacterBubble(result.request.characterId, '就是這個！', 1200);
    this.requestIdsByRelationshipOverlayId.set(overlayId, result.request.id);
    this.notifyCharacterRequestsChanged();
  }

  private isCharacterInBlockingMoment(characterId: string): boolean {
    return this.relationshipMomentOverlayCoordinator.isCharacterInOverlay(characterId) ||
      this.activityInterruptionMomentCoordinator.isCharacterInMoment(characterId);
  }

  private handleRelationshipMomentFinished(overlay: RelationshipMomentOverlay): void {
    this.deferCharactersDecision(
      [overlay.actorId, overlay.targetCharacterId],
      RELATIONSHIP_MOMENT_DECISION_GRACE_MS,
    );

    const request = this.getRequestResolvedByRelationshipMoment(overlay);

    if (!request) {
      return;
    }

    this.startCharacterRequestFulfillment(request, '謝謝你幫我完成心願');
  }

  private startCharacterRequestFulfillment(
    request: CharacterRequest,
    rewardText?: string,
    fulfilledItemDefinition?: ItemDefinition,
  ): void {
    const participantIds = this.getRequestFulfillmentParticipantIds(request);
    const sourceActivityIds = this.getActivityIdsByParticipants(participantIds);
    const observerIds = this.getObserverIdsForActivities(sourceActivityIds, participantIds);
    const timestamp = Date.now();

    this.clearPendingActivityJoins(participantIds, timestamp);

    const fulfillment = this.requestFulfillmentCoordinator.start({
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
        Math.max(0, fulfillment.endsAt - Date.now()) + RELATIONSHIP_MOMENT_DECISION_GRACE_MS,
      );
      return;
    }

    this.finishCharacterRequestFulfillment(request);
  }

  private finishCharacterRequestFulfillment(request: CharacterRequest): void {
    const completedRequest = this.characterRequestService.completeRequest(request.id);

    if (!completedRequest) {
      return;
    }

    if (completedRequest.satisfiedEffects?.length) {
      this.sendToCharacter(completedRequest.characterId, {
        type: EventType.ApplyRequestEffects,
        requestEffects: completedRequest.satisfiedEffects,
      });
    }

    this.notifyCharacterRequestsChanged();
  }

  private getRequestResolvedByRelationshipMoment(overlay: RelationshipMomentOverlay): CharacterRequest | null {
    const requestId = this.requestIdsByRelationshipOverlayId.get(overlay.id);

    if (requestId) {
      this.requestIdsByRelationshipOverlayId.delete(overlay.id);
      return this.characterRequestService.getRequests()
        .find(candidate => candidate.id === requestId) ?? null;
    }

    const result = this.characterRequestService.markMatchingSocialRequestResolving({
      actorId: overlay.actorId,
      targetCharacterId: overlay.targetCharacterId,
    });

    if (!result.request) {
      return null;
    }

    this.notifyCharacterRequestsChanged();
    return result.request;
  }

  private deferCharactersDecision(characterIds: readonly string[], durationMs: number): void {
    const nextDecisionAt = Date.now() + durationMs;

    characterIds.forEach(characterId => {
      this.nextDecisionAtByCharacterId.set(characterId, nextDecisionAt);
    });
  }

  private deferCharacterDecision(characterId: string, durationMs: number): void {
    this.nextDecisionAtByCharacterId.set(characterId, Date.now() + durationMs);
  }

  private getActivityByParticipant(characterId: string): JoinableActivity | null {
    return this.activityManager.getActivities()
      .find(activity => activity.participantIds.includes(characterId)) ?? null;
  }

  private getRequestFulfillmentParticipantIds(request: CharacterRequest): string[] {
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
        this.activityManager.getActivity(activityId)?.participantIds ?? []
      )).filter(participantId => !participantIdSet.has(participantId)),
    );
  }

  private clearPendingActivityJoins(participantIds: readonly string[], timestamp: number): void {
    let didChangeActivity = false;

    participantIds.forEach(participantId => {
      const pendingActivityJoin = this.getCharacterSnapshot(participantId)?.context.pendingActivityJoin;

      if (!pendingActivityJoin) {
        return;
      }

      this.activityManager.leaveActivity(pendingActivityJoin.activityId, participantId);
      didChangeActivity = true;
      this.sendToCharacter(participantId, {
        type: EventType.EndJoinedActivity,
        activityId: pendingActivityJoin.activityId,
        timestamp,
      });
    });

    if (didChangeActivity) {
      this.notifyJoinableActivitiesChanged();
    }
  }

  private getRelationshipMomentTargetBubble(status: SocialStatus): string {
    if (status === SocialStatus.Stranger) {
      return '你好？';
    }

    if (status === SocialStatus.Lovers || status === SocialStatus.Married) {
      return '嗯，我在聽。';
    }

    return '怎麼了？';
  }

  private clearGodDropOpportunity(): void {
    if (this.godDropAutoTimer !== null) {
      window.clearTimeout(this.godDropAutoTimer);
      this.godDropAutoTimer = null;
    }

    if (this.godDropExpireTimer !== null) {
      window.clearTimeout(this.godDropExpireTimer);
      this.godDropExpireTimer = null;
    }

    if (!this.currentGodDropOpportunity) {
      return;
    }

    this.currentGodDropOpportunity = null;
    this.onGodDropOpportunityChange?.(null);
  }

  private getOpportunityBubbleText(opportunity: GodDropOpportunity): string {
    const topCandidate = opportunity.candidates[0];

    if (!topCandidate) {
      return '看看附近...';
    }

    return `${topCandidate.label}？`;
  }

  private seedCharacterItems(character: CharacterSeed): void {
    if (!('ownItems' in character) || !character.ownItems?.length) {
      return;
    }

    character.ownItems.forEach(seedItem => {
      const existingQuantity = itemService.getActorItems(character.id)
        .filter(itemInstance => itemInstance.definitionId === seedItem.definitionId)
        .reduce((totalQuantity, itemInstance) => totalQuantity + itemInstance.quantity, 0);

      if (existingQuantity >= seedItem.quantity) {
        return;
      }

      Array.from({ length: seedItem.quantity - existingQuantity }).forEach(() => {
        itemService.createItemInstance({
          definitionId: seedItem.definitionId,
          ownerActorId: character.id,
          quantity: 1,
          reason: 'system',
          day: 0,
          state: 'stored',
        });
      });
    });

    const heldSeedItem = character.ownItems.find(seedItem => (
      'state' in seedItem && seedItem.state === 'held'
    ));

    if (heldSeedItem) {
      itemHoldingService.holdItemForActor({
        actorId: character.id,
        definitionId: heldSeedItem.definitionId,
      });
    }
  }

  private getHeldItemForCharacter(characterId: string): CharacterHeldItem | null {
    const heldItemInstance = itemHoldingService.restoreHeldItemForActor(characterId);

    if (!heldItemInstance) {
      return null;
    }

    return {
      itemInstanceId: heldItemInstance.id,
      definitionId: heldItemInstance.definitionId,
    };
  }

  private syncCharacterHeldItemWithWidget(
    characterId: string,
    heldItem: CharacterHeldItem | null,
    force = false,
  ): void {
    const renderedHeldItemInstanceId = this.renderedHeldItemInstanceIdByCharacterId.get(characterId);

    if (!heldItem) {
      if (renderedHeldItemInstanceId || force) {
        this.renderedHeldItemInstanceIdByCharacterId.delete(characterId);
        this.widget.releaseHeldItem(characterId);
      }
      return;
    }

    if (!force && renderedHeldItemInstanceId === heldItem.itemInstanceId) {
      return;
    }

    const itemDefinition = itemService.getDefinition(heldItem.definitionId);

    if (!itemDefinition) {
      return;
    }

    this.widget.holdItem(characterId, itemDefinition);
    this.renderedHeldItemInstanceIdByCharacterId.set(characterId, heldItem.itemInstanceId);
  }

  private syncActivityHeldItem(characterId: string, snapshot: CharacterSnapshot): boolean {
    const requiredItemId = this.getRequiredActivityItemId(snapshot);
    const activityHeldItem = this.activityHeldItemsByCharacterId.get(characterId);

    if (!requiredItemId) {
      if (!activityHeldItem) {
        return false;
      }

      this.activityHeldItemsByCharacterId.delete(characterId);

      if (snapshot.context.heldItem?.itemInstanceId !== activityHeldItem.itemInstanceId) {
        return false;
      }

      this.releaseHeldItemForCharacter(characterId);
      return true;
    }

    if (snapshot.context.heldItem?.definitionId === requiredItemId) {
      return false;
    }

    const heldItem = this.holdItemForCharacter(characterId, requiredItemId);

    if (!heldItem) {
      return false;
    }

    this.activityHeldItemsByCharacterId.set(characterId, {
      itemInstanceId: heldItem.itemInstanceId,
    });
    return true;
  }

  private getRequiredActivityItemId(snapshot: CharacterSnapshot): ItemDefinitionId | null {
    const activityId = snapshot.context.currentActivity?.activityId;

    if (!activityId) {
      return null;
    }

    const activity = this.activityManager.getActivity(activityId);

    if (
      !activity ||
      activity.type !== 'playWithItem' ||
      activity.joinRequirements.type !== 'hasItem'
    ) {
      return null;
    }

    return activity.joinRequirements.itemId;
  }

  private holdItemForCharacter(
    characterId: string,
    definitionId: ItemDefinitionId,
  ): CharacterHeldItem | null {
    try {
      const itemInstance = itemHoldingService.holdItemForActor({
        actorId: characterId,
        definitionId,
      });
      const heldItem = {
        itemInstanceId: itemInstance.id,
        definitionId: itemInstance.definitionId,
      };

      this.sendToCharacter(characterId, {
        type: EventType.HoldItem,
        itemInstanceId: heldItem.itemInstanceId,
        definitionId: heldItem.definitionId,
      });
      this.syncCharacterHeldItemWithWidget(characterId, heldItem, true);
      return heldItem;
    } catch {
      return null;
    }
  }

  private releaseHeldItemForCharacter(characterId: string): void {
    itemHoldingService.releaseHeldItemForActor(characterId);
    this.sendToCharacter(characterId, { type: EventType.ReleaseHeldItem });
    this.syncCharacterHeldItemWithWidget(characterId, null, true);
  }

  private getAvailableActorItemDefinitionIds(characterId: string): string[] {
    return itemService.getActorItems(characterId)
      .filter(itemInstance => itemInstance.state === 'stored' || itemInstance.state === 'held')
      .map(itemInstance => itemInstance.definitionId);
  }

  private spawnCharacterActor(character: CharacterSeed, previousActor?: CharacterActor): CharacterActor {
    this.characterSubscriptions.get(character.id)?.unsubscribe();

    const previousContext = previousActor?.getSnapshot().context;
    const now = Date.now();

    if (!this.nextDecisionAtByCharacterId.has(character.id)) {
      this.nextDecisionAtByCharacterId.set(character.id, now + randomBetween(
        INITIAL_DECISION_STAGGER_MIN_MS,
        INITIAL_DECISION_STAGGER_MAX_MS,
      ));
    }

    this.movementCoordinator.placeCharacter(character.id, character, previousContext);

    const actor = createActor(characterMachine, {
      input: {
        id: character.id,
        name: character.name,
        position: previousContext?.position ?? character.position,
        ownItems: previousContext?.ownItems ?? ('ownItems' in character ? character.ownItems : undefined),
        saturation: previousContext?.status.saturation ?? character.saturation,
        relationships: previousContext?.relationships,
        heldItem: previousContext?.heldItem ?? this.getHeldItemForCharacter(character.id),
      },
    });

    this.characterActors.set(character.id, actor);

    const subscription = actor.subscribe(snapshot => {
      this.onCharacterSnapshot?.(character.id, snapshot);
      this.movementCoordinator.syncCharacterWithWidget(character.id, snapshot);
      this.activityCoordinator.handleCurrentActivity(character.id, snapshot);
      this.activityCoordinator.handlePendingActivityJoin(character.id, snapshot);
      this.activityCoordinator.handleActivityTravelProgress(character.id, snapshot);
      const didSyncActivityHeldItem = this.syncActivityHeldItem(character.id, snapshot);
      if (!didSyncActivityHeldItem) {
        this.syncCharacterHeldItemWithWidget(character.id, snapshot.context.heldItem);
      }
      this.syncRequestIndicators();
    });

    actor.start();
    this.characterSubscriptions.set(character.id, subscription);
    return actor;
  }

  private tick(): void {
    const timestamp = Date.now();

    CHARACTER_SEEDS.forEach(character => {
      const actor = this.characterActors.get(character.id);

      if (!actor || actor.getSnapshot().status !== 'active') {
        this.spawnCharacterActor(character, actor);
      }

      const allowAutonomousDecision = this.canCharacterDecideNow(character.id, timestamp);
      const didLeaveApartment = allowAutonomousDecision && this.maybeLeaveApartmentForOutsideNeed(character.id);
      const nearbyCharacterIds = this.getNearbyCharacterIds(character.id, 2);

      this.sendToCharacter(character.id, {
        type: EventType.Tick,
        nearbyCharacterIds,
        nearbyRelationships: this.getNearbyRelationshipSnapshots(character.id, nearbyCharacterIds),
        nearbyJoinableActivities: this.activityCoordinator.getNearbyJoinableActivities(character.id, timestamp),
        ownItemIds: this.getAvailableActorItemDefinitionIds(character.id),
        timestamp,
        allowAutonomousDecision: allowAutonomousDecision && !didLeaveApartment,
      });
      this.tickCharacterRequest(character.id, nearbyCharacterIds, timestamp);
    });

    this.relationshipStore = this.relationshipTicker.triggerPassByRelationships(
      this.characterActors,
      this.relationshipStore,
      timestamp,
    );
    this.onRelationshipStoreChange?.(this.relationshipStore);
    this.activityCoordinator.pruneEndedActivities(timestamp);
  }

  private tickCharacterRequest(
    characterId: string,
    nearbyCharacterIds: readonly string[],
    timestamp: number,
  ): void {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot) {
      return;
    }

    const result = this.characterRequestService.tickCharacter({
      context: snapshot.context,
      nearbyCharacterIds: [...nearbyCharacterIds],
      nearbyRelationships: this.getNearbyRelationshipSnapshots(characterId, nearbyCharacterIds),
      relationshipTargets: this.getCharacterRequestRelationshipTargets(characterId),
      nearbyJoinableActivities: this.activityCoordinator.getNearbyJoinableActivities(characterId, timestamp),
      timestamp,
    });

    if (result.didChange) {
      this.notifyCharacterRequestsChanged();
    }
  }

  private canCharacterDecideNow(characterId: string, timestamp: number): boolean {
    const nextDecisionAt = this.nextDecisionAtByCharacterId.get(characterId) ?? timestamp;

    if (timestamp < nextDecisionAt) {
      return false;
    }

    this.nextDecisionAtByCharacterId.set(characterId, timestamp + randomBetween(
      DECISION_INTERVAL_MIN_MS,
      DECISION_INTERVAL_MAX_MS,
    ));
    return true;
  }

  private getCharacterName(characterId: string): string {
    return this.getCharacterSnapshot(characterId)?.context.name ?? characterId;
  }

  private getCharacterSnapshot(characterId: string): CharacterSnapshot | null {
    return this.characterActors.get(characterId)?.getSnapshot() ?? null;
  }

  private getCharacterSnapshotsById(): Record<string, CharacterSnapshot> {
    return Object.fromEntries(
      Array.from(this.characterActors.entries())
        .map(([characterId, actor]) => [characterId, actor.getSnapshot()]),
    );
  }

  private maybeLeaveApartmentForOutsideNeed(characterId: string): boolean {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot || snapshot.context.presence.kind !== 'contained') {
      return false;
    }

    const utilityScores = calculateCharacterUtilityScores(snapshot.context);
    const isHungry = (
      snapshot.context.status.saturation <= snapshot.context.status.hungerThreshold ||
      utilityScores.findFood >= APARTMENT_EXIT_FOOD_SCORE_THRESHOLD
    );

    if (!isHungry) {
      return utilityScores.play >= APARTMENT_EXIT_PLAY_SCORE_THRESHOLD
        ? this.leaveApartmentWithFollowUp(characterId, { type: EventType.GoPlay })
        : false;
    }

    return this.leaveApartmentWithFollowUp(characterId, {
      type: EventType.GoEat,
      target: getRandomDestinationTarget('findFood') ?? { x: 1, y: 20 },
    });
  }

  private leaveApartmentWithFollowUp(characterId: string, followUpEvent?: CharacterEvent): boolean {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot || snapshot.context.presence.kind !== 'contained') {
      return false;
    }

    const entrancePosition = this.getAvailableApartmentEntrancePosition();

    if (!entrancePosition) {
      return false;
    }

    const didLeave = this.sendToCharacter(characterId, {
      type: EventType.LeaveApartment,
      worldSpaceId: TOWN_WORLD_SPACE_ID,
      position: entrancePosition,
    });

    if (!didLeave) {
      return false;
    }

    if (followUpEvent) {
      this.sendToCharacter(characterId, followUpEvent);
    }

    return true;
  }

  private getAvailableApartmentEntrancePosition(): Position | null {
    const candidates = TOWN_APARTMENT_ENTRANCE_TILES.filter(tile => {
      const cell = this.widget.getCell(tile.x, tile.y);
      return cell?.walkable && !cell.occupantId;
    });

    if (candidates.length === 0) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { x: chosen.x, y: chosen.y };
  }

  private getNearbyCharacterIds(characterId: string, range: number): string[] {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return [];
    }

    return this.widget.getOccupiedNeighborIds(tile.x, tile.y, range, characterId);
  }

  private getCharacterPosition(characterId: string): Position | null {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return null;
    }

    return { x: tile.x, y: tile.y };
  }

  private notifyJoinableActivitiesChanged(): void {
    this.onJoinableActivitiesChange?.(this.activityManager.getActivities());
  }

  private notifyCharacterRequestsChanged(): void {
    this.onCharacterRequestsChange?.(this.characterRequestService.getRequests());
    this.syncRequestIndicators();
  }

  private getNearbyRelationshipSnapshots(
    characterId: string,
    nearbyCharacterIds: readonly string[],
  ): CharacterEventNearbyRelationship[] {
    const relationships = this.getCharacterSnapshot(characterId)?.context.relationships ?? [];

    return nearbyCharacterIds.map(targetCharacterId => {
      const relationship = relationships.find(entry => entry.targetCharId === targetCharacterId);
      const intimacy = relationship?.intimacy ?? 0;

      return {
        characterId: targetCharacterId,
        intimacy,
        feeling: relationship?.feeling ?? getFeelingForIntimacy(intimacy),
        socialStatus: this.getMutualRelationshipStatus(characterId, targetCharacterId),
      };
    });
  }

  private getCharacterRequestRelationshipTargets(characterId: string): CharacterRequestCharacterTarget[] {
    return CHARACTER_SEEDS
      .filter(character => character.id !== characterId)
      .map(character => ({
        characterId: character.id,
        characterName: character.name,
        socialStatus: this.getMutualRelationshipStatus(characterId, character.id),
      }));
  }

  private getMutualRelationshipStatus(characterId: string, targetCharacterId: string): SocialStatus {
    const pair = normalizeRelationshipPair(characterId, targetCharacterId);

    if (!pair) {
      return SocialStatus.Stranger;
    }

    return this.relationshipStore.mutualRelationships.find(relationship => (
      relationship.charIds[0] === pair[0] && relationship.charIds[1] === pair[1]
    ))?.status ?? SocialStatus.Stranger;
  }

  private sendToCharacter(characterId: string, event: CharacterEvent): boolean {
    const actor = this.characterActors.get(characterId);

    if (!actor || actor.getSnapshot().status !== 'active') {
      return false;
    }

    actor.send(event);
    return true;
  }

  private isCharacterBodyFrozen(characterId: string): boolean {
    const actor = this.characterActors.get(characterId);

    if (actor?.getSnapshot().status !== 'active') {
      return false;
    }

    const locks = actor.getSnapshot().context.locks;
    return locks.bodyAction.length > 0 || locks.bodyMove.length > 0;
  }

  private clearRequestIndicators(): void {
    this.activeRequestIndicatorCharacterIds.forEach(characterId => {
      this.widget.updateCharacterRequestMarker(characterId, null);
    });
    this.activeRequestIndicatorCharacterIds.clear();

    this.activeRequestMapMarkerIds.forEach(markerId => {
      this.widget.removeMapActivity(markerId);
    });
    this.activeRequestMapMarkerIds.clear();
  }

  private getRequestSpaceMarkerTile(spaceId: string): GridCoordinate | undefined {
    if (spaceId !== TOWN_APARTMENT_SPACE_ID) {
      return undefined;
    }

    const entranceTile = TOWN_APARTMENT_ENTRANCE_TILES[1] ?? TOWN_APARTMENT_ENTRANCE_TILES[0];

    return entranceTile ? { x: entranceTile.x, y: entranceTile.y } : undefined;
  }

}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function uniqueStrings(values: readonly string[]): string[] {
  return Array.from(new Set(values));
}
