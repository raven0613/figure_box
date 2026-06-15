import type { ExpressionPresetId, Position } from '~/constants/character';
import { getExpressionPresetDefinition } from '~/constants/expressionCatalog';
import {
  CharacterPerformanceRunner,
  type CharacterPerformanceDialogueRequest,
} from '~/services/characterEvents/characterPerformanceRunner';
import { getRandomDestinationTarget } from '~/services/characterEvents/targets';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import {
  createJoinableActivityManager,
  type JoinableActivity,
  type JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import {
  ActivityOutcomeResolver,
  type ResolveActivityOutcomeInput,
  type ResolvedActivityOutcome,
} from '~/services/characterEvents/activityOutcomeResolver';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { RelationshipStore } from '~/stateMachines/gameFlow/relationships';
import { TownActivityCoordinator } from '~/services/townActivityCoordinator';
import { TownMovementCoordinator } from '~/services/townMovementCoordinator';
import { TransientMomentCoordinator } from '~/services/transientMomentCoordinator';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import { GodDropCoordinator } from '~/services/godDropCoordinator';
import { CHARACTER_REQUEST_DEFINITIONS } from '~/services/characterRequests/characterRequestDefinitions';
import { CharacterRequestService } from '~/services/characterRequests/characterRequestService';
import { CharacterRequestFlowCoordinator } from '~/services/characterRequests/characterRequestFlowCoordinator';
import { CharacterRequestIndicatorPresenter } from '~/services/characterRequests/requestIndicatorPresenter';
import type {
  CharacterRequest,
  CharacterRequestItemMatchInput,
} from '~/services/characterRequests/types';
import { CharacterRequestFulfillmentCoordinator } from '~/services/characterRequests/requestFulfillmentCoordinator';
import type {
  CharacterSeed,
  CharacterSnapshot,
} from '~/services/townCharacterTypes';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';
import {
  TOWN_APARTMENT_ENTRANCE_TILES,
  TOWN_WORLD_SPACE_ID,
} from '~/constants/townMap';
import { itemService } from '~/services/items/itemService';
import { EventOccurrenceCoordinator } from '~/services/eventOccurrences/eventOccurrenceCoordinator';
import type { EventOccurrence } from '~/services/eventOccurrences/worldEventTypes';
import { TownSpatialQueryService } from '~/services/townSpatialQueryService';
import { CharacterActorRegistry } from '~/services/characterActorRegistry';
import { CharacterHeldItemCoordinator } from '~/services/characterHeldItemCoordinator';
import { RelationshipMomentFlowCoordinator } from '~/services/relationshipMomentFlowCoordinator';
import { TownRelationshipCoordinator } from '~/services/townRelationshipCoordinator';
import { TownCharacterTickCoordinator } from '~/services/townCharacterTickCoordinator';
import { TownSimWorldPauseCoordinator } from '~/services/townSimWorldPauseCoordinator';
import { characterRuntimeSaveService } from '~/services/save/characterRuntimeSaveService';
import { saveService } from '~/services/save/saveService';
import { offlineRuntimeSyncService } from '~/services/offlineSimulation/offlineRuntimeSyncService';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import { getSeedPlayableCharacters } from '~/services/playableCharacterService';
import { createDefaultCharacterPersonality } from '~/constants/characterPersonality';
import { GameSimWorldState } from '~/stateMachines/gameFlow/states';

export type { CharacterSnapshot } from '~/services/townCharacterTypes';

const RELATIONSHIP_MOMENT_DURATION_MS = 3000;
const RELATIONSHIP_MOMENT_DECISION_GRACE_MS = 1800;
const GOD_DROP_DECISION_GRACE_MS = 2600;
const OFFLINE_RUNTIME_SYNC_DECISION_GRACE_MS = 1800;
const DIALOGUE_EXPRESSION_BUBBLE_DURATION_MS = 1600;
const APARTMENT_EXIT_FOOD_SCORE_THRESHOLD = 65;
const APARTMENT_EXIT_PLAY_SCORE_THRESHOLD = 72;

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  characters?: readonly CharacterSeed[];
  initialRelationshipStore?: RelationshipStore;
  onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => void;
  onActivitySettled?: (activityId: string) => void;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  onGodDropOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;
  onCharacterRequestsChange?: (requests: readonly CharacterRequest[]) => void;
}

export class TownCharacterController {
  private readonly widget: FabricTownMapWidget;
  private readonly characters: readonly CharacterSeed[];
  private readonly actorRegistry: CharacterActorRegistry;
  private readonly performanceRunner: CharacterPerformanceRunner;
  private readonly activityManager: JoinableActivityManager;
  private readonly activityOutcomeResolver: ActivityOutcomeResolver;
  private readonly activityCoordinator: TownActivityCoordinator;
  private readonly movementCoordinator: TownMovementCoordinator;
  private readonly relationshipCoordinator: TownRelationshipCoordinator;
  private readonly transientMomentCoordinator: TransientMomentCoordinator;
  private readonly relationshipMomentFlowCoordinator: RelationshipMomentFlowCoordinator;
  private readonly requestFulfillmentCoordinator: CharacterRequestFulfillmentCoordinator;
  private readonly requestFlowCoordinator: CharacterRequestFlowCoordinator;
  private readonly eventOccurrenceCoordinator: EventOccurrenceCoordinator;
  private readonly requestIndicatorPresenter: CharacterRequestIndicatorPresenter;
  private readonly spatialQueries: TownSpatialQueryService;
  private readonly godDropCoordinator: GodDropCoordinator;
  private readonly heldItemCoordinator: CharacterHeldItemCoordinator;
  private readonly tickCoordinator: TownCharacterTickCoordinator;
  private readonly simWorldPauseCoordinator: TownSimWorldPauseCoordinator;
  private readonly characterRequestService = new CharacterRequestService({
    definitions: CHARACTER_REQUEST_DEFINITIONS,
  });
  private readonly onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => void;
  private readonly onActivitySettled?: (activityId: string) => void;
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  private readonly onCharacterRequestsChange?: (requests: readonly CharacterRequest[]) => void;
  private readonly unregisterOfflineRuntimeSync: () => void;

  constructor(options: TownCharacterControllerOptions) {
    this.widget = options.widget;
    this.characters = options.characters ?? getSeedPlayableCharacters();
    this.onDialogueRequest = options.onDialogueRequest;
    this.onActivitySettled = options.onActivitySettled;
    this.spatialQueries = new TownSpatialQueryService({
      widget: this.widget,
      characterIds: this.characters.map(character => character.id),
    });
    this.requestIndicatorPresenter = new CharacterRequestIndicatorPresenter({
      widget: this.widget,
    });
    this.actorRegistry = new CharacterActorRegistry({
      onSnapshot: (characterId, snapshot) => this.handleCharacterSnapshot(characterId, snapshot),
    });
    this.relationshipCoordinator = new TownRelationshipCoordinator({
      widget: this.widget,
      characterSeeds: this.characters,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      initialRelationshipStore: options.initialRelationshipStore,
      onRelationshipStoreChange: options.onRelationshipStoreChange,
    });
    this.activityManager = createJoinableActivityManager();
    this.activityOutcomeResolver = new ActivityOutcomeResolver({
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.heldItemCoordinator = new CharacterHeldItemCoordinator({
      widget: this.widget,
      getActivityById: activityId => this.activityManager.getActivity(activityId) ?? null,
      getCurrentHeldItem: characterId => this.getCharacterSnapshot(characterId)?.context.heldItem ?? null,
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.performanceRunner = new CharacterPerformanceRunner({
      getCharacterName: characterId => this.getCharacterName(characterId),
      setCharacterExpressionPreset: (characterId, expressionPresetId) => {
        this.setCharacterExpressionPreset(characterId, expressionPresetId);
      },
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      removeCharacterBubble: characterId => {
        this.widget.removeCharacterBubble(characterId);
      },
      showCharacterExpressionBubble: (characterId, expressionBubbleId, durationMs) => {
        this.widget.showCharacterExpressionBubble(characterId, expressionBubbleId, durationMs);
      },
      removeCharacterExpressionBubble: characterId => {
        this.widget.removeCharacterExpressionBubble(characterId);
      },
      showMapActivity: (activity, durationMs) => {
        this.widget.showMapActivity(activity, durationMs);
      },
      removeMapActivity: activityId => {
        this.widget.removeMapActivity(activityId);
      },
      playCharacterAnimation: (characterId, animationId, durationMs) => {
        this.widget.playCharacterAnimation(characterId, animationId, durationMs);
      },
      cancelCharacterAnimation: characterId => {
        this.widget.cancelCharacterAnimation(characterId);
      },
      playDialogue: request => {
        this.onDialogueRequest?.(request);
      },
      rollActivity: request => {
        this.activityCoordinator.resolveActivityRoll(request);
      },
    });
    this.movementCoordinator = new TownMovementCoordinator({
      widget: this.widget,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.transientMomentCoordinator = new TransientMomentCoordinator({
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      showMapActivity: (activity, durationMs) => {
        this.widget.showMapActivity(activity, durationMs);
      },
      pauseActivity: (activityId, timestamp) => {
        this.activityManager.pauseActivity(activityId, timestamp);
        this.notifyJoinableActivitiesChanged();
      },
      resumeActivity: (activityId, timestamp) => {
        this.activityManager.resumeActivity(activityId, timestamp);
        this.notifyJoinableActivitiesChanged();
      },
      playPerformance: ({ characterId, performanceId }) => (
        this.performanceRunner.playPerformanceStepsById({
          performanceId,
          phase: 'active',
          initiatorId: characterId,
        })
      ),
      restoreActiveVisualsForCharacters: characterIds => {
        this.activityCoordinator.replayActiveVisualsForCharacters(characterIds);
      },
      pauseCharacterWalk: (characterId, durationMs) => {
        this.movementCoordinator.pauseCharacterWalk(characterId, durationMs);
      },
      resumeCharacterWalk: characterId => {
        this.movementCoordinator.resumeCharacterWalk(characterId);
      },
    });
    this.relationshipMomentFlowCoordinator = new RelationshipMomentFlowCoordinator({
      momentCoordinator: this.transientMomentCoordinator,
      getActivityByParticipant: characterId => this.getRelationshipMomentActivityByParticipant(characterId),
      getActivityParticipantIds: activityId => this.getActivityParticipantIds(activityId),
      getRelationshipStatus: (actorId, targetCharacterId) => (
        this.relationshipCoordinator.getMutualRelationshipStatus(actorId, targetCharacterId)
      ),
      promoteStrangerRelationship: (actorId, targetCharacterId, timestamp) => {
        this.relationshipCoordinator.promoteStrangerRelationship(actorId, targetCharacterId, timestamp);
      },
      markSocialRequestResolving: input => {
        this.requestFlowCoordinator.markSocialRequestResolving(input);
      },
      finishRelationshipMomentRequest: (input, rewardText) => (
        this.requestFlowCoordinator.finishRelationshipMoment(input, rewardText)
      ),
      captureResumeTargets: characterIds => this.captureResumeTargets(characterIds),
      resumeTargets: resumeTargets => this.resumeTargets(resumeTargets),
      deferCharactersDecision: (characterIds, durationMs) => {
        this.tickCoordinator.deferCharactersDecision(characterIds, durationMs);
      },
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      durationMs: RELATIONSHIP_MOMENT_DURATION_MS,
      decisionGraceMs: RELATIONSHIP_MOMENT_DECISION_GRACE_MS,
    });
    this.requestFulfillmentCoordinator = new CharacterRequestFulfillmentCoordinator({
      momentCoordinator: this.transientMomentCoordinator,
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      holdItem: (characterId, itemDefinition) => {
        this.heldItemCoordinator.showTemporaryHeldItem(characterId, itemDefinition);
      },
      releaseHeldItem: characterId => {
        this.heldItemCoordinator.releaseTemporaryHeldItem(characterId);
      },
      onFulfillmentFinished: request => {
        this.requestFlowCoordinator.finishFulfillment(request);
      },
    });
    this.requestFlowCoordinator = new CharacterRequestFlowCoordinator({
      requestService: this.characterRequestService,
      fulfillmentCoordinator: this.requestFulfillmentCoordinator,
      getActivityByParticipant: characterId => this.getActivityByParticipant(characterId),
      getActivityById: activityId => this.activityManager.getActivity(activityId) ?? null,
      getCharacterContext: characterId => this.getCharacterSnapshot(characterId)?.context ?? null,
      leaveActivity: (activityId, characterId) => {
        this.activityManager.leaveActivity(activityId, characterId);
      },
      captureResumeTargets: characterIds => this.captureResumeTargets(characterIds),
      resumeTargets: resumeTargets => this.resumeTargets(resumeTargets),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      deferCharactersDecision: (characterIds, durationMs) => {
        this.tickCoordinator.deferCharactersDecision(characterIds, durationMs);
      },
      notifyActivitiesChanged: () => this.notifyJoinableActivitiesChanged(),
      notifyRequestsChanged: () => this.notifyCharacterRequestsChanged(),
      decisionGraceMs: RELATIONSHIP_MOMENT_DECISION_GRACE_MS,
    });
    this.eventOccurrenceCoordinator = new EventOccurrenceCoordinator({
      getCharacterIdsNearPosition: (position, radius) => (
        this.spatialQueries.getCharacterIdsNearPosition(position, radius)
      ),
      playTransientPerformance: input => {
        this.transientMomentCoordinator.start({
          id: `event-occurrence-${input.eventId}-${input.characterId}-${input.timestamp}`,
          participantIds: [input.characterId],
          timestamp: input.timestamp,
          durationMs: 0,
          performanceId: input.performanceId,
        });
      },
    });
    this.activityCoordinator = new TownActivityCoordinator({
      activityManager: this.activityManager,
      performanceRunner: this.performanceRunner,
      getCharacterContext: characterId => this.getCharacterSnapshot(characterId)?.context ?? null,
      getCharacterName: characterId => this.getCharacterName(characterId),
      getCharacterPersonality: characterId => (
        this.characters.find(character => character.id === characterId)?.personality
        ?? createDefaultCharacterPersonality()
      ),
      getCharacterPosition: characterId => this.spatialQueries.getCharacterPosition(characterId),
      getRelationshipStatus: (characterId, targetCharacterId) => (
        this.relationshipCoordinator.getMutualRelationshipStatus(characterId, targetCharacterId)
      ),
      getNearbyCharacterIds: (characterId, range) => this.spatialQueries.getNearbyCharacterIds(characterId, range),
      getTravelTarget: destination => destination,
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
      resolveActivityOutcome: input => this.resolveActivityOutcome(input),
      notifyActivitiesChanged: () => this.notifyJoinableActivitiesChanged(),
    });
    this.godDropCoordinator = new GodDropCoordinator({
      getNearbyCharacterIds: (position, radius, excludedCharacterId) => (
        this.widget.getOccupiedNeighborIds(position.x, position.y, radius, excludedCharacterId)
      ),
      getNearbyObjects: (position, radius) => (
        this.widget.getMapObjectsInRadius(position.x, position.y, radius)
      ),
      getNearbyActivities: (position, timestamp) => (
        this.activityManager.findNearbyActivities({
          position,
          timestamp,
          phases: ['forming', 'traveling', 'active'],
        })
      ),
      isCharacterUnavailable: characterId => this.isCharacterInBlockingMoment(characterId),
      getCharacterName: characterId => this.getCharacterName(characterId),
      getCharacterDistance: (position, characterId) => (
        this.widget.getDistanceToCharacter(position.x, position.y, characterId)
      ),
      getRelationshipStatus: (actorId, targetCharacterId) => (
        this.relationshipCoordinator.getMutualRelationshipStatus(actorId, targetCharacterId)
      ),
      joinActivity: (characterId, activityId) => (
        this.activityCoordinator.joinActivityByGodDrop(characterId, activityId)
      ),
      playRelationshipMoment: (actorId, targetCharacterId, label) => {
        this.relationshipMomentFlowCoordinator.startByGodDrop({
          actorId,
          targetCharacterId,
          label,
        });
      },
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
      showCharacterExpressionBubble: (characterId, expressionBubbleId, durationMs) => {
        this.widget.showCharacterExpressionBubble(characterId, expressionBubbleId, durationMs);
      },
      onOpportunityChange: options.onGodDropOpportunityChange,
    });
    this.tickCoordinator = new TownCharacterTickCoordinator({
      characterSeeds: this.characters,
      requestService: this.characterRequestService,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      isCharacterActive: characterId => this.actorRegistry.isActive(characterId),
      spawnCharacterActor: character => this.spawnCharacterActor(character),
      maybeLeaveApartmentForOutsideNeed: characterId => this.maybeLeaveApartmentForOutsideNeed(characterId),
      getNearbyCharacterIds: (characterId, range) => this.spatialQueries.getNearbyCharacterIds(characterId, range),
      getNearbyVisibleItems: (characterId, radius) => this.spatialQueries.getNearbyVisibleItems(characterId, radius),
      getNearbyRelationships: (characterId, nearbyCharacterIds) => (
        this.relationshipCoordinator.getNearbyRelationshipSnapshots(characterId, nearbyCharacterIds)
      ),
      getNearbyJoinableActivities: (characterId, timestamp) => (
        this.activityCoordinator.getNearbyJoinableActivities(characterId, timestamp)
      ),
      getAvailableActorItemDefinitionIds: characterId => this.getAvailableActorItemDefinitionIds(characterId),
      getRelationshipTargets: characterId => (
        this.relationshipCoordinator.getCharacterRequestRelationshipTargets(characterId)
      ),
      getCharacterActors: () => this.actorRegistry.getActors(),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      tickPassByRelationships: (characterActors, timestamp) => {
        this.relationshipCoordinator.tickPassByRelationships(characterActors, timestamp);
      },
      pruneEndedActivities: timestamp => {
        this.activityCoordinator.pruneEndedActivities(timestamp);
      },
      notifyRequestsChanged: () => this.notifyCharacterRequestsChanged(),
    });
    this.simWorldPauseCoordinator = new TownSimWorldPauseCoordinator({
      activityManager: this.activityManager,
      tickCoordinator: this.tickCoordinator,
      movementCoordinator: this.movementCoordinator,
      activityCoordinator: this.activityCoordinator,
      performanceRunner: this.performanceRunner,
      transientMomentCoordinator: this.transientMomentCoordinator,
      widget: this.widget,
      notifyActivitiesChanged: () => this.notifyJoinableActivitiesChanged(),
    });
    this.onCharacterSnapshot = options.onCharacterSnapshot;
    this.onJoinableActivitiesChange = options.onJoinableActivitiesChange;
    this.onCharacterRequestsChange = options.onCharacterRequestsChange;
    this.unregisterOfflineRuntimeSync = offlineRuntimeSyncService.registerApplier(
      snapshots => this.applyOfflineRuntimeSnapshots(snapshots),
    );
  }

  start(): void {
    this.characters.forEach(character => {
      this.seedCharacterItems(character);
    });
    this.tickCoordinator.start();
  }

  setSimWorldState(state: GameSimWorldState, observedActivityId: string | null): void {
    if (state !== GameSimWorldState.Running) {
      this.godDropCoordinator.clear();
    }

    this.simWorldPauseCoordinator.syncState(state, observedActivityId);
  }

  showMapDialoguePresentation(presentation: EventDialoguePresentation): (() => void) | undefined {
    if (presentation.activity) {
      this.widget.showMapActivity(presentation.activity);
    }

    if (!presentation.bubbleSequence) {
      return undefined;
    }

    const expressionBubbleDurationMs = presentation.bubbleSequence.bubbleDurationMs;

    return this.widget.playMapBubbleSequence(presentation.bubbleSequence, line => {
      if (line.expressionPresetId) {
        this.setCharacterExpressionPreset(line.characterId, line.expressionPresetId);
        this.showExpressionBubbleForExpressionPreset(
          line.characterId,
          line.expressionPresetId,
          expressionBubbleDurationMs,
        );
      }
    });
  }

  showExpressionBubbleForExpressionPreset(
    characterId: string,
    expressionPresetId: ExpressionPresetId,
    durationMs = DIALOGUE_EXPRESSION_BUBBLE_DURATION_MS,
  ): void {
    const expressionBubbleId = getExpressionPresetDefinition(
      expressionPresetId,
    ).mini.expressionBubbleId;

    if (!expressionBubbleId) {
      return;
    }

    this.widget.showCharacterExpressionBubble(characterId, expressionBubbleId, durationMs);
  }

  pickUpCharacter(characterId: string): boolean {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return false;
    }

    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '對話中...');
      return false;
    }

    this.activityCoordinator.handleCharacterPickedUp(characterId);

    if (!this.sendToCharacter(characterId, { type: EventType.PickUp })) {
      return false;
    }

    return this.actorRegistry.getSnapshot(characterId)?.context.currentMotivation === 'controllingByGod';
  }

  dropCharacter(characterId: string, tile: GridCoordinate | null): void {
    if (!this.actorRegistry.getActor(characterId)) {
      return;
    }

    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '等一下...');
      return;
    }

    if (tile && this.widget.moveCharacter(characterId, tile)) {
      this.sendToCharacter(characterId, { type: EventType.Drop, position: tile });
      this.tickCoordinator.deferCharacterDecision(characterId, GOD_DROP_DECISION_GRACE_MS);
      this.godDropCoordinator.open({
        actorId: characterId,
        droppedAt: tile,
      });
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.Drop });
    this.godDropCoordinator.clear();
  }

  leaveApartment(characterId: string): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    this.leaveApartmentWithFollowUp(characterId);
  }

  syncRequestIndicators(zoom = this.widget.getZoom()): void {
    this.requestIndicatorPresenter.sync({
      requests: this.characterRequestService.getRequests(),
      snapshots: this.getCharacterSnapshotsById(),
      zoom,
    });
  }

  normalizeRomanceFeelings(): void {
    this.characters.forEach(character => {
      this.sendToCharacter(character.id, { type: EventType.NormalizeRomanceFeelings });
    });
  }

  observeActivity(activityId: string): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    const request = this.activityCoordinator.createActivityDialogueRequest(activityId);

    if (request) {
      this.onDialogueRequest?.(request);
    }
  }

  resolveActivityOutcome(input: ResolveActivityOutcomeInput): ResolvedActivityOutcome {
    const resolution = this.activityOutcomeResolver.resolveActivityOutcome(input);

    this.onActivitySettled?.(resolution.activityId);
    return resolution;
  }

  chooseGodDropCandidate(candidateId: string): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    this.godDropCoordinator.chooseCandidate(candidateId);
  }

  completeCharacterRequest(requestId: string): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    this.requestFlowCoordinator.completeRequest(requestId);
  }

  markCharacterRequestItemReceived(input: CharacterRequestItemMatchInput): CharacterRequest | null {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return null;
    }

    return this.requestFlowCoordinator.markItemReceived(input, '收到了，謝謝你', input.itemDefinition);
  }

  setCharacterExpressionPreset(characterId: string, expressionPresetId: ExpressionPresetId): void {
    this.sendToCharacter(characterId, {
      type: EventType.SetExpressionPreset,
      expressionPresetId,
    });
  }

  dispatchEventOccurrence(occurrence: EventOccurrence): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    this.eventOccurrenceCoordinator.dispatchEventOccurrence(occurrence);
  }

  dispose(): void {
    this.unregisterOfflineRuntimeSync();
    this.tickCoordinator.clear();
    this.simWorldPauseCoordinator.clear();

    this.movementCoordinator.dispose();
    this.relationshipMomentFlowCoordinator.dispose();
    this.transientMomentCoordinator.dispose();
    this.activityCoordinator.dispose();
    this.performanceRunner.dispose();
    this.heldItemCoordinator.clear();
    this.activityManager.clear();
    this.activityOutcomeResolver.clear();
    this.requestFlowCoordinator.clear();
    this.requestIndicatorPresenter.clear();
    this.actorRegistry.dispose();

    this.godDropCoordinator.dispose();
    this.characterRequestService.clear();
    this.notifyCharacterRequestsChanged();
    this.notifyJoinableActivitiesChanged();
  }

  private isCharacterInBlockingMoment(characterId: string): boolean {
    return this.relationshipMomentFlowCoordinator.isCharacterInMoment(characterId) ||
      this.transientMomentCoordinator.isCharacterInMoment(characterId);
  }

  private captureResumeTargets(participantIds: readonly string[]): Map<string, Position> {
    const resumeTargets = new Map<string, Position>();

    participantIds.forEach(participantId => {
      const context = this.getCharacterSnapshot(participantId)?.context;

      if (!context?.target || context.presence.kind !== 'positioned') {
        return;
      }

      resumeTargets.set(participantId, { ...context.target });
    });

    return resumeTargets;
  }

  private resumeTargets(resumeTargets: ReadonlyMap<string, Position>): void {
    resumeTargets.forEach((target, characterId) => {
      const context = this.getCharacterSnapshot(characterId)?.context;

      if (!context || context.presence.kind !== 'positioned') {
        return;
      }

      this.sendToCharacter(characterId, {
        type: EventType.MoveTo,
        target,
      });
    });
  }

  private getActivityByParticipant(characterId: string): JoinableActivity | null {
    return this.activityManager.getActivities()
      .find(activity => activity.participantIds.includes(characterId)) ?? null;
  }

  private getRelationshipMomentActivityByParticipant(characterId: string): JoinableActivity | null {
    const activityByParticipant = this.getActivityByParticipant(characterId);

    if (activityByParticipant) {
      return activityByParticipant;
    }

    const characterActivityId = this.getCharacterActivityId(characterId);

    if (!characterActivityId) {
      return null;
    }

    return this.activityManager.getActivity(characterActivityId);
  }

  private getActivityParticipantIds(activityId: string): string[] {
    const participantIds = new Set(this.activityManager.getActivity(activityId)?.participantIds ?? []);

    Object.entries(this.getCharacterSnapshotsById()).forEach(([characterId, snapshot]) => {
      if (this.getSnapshotActivityId(snapshot) === activityId) {
        participantIds.add(characterId);
      }
    });

    return Array.from(participantIds);
  }

  private getCharacterActivityId(characterId: string): string | null {
    const snapshot = this.getCharacterSnapshot(characterId);

    if (!snapshot) {
      return null;
    }

    return this.getSnapshotActivityId(snapshot);
  }

  private getSnapshotActivityId(snapshot: CharacterSnapshot): string | null {
    return snapshot.context.currentActivity?.activityId
      ?? snapshot.context.pendingActivityJoin?.activityId
      ?? null;
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
      this.heldItemCoordinator.holdStoredItemForCharacter(character.id, heldSeedItem.definitionId);
    }
  }

  private getAvailableActorItemDefinitionIds(characterId: string): string[] {
    return itemService.getActorItems(characterId)
      .filter(itemInstance => itemInstance.state === 'stored' || itemInstance.state === 'held')
      .map(itemInstance => itemInstance.definitionId);
  }

  private spawnCharacterActor(character: CharacterSeed): void {
    const previousContext = this.actorRegistry.getSnapshot(character.id)?.context;
    const savedRuntime = previousContext
      ? null
      : characterRuntimeSaveService.getRuntimeSnapshot(character.id);
    const runtime = previousContext ?? savedRuntime ?? undefined;

    if (runtime?.presence.kind === 'contained') {
      this.movementCoordinator.registerCharacterRenderData(character.id, character);
    } else {
      this.movementCoordinator.placeCharacter(character.id, character, runtime);
    }

    this.actorRegistry.spawn(character, {
      id: character.id,
      name: character.name,
      position: runtime?.position ?? character.position,
      ownItems: previousContext?.ownItems ?? ('ownItems' in character ? character.ownItems : undefined),
      saturation: runtime?.status.saturation ?? character.saturation,
      relationships: runtime?.relationships,
      heldItem: runtime?.heldItem ?? this.heldItemCoordinator.restoreHeldItemForCharacter(character.id),
      runtime,
    });
  }

  private applyOfflineRuntimeSnapshots(
    snapshots: readonly CharacterRuntimeSnapshot[],
  ): number {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return 0;
    }

    this.activityCoordinator.clearLiveActivitiesForOfflineApply();

    const syncedCharacterIds = snapshots.flatMap(snapshot => {
      const didSyncActor = this.sendToCharacter(snapshot.id, {
        type: EventType.ApplyOfflineRuntime,
        runtime: snapshot,
      });

      if (!didSyncActor) {
        return [];
      }

      this.movementCoordinator.applyRuntimeSnapshot(snapshot);
      this.tickCoordinator.deferCharacterDecision(
        snapshot.id,
        OFFLINE_RUNTIME_SYNC_DECISION_GRACE_MS,
      );

      return [snapshot.id];
    });

    this.syncRequestIndicators();
    return syncedCharacterIds.length;
  }

  private handleCharacterSnapshot(characterId: string, snapshot: CharacterSnapshot): void {
    if (characterRuntimeSaveService.captureSnapshot(snapshot)) {
      saveService.markDirty('characterRuntime');
    }

    this.onCharacterSnapshot?.(characterId, snapshot);
    this.movementCoordinator.syncCharacterWithWidget(characterId, snapshot);
    this.activityCoordinator.handleCurrentActivity(characterId, snapshot);
    this.activityCoordinator.handlePendingActivityJoin(characterId, snapshot);
    this.activityCoordinator.handleActivityTravelProgress(characterId, snapshot);
    this.heldItemCoordinator.syncSnapshot(characterId, snapshot);
    this.syncRequestIndicators();
  }

  private getCharacterName(characterId: string): string {
    return this.getCharacterSnapshot(characterId)?.context.name ?? characterId;
  }

  private getCharacterSnapshot(characterId: string): CharacterSnapshot | null {
    return this.actorRegistry.getSnapshot(characterId);
  }

  private getCharacterSnapshotsById(): Record<string, CharacterSnapshot> {
    return this.actorRegistry.getSnapshotsById();
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
      return cell?.walkable;
    });

    if (candidates.length === 0) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { x: chosen.x, y: chosen.y };
  }

  private notifyJoinableActivitiesChanged(): void {
    this.onJoinableActivitiesChange?.(this.activityManager.getActivities());
  }

  private notifyCharacterRequestsChanged(): void {
    this.onCharacterRequestsChange?.(this.characterRequestService.getRequests());
    this.syncRequestIndicators();
  }

  private sendToCharacter(characterId: string, event: CharacterEvent): boolean {
    return this.actorRegistry.send(characterId, event);
  }

  private isCharacterBodyFrozen(characterId: string): boolean {
    const snapshot = this.actorRegistry.getSnapshot(characterId);

    if (snapshot?.status !== 'active') {
      return false;
    }

    const locks = snapshot.context.locks;
    return locks.bodyAction.length > 0 || locks.bodyMove.length > 0;
  }

}
