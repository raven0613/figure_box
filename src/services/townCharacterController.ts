import type { ExpressionPresetId } from '~/constants/character';
import { OBSERVE_OBJECT_BEHAVIOR_ID } from '~/constants/characterBehaviorDefinitions';
import { getExpressionPresetDefinition } from '~/constants/expressionCatalog';
import {
  CharacterPerformanceRunner,
  type CharacterPerformanceDialogueRequest,
} from '~/services/characterEvents/characterPerformanceRunner';
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
import { itemService } from '~/services/items/itemService';
import { EventOccurrenceCoordinator } from '~/services/eventOccurrences/eventOccurrenceCoordinator';
import type { EventOccurrence } from '~/services/eventOccurrences/worldEventTypes';
import { TownSpatialQueryService } from '~/services/townSpatialQueryService';
import { CharacterActorRegistry } from '~/services/characterActorRegistry';
import { CharacterHeldItemCoordinator } from '~/services/characterHeldItemCoordinator';
import {
  interactionCardService,
  type InteractionCardUseIntent,
} from '~/services/interactionCards/interactionCardService';
import { RelationshipMomentFlowCoordinator } from '~/services/relationshipMomentFlowCoordinator';
import { TownRelationshipCoordinator } from '~/services/townRelationshipCoordinator';
import { TownCharacterTickCoordinator } from '~/services/townCharacterTickCoordinator';
import { TownSimWorldPauseCoordinator } from '~/services/townSimWorldPauseCoordinator';
import { offlineRuntimeSyncService } from '~/services/offlineSimulation/offlineRuntimeSyncService';
import { getSeedPlayableCharacters } from '~/services/playableCharacterService';
import { createDefaultCharacterPersonality } from '~/constants/characterPersonality';
import { GameSimWorldState } from '~/stateMachines/gameFlow/states';
import { TownCharacterActivityLookup } from '~/services/townCharacters/TownCharacterActivityLookup';
import { TownCharacterApartmentCoordinator } from '~/services/townCharacters/TownCharacterApartmentCoordinator';
import { TownCharacterResumeTargetService } from '~/services/townCharacters/TownCharacterResumeTargetService';
import { TownCharacterRuntimeCoordinator } from '~/services/townCharacters/TownCharacterRuntimeCoordinator';
import {
  DEFAULT_DIALOGUE_MAP_FOCUS,
  DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT,
  WALL_SLAM_MAP_PERFORMANCE,
} from '~/constants/mapPerformance';
import {
  getWallSlamDirectionVector,
  type WallSlamDirection,
} from '~/widgets/townMapCinematicLayer';
import type { TownMapCharacterSpriteDirection } from '~/widgets/townMapCharacterSpriteRenderer';

export type { CharacterSnapshot } from '~/services/townCharacterTypes';

export type InteractionCardUseFailureReason =
  | 'invalidSelection'
  | 'characterUnavailable'
  | 'initiatorPreparationFailed'
  | 'insufficientSpace'
  | 'targetMoveFailed'
  | 'activityStartFailed'
  | 'presentationFailed'
  | 'dialogueUnavailable';

export type InteractionCardUseResult =
  | { success: true }
  | {
    success: false;
    reason: InteractionCardUseFailureReason;
  };

const RELATIONSHIP_MOMENT_DURATION_MS = 3000;
const RELATIONSHIP_MOMENT_DECISION_GRACE_MS = 1800;
const GOD_DROP_DECISION_GRACE_MS = 3000;
const DIALOGUE_EXPRESSION_BUBBLE_DURATION_MS = 1600;
const WALL_SLAM_EVENT_ID = 'social.wallSlam';
const INTERACTION_CARD_TARGET_OFFSETS: readonly GridCoordinate[] = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
  { x: 1, y: 1 },
  { x: -1, y: 1 },
  { x: 1, y: -1 },
  { x: -1, y: -1 },
  { x: 0, y: 0 },
];
type WallSlamSideDirection = Extract<WallSlamDirection, 'east' | 'west'>;

const WALL_SLAM_LAYOUT_DIRECTIONS: readonly WallSlamSideDirection[] = [
  'east',
  'west',
];

interface WallSlamLayout {
  direction: WallSlamSideDirection;
  targetTile: GridCoordinate;
  wallTile: GridCoordinate;
  distanceFromCurrentTarget: number;
}

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  characters?: readonly CharacterSeed[];
  initialRelationshipStore?: RelationshipStore;
  onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => boolean;
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
  private readonly activityLookup: TownCharacterActivityLookup;
  private readonly apartmentCoordinator: TownCharacterApartmentCoordinator;
  private readonly resumeTargetService: TownCharacterResumeTargetService;
  private readonly runtimeCoordinator: TownCharacterRuntimeCoordinator;
  private readonly characterRequestService = new CharacterRequestService({
    definitions: CHARACTER_REQUEST_DEFINITIONS,
  });
  private readonly onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => boolean;
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
      onSnapshot: (characterId, snapshot) => {
        this.handleRuntimeCharacterSnapshot(characterId, snapshot);
      },
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
    this.activityLookup = new TownCharacterActivityLookup({
      activityManager: this.activityManager,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      getCharacterSnapshotsById: () => this.getCharacterSnapshotsById(),
    });
    this.resumeTargetService = new TownCharacterResumeTargetService({
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
    this.apartmentCoordinator = new TownCharacterApartmentCoordinator({
      widget: this.widget,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
    });
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
      getCharacterWayOfSaying: characterId => this.getCharacterWayOfSaying(characterId),
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
        this.openDialogueRequest(request);
      },
      rollActivity: request => {
        this.activityCoordinator.resolveActivityRoll(request);
      },
    });
    this.movementCoordinator = new TownMovementCoordinator({
      widget: this.widget,
      getCharacterSnapshot: characterId => this.getCharacterSnapshot(characterId),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      onActivityRouteCompleted: activityId => {
        this.activityCoordinator.handleActivityRouteCompleted(activityId);
      },
    });
    this.runtimeCoordinator = new TownCharacterRuntimeCoordinator({
      actorRegistry: this.actorRegistry,
      movementCoordinator: this.movementCoordinator,
      heldItemCoordinator: this.heldItemCoordinator,
      isSimWorldPaused: () => this.simWorldPauseCoordinator.isPaused(),
      clearLiveActivitiesForOfflineApply: () => {
        this.activityCoordinator.clearLiveActivitiesForOfflineApply();
      },
      handleCurrentActivity: (characterId, snapshot) => {
        this.activityCoordinator.handleCurrentActivity(characterId, snapshot);
      },
      handlePendingActivityJoin: (characterId, snapshot) => {
        this.activityCoordinator.handlePendingActivityJoin(characterId, snapshot);
      },
      handleActivityTravelProgress: (characterId, snapshot) => {
        this.activityCoordinator.handleActivityTravelProgress(characterId, snapshot);
      },
      deferCharacterDecision: (characterId, durationMs) => {
        this.tickCoordinator.deferCharacterDecision(characterId, durationMs);
      },
      syncRequestIndicators: () => this.syncRequestIndicators(),
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      onCharacterSnapshot: (characterId, snapshot) => {
        this.onCharacterSnapshot?.(characterId, snapshot);
      },
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
      getActivityByParticipant: characterId => (
        this.activityLookup.getRelationshipMomentActivityByParticipant(characterId)
      ),
      getActivityParticipantIds: activityId => this.activityLookup.getActivityParticipantIds(activityId),
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
      captureResumeTargets: characterIds => (
        this.resumeTargetService.captureResumeTargets(characterIds)
      ),
      resumeTargets: resumeTargets => {
        this.resumeTargetService.resumeTargets(resumeTargets);
      },
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
      getActivityByParticipant: characterId => this.activityLookup.getActivityByParticipant(characterId),
      getActivityById: activityId => this.activityManager.getActivity(activityId) ?? null,
      getCharacterContext: characterId => this.getCharacterSnapshot(characterId)?.context ?? null,
      leaveActivity: (activityId, characterId) => {
        this.activityManager.leaveActivity(activityId, characterId);
      },
      captureResumeTargets: characterIds => (
        this.resumeTargetService.captureResumeTargets(characterIds)
      ),
      resumeTargets: resumeTargets => {
        this.resumeTargetService.resumeTargets(resumeTargets);
      },
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
      getCharacterWayOfSaying: characterId => this.getCharacterWayOfSaying(characterId),
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
      startJoggingRoute: input => {
        this.movementCoordinator.startJoggingRoute(input);
      },
      startStrollTogetherRoute: input => {
        this.movementCoordinator.startStrollTogetherRoute(input);
      },
      startJoggingRace: activityId => {
        this.movementCoordinator.startJoggingRace(activityId);
      },
      finishJoggingRoute: activityId => {
        this.movementCoordinator.finishJoggingRoute(activityId);
      },
      cancelActivityRoute: (activityId, options) => {
        this.movementCoordinator.cancelActivityRoute(activityId, options);
      },
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
        this.spatialQueries.getNearbyObservableObjectsAtPosition(position, radius)
      ),
      getNearbyActivities: (actorId, position, timestamp) => (
        this.activityCoordinator.getNearbyJoinableActivitiesAtPosition(actorId, position, timestamp)
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
      startObjectObservation: (characterId, target) => (
        this.sendToCharacter(characterId, {
          type: EventType.StartBehavior,
          behaviorId: OBSERVE_OBJECT_BEHAVIOR_ID,
          target,
        })
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
      spawnCharacterActor: character => {
        this.runtimeCoordinator.spawnCharacterActor(character);
      },
      maybeLeaveApartment: characterId => (
        this.apartmentCoordinator.maybeLeaveApartment(characterId)
      ),
      getNearbyCharacterIds: (characterId, range) => this.spatialQueries.getNearbyCharacterIds(characterId, range),
      getNearbyCharacterDistances: (characterId, nearbyCharacterIds) => (
        this.spatialQueries.getNearbyCharacterDistances(characterId, nearbyCharacterIds)
      ),
      getNearbyVisibleItems: (characterId, radius) => this.spatialQueries.getNearbyVisibleItems(characterId, radius),
      getNearbyObservableObjects: (characterId, radius) => (
        this.spatialQueries.getNearbyObservableObjects(characterId, radius)
      ),
      getNearbyRelationships: (characterId, nearbyCharacterIds) => (
        this.relationshipCoordinator.getNearbyRelationshipSnapshots(characterId, nearbyCharacterIds)
      ),
      getNearbyJoinableActivities: (characterId, timestamp) => (
        this.activityCoordinator.getNearbyJoinableActivities(characterId, timestamp)
      ),
      getAvailableActorItemDefinitionIds: characterId => (
        this.runtimeCoordinator.getAvailableActorItemDefinitionIds(characterId)
      ),
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
      snapshots => this.runtimeCoordinator.applyOfflineRuntimeSnapshots(snapshots),
    );
  }

  start(): void {
    this.characters.forEach(character => {
      this.runtimeCoordinator.seedCharacterItems(character);
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

  private pullInteractionCardTargetNearInitiator(
    initiatorId: string,
    targetId: string,
    preferredDropTile?: GridCoordinate,
  ): boolean {
    const targetActor = this.actorRegistry.getActor(targetId);
    const initiatorTile = this.widget.getCharacterTile(initiatorId);

    if (!targetActor || !initiatorTile) {
      return false;
    }

    this.widget.cancelWalk(targetId);

    if (!this.sendToCharacter(targetId, { type: EventType.PickUp })) {
      return false;
    }

    const pickedUpSnapshot = this.actorRegistry.getSnapshot(targetId);

    if (pickedUpSnapshot?.context.currentMotivation !== 'controllingByGod') {
      return false;
    }

    const dropTile = preferredDropTile
      ? this.moveInteractionCardTargetToTile(targetId, preferredDropTile)
      : this.moveInteractionCardTargetToDropTile(targetId, initiatorTile);

    if (dropTile) {
      this.sendToCharacter(targetId, { type: EventType.Drop, position: dropTile });
      return true;
    }

    this.sendToCharacter(targetId, { type: EventType.Drop });
    return false;
  }

  private moveInteractionCardTargetToDropTile(
    targetId: string,
    initiatorTile: GridCoordinate,
  ): GridCoordinate | null {
    const candidateTiles = INTERACTION_CARD_TARGET_OFFSETS
      .map(offset => ({
        x: initiatorTile.x + offset.x,
        y: initiatorTile.y + offset.y,
      }))
      .filter(tile => this.widget.getCell(tile.x, tile.y)?.walkable === true);

    return candidateTiles.find(tile => this.widget.moveCharacter(targetId, tile)) ?? null;
  }

  private moveInteractionCardTargetToTile(
    targetId: string,
    targetTile: GridCoordinate,
  ): GridCoordinate | null {
    if (this.widget.getCell(targetTile.x, targetTile.y)?.walkable !== true) {
      return null;
    }

    return this.widget.moveCharacter(targetId, targetTile) ? targetTile : null;
  }

  private prepareInteractionCardInitiator(initiatorId: string): boolean {
    const snapshot = this.actorRegistry.getSnapshot(initiatorId);
    const tile = this.widget.getCharacterTile(initiatorId);

    if (!snapshot || !tile) {
      return false;
    }

    this.widget.cancelWalk(initiatorId);

    if (!this.sendToCharacter(initiatorId, { type: EventType.PickUp })) {
      return false;
    }

    const pickedUpSnapshot = this.actorRegistry.getSnapshot(initiatorId);

    if (pickedUpSnapshot?.context.currentMotivation !== 'controllingByGod') {
      return false;
    }

    this.sendToCharacter(initiatorId, { type: EventType.Drop, position: tile });
    return true;
  }

  leaveApartment(characterId: string): void {
    if (this.simWorldPauseCoordinator.isPaused()) {
      return;
    }

    this.apartmentCoordinator.leaveApartment(characterId);
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
      this.openDialogueRequest(request);
    }
  }

  async useInteractionCard(
    intent: InteractionCardUseIntent,
  ): Promise<InteractionCardUseResult> {
    const resolution = interactionCardService.resolveCardUse(intent);

    if (!resolution) {
      return {
        success: false,
        reason: 'invalidSelection',
      };
    }

    if (
      this.isCharacterBodyFrozen(resolution.initiatorId)
      || this.isCharacterBodyFrozen(resolution.targetId)
    ) {
      return {
        success: false,
        reason: 'characterUnavailable',
      };
    }

    const originalTargetTile = this.widget.getCharacterTile(resolution.targetId);

    if (!originalTargetTile) {
      return {
        success: false,
        reason: 'targetMoveFailed',
      };
    }

    const wallSlamLayout = resolution.eventId === WALL_SLAM_EVENT_ID
      ? this.resolveWallSlamLayout(resolution.initiatorId, resolution.targetId)
      : null;

    if (resolution.eventId === WALL_SLAM_EVENT_ID && !wallSlamLayout) {
      return {
        success: false,
        reason: 'insufficientSpace',
      };
    }

    this.activityCoordinator.handleCharactersPickedUp([
      resolution.initiatorId,
      resolution.targetId,
    ]);

    if (!this.prepareInteractionCardInitiator(resolution.initiatorId)) {
      return {
        success: false,
        reason: 'initiatorPreparationFailed',
      };
    }

    if (!this.pullInteractionCardTargetNearInitiator(
      resolution.initiatorId,
      resolution.targetId,
      wallSlamLayout?.targetTile,
    )) {
      return {
        success: false,
        reason: 'targetMoveFailed',
      };
    }

    const dialogueRequest = this.activityCoordinator.startInteractionCardActivity({
      eventId: resolution.eventId,
      initiatorId: resolution.initiatorId,
      targetId: resolution.targetId,
    });

    if (!dialogueRequest) {
      this.restoreInteractionCardTargetPosition(
        resolution.targetId,
        originalTargetTile,
      );
      return {
        success: false,
        reason: 'activityStartFailed',
      };
    }

    if (wallSlamLayout) {
      const useResult = await this.openWallSlamDialogue(
        resolution.initiatorId,
        resolution.targetId,
        wallSlamLayout,
        dialogueRequest,
      );

      if (!useResult.success) {
        this.restoreInteractionCardTargetPosition(
          resolution.targetId,
          originalTargetTile,
        );
      }

      return useResult;
    }

    if (!this.onDialogueRequest) {
      await this.cancelFailedDialogueRequest(dialogueRequest);
      this.restoreInteractionCardTargetPosition(
        resolution.targetId,
        originalTargetTile,
      );
      return {
        success: false,
        reason: 'dialogueUnavailable',
      };
    }

    let didOpenDialogue = false;

    try {
      didOpenDialogue = this.openDialogueRequest(dialogueRequest);
    } catch (error) {
      console.error('Failed to open interaction card dialogue.', error);
      await this.cancelFailedDialogueRequest(dialogueRequest);
      this.restoreInteractionCardTargetPosition(
        resolution.targetId,
        originalTargetTile,
      );
      return {
        success: false,
        reason: 'dialogueUnavailable',
      };
    }

    if (!didOpenDialogue) {
      if (dialogueRequest.activityId) {
        this.activityCoordinator.cancelInteractionCardActivity(
          dialogueRequest.activityId,
        );
      }
      this.restoreInteractionCardTargetPosition(
        resolution.targetId,
        originalTargetTile,
      );
      return {
        success: false,
        reason: 'dialogueUnavailable',
      };
    }

    return { success: true };
  }

  private restoreInteractionCardTargetPosition(
    targetId: string,
    originalTile: GridCoordinate,
  ): void {
    if (!this.widget.moveCharacter(targetId, originalTile)) {
      console.error(
        `Failed to restore interaction card target ${targetId} to its original tile.`,
      );
      return;
    }

    this.sendToCharacter(targetId, {
      type: EventType.Drop,
      position: originalTile,
    });
  }

  private resolveWallSlamLayout(
    initiatorId: string,
    targetId: string,
  ): WallSlamLayout | null {
    const initiatorTile = this.widget.getCharacterTile(initiatorId);
    const currentTargetTile = this.widget.getCharacterTile(targetId);

    if (!initiatorTile || !currentTargetTile) {
      return null;
    }

    return WALL_SLAM_LAYOUT_DIRECTIONS
      .map(direction => {
        const vector = getWallSlamDirectionVector(direction);
        const targetTile = {
          x: initiatorTile.x + vector.x,
          y: initiatorTile.y + vector.y,
        };
        const wallTile = {
          x: targetTile.x + vector.x,
          y: targetTile.y + vector.y,
        };

        return {
          direction,
          targetTile,
          wallTile,
          distanceFromCurrentTarget: getManhattanDistance(targetTile, currentTargetTile),
        };
      })
      .filter(layout => (
        this.widget.isCharacterTileWalkable(layout.targetTile)
        && this.widget.getCell(layout.wallTile.x, layout.wallTile.y) !== null
      ))
      .sort((first, second) => (
        first.distanceFromCurrentTarget - second.distanceFromCurrentTarget
      ))[0] ?? null;
  }

  private async openWallSlamDialogue(
    initiatorId: string,
    targetId: string,
    layout: WallSlamLayout,
    dialogueRequest: CharacterPerformanceDialogueRequest,
  ): Promise<InteractionCardUseResult> {
    try {
      const directionVector = getWallSlamDirectionVector(layout.direction);
      const targetPresentationDistance = Math.max(
        0,
        WALL_SLAM_MAP_PERFORMANCE.participantDistanceCells - 1,
      );
      const targetOffset = {
        x: directionVector.x * targetPresentationDistance,
        y: directionVector.y * targetPresentationDistance,
      };
      const [
        pushedCharacterIds,
        didPositionInitiator,
        didPositionTarget,
      ] = await Promise.all([
        this.widget.pushCharactersAwayFromTile({
          anchorTile: this.widget.getCharacterTile(initiatorId) ?? layout.targetTile,
          excludedCharacterIds: [initiatorId, targetId],
          radiusCells: DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.detectionRadiusCells,
          distanceCells: DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.pushDistanceCells,
          durationMs: DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.pushDurationMs,
        }),
        this.widget.setCharacterPresentationPositionFromTileCenterInCells(
          initiatorId,
          { x: 0, y: 0 },
          DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.pushDurationMs,
        ),
        this.widget.setCharacterPresentationPositionFromTileCenterInCells(
          targetId,
          targetOffset,
          DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.pushDurationMs,
        ),
      ]);
      const displacedCharacterIds = [...pushedCharacterIds, initiatorId, targetId];

      if (!didPositionInitiator || !didPositionTarget) {
        this.clearWallSlamPresentationImmediately(displacedCharacterIds);
        await this.cancelFailedDialogueRequest(dialogueRequest);
        return {
          success: false,
          reason: 'presentationFailed',
        };
      }

      this.setWallSlamCharacterDirections(initiatorId, targetId, layout.direction);

      const didShowScene = await this.widget.showWallSlamScene({
        initiatorId,
        targetId,
        direction: layout.direction,
        wallDistanceCells: WALL_SLAM_MAP_PERFORMANCE.wallDistanceCells,
        wallDropDistanceCells: WALL_SLAM_MAP_PERFORMANCE.wallDropDistanceCells,
        wallEnterDurationMs: WALL_SLAM_MAP_PERFORMANCE.wallEnterDurationMs,
        backgroundDimOpacity: WALL_SLAM_MAP_PERFORMANCE.backgroundDimOpacity,
        backgroundDimDurationMs: WALL_SLAM_MAP_PERFORMANCE.backgroundDimDurationMs,
      });

      if (!didShowScene) {
        this.clearWallSlamPresentationImmediately(displacedCharacterIds);
        await this.cancelFailedDialogueRequest(dialogueRequest);
        return {
          success: false,
          reason: 'presentationFailed',
        };
      }

      if (!this.onDialogueRequest) {
        this.clearWallSlamPresentationImmediately(displacedCharacterIds);
        await this.cancelFailedDialogueRequest(dialogueRequest);
        return {
          success: false,
          reason: 'dialogueUnavailable',
        };
      }

      const didOpenDialogue = this.openDialogueRequest({
        ...dialogueRequest,
        presentationMode: 'mapCinematic',
        onBeforeClose: () => this.closeWallSlamPresentation(displacedCharacterIds),
        onCancel: () => this.closeWallSlamPresentation(displacedCharacterIds)
          .then(() => dialogueRequest.onCancel?.()),
      });

      if (!didOpenDialogue && dialogueRequest.activityId) {
        this.activityCoordinator.cancelInteractionCardActivity(
          dialogueRequest.activityId,
        );
      }

      return didOpenDialogue
        ? { success: true }
        : {
          success: false,
          reason: 'dialogueUnavailable',
        };
    } catch (error) {
      console.error('Failed to open wall slam presentation.', error);
      this.widget.clearCinematicSceneImmediately();
      try {
        await this.widget.clearAllCharacterPresentationOffsets(0);
      } catch (cleanupError) {
        console.error('Failed to clear wall slam presentation offsets.', cleanupError);
      }
      await this.cancelFailedDialogueRequest(dialogueRequest);
      return {
        success: false,
        reason: 'presentationFailed',
      };
    }
  }

  private openDialogueRequest(
    dialogueRequest: CharacterPerformanceDialogueRequest,
  ): boolean {
    if (!this.onDialogueRequest) {
      return false;
    }

    const shouldFocusMapParticipants = (
      dialogueRequest.presentationMode !== 'mapCinematic'
    );
    const hideDialogueFocus = () => (
      shouldFocusMapParticipants
        ? this.widget.hideDialogueFocus(
          DEFAULT_DIALOGUE_MAP_FOCUS.transitionDurationMs,
        )
        : Promise.resolve()
    );

    if (shouldFocusMapParticipants) {
      void this.widget.showDialogueFocus(
        dialogueRequest.participantIds,
        DEFAULT_DIALOGUE_MAP_FOCUS.backgroundDimOpacity,
        DEFAULT_DIALOGUE_MAP_FOCUS.transitionDurationMs,
      );
    }

    try {
      const didOpenDialogue = this.onDialogueRequest({
        ...dialogueRequest,
        onBeforeClose: async () => {
          await Promise.all([
            dialogueRequest.onBeforeClose?.(),
            hideDialogueFocus(),
          ]);
        },
        onCancel: async () => {
          await Promise.all([
            dialogueRequest.onCancel?.(),
            hideDialogueFocus(),
          ]);
        },
      });

      if (!didOpenDialogue && shouldFocusMapParticipants) {
        void this.widget.hideDialogueFocus(0);
      }

      return didOpenDialogue;
    } catch (error) {
      if (shouldFocusMapParticipants) {
        void this.widget.hideDialogueFocus(0);
      }
      throw error;
    }
  }

  private async cancelFailedDialogueRequest(
    dialogueRequest: CharacterPerformanceDialogueRequest,
  ): Promise<void> {
    try {
      await dialogueRequest.onCancel?.();
    } catch (error) {
      console.error('Failed to cancel interaction card dialogue.', error);
    } finally {
      if (dialogueRequest.activityId) {
        this.activityCoordinator.cancelInteractionCardActivity(
          dialogueRequest.activityId,
        );
      }
    }
  }

  private async closeWallSlamPresentation(
    characterIds: readonly string[],
  ): Promise<void> {
    await Promise.all([
      this.widget.hideWallSlamScene(
        WALL_SLAM_MAP_PERFORMANCE.wallExitDurationMs,
        WALL_SLAM_MAP_PERFORMANCE.backgroundDimDurationMs,
      ),
      ...characterIds.map(characterId => (
        this.widget.clearCharacterPresentationOffset(
          characterId,
          DEFAULT_MAP_PERFORMANCE_CROWD_DISPLACEMENT.restoreDurationMs,
        )
      )),
    ]);
  }

  private clearWallSlamPresentationImmediately(characterIds: readonly string[]): void {
    this.widget.clearCinematicSceneImmediately();
    characterIds.forEach(characterId => {
      void this.widget.clearCharacterPresentationOffset(characterId, 0);
    });
  }

  private setWallSlamCharacterDirections(
    initiatorId: string,
    targetId: string,
    direction: WallSlamSideDirection,
  ): void {
    const directions = getFacingDirections(direction);

    this.widget.setCharacterSpriteDirection(initiatorId, directions.initiator);
    this.widget.setCharacterSpriteDirection(targetId, directions.target);
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

  private handleRuntimeCharacterSnapshot(characterId: string, snapshot: CharacterSnapshot): void {
    this.runtimeCoordinator.handleCharacterSnapshot(characterId, snapshot);
  }

  private getCharacterName(characterId: string): string {
    return this.getCharacterSnapshot(characterId)?.context.name ?? characterId;
  }

  private getCharacterWayOfSaying(characterId: string): CharacterSeed['wayOfSaying'] {
    return this.characters.find(character => character.id === characterId)?.wayOfSaying;
  }

  private getCharacterSnapshot(characterId: string): CharacterSnapshot | null {
    return this.actorRegistry.getSnapshot(characterId);
  }

  private getCharacterSnapshotsById(): Record<string, CharacterSnapshot> {
    return this.actorRegistry.getSnapshotsById();
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

function getFacingDirections(direction: WallSlamSideDirection): {
  initiator: TownMapCharacterSpriteDirection;
  target: TownMapCharacterSpriteDirection;
} {
  return direction === 'east'
    ? {
      initiator: 'side-right',
      target: 'side-left',
    }
    : {
      initiator: 'side-left',
      target: 'side-right',
    };
}

function getManhattanDistance(
  first: GridCoordinate,
  second: GridCoordinate,
): number {
  return Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
}
