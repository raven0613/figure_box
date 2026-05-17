import { createActor } from 'xstate';
import { CHARACTER_SEEDS, Expression, SocialStatus, type Position } from '~/constants/character';
import { characterMachine } from '~/stateMachines/gameFlow/children/character';
import { CharacterPerformanceRunner } from '~/services/characterEvents/characterPerformanceRunner';
import {
  createJoinableActivityManager,
  type JoinableActivity,
  type JoinableActivityManager,
} from '~/services/characterEvents/joinableActivities';
import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
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
import {
  GOD_DROP_SCAN_RADIUS,
  GodDropOpportunityService,
  type GodDropOpportunity,
  type GodDropOpportunityCandidate,
} from '~/services/godDropOpportunityService';
import { RelationshipMomentOverlayCoordinator } from '~/services/relationshipMomentOverlayCoordinator';
import type {
  CharacterActor,
  CharacterSeed,
  CharacterSnapshot,
} from '~/services/townCharacterTypes';
import type { CharacterEventNearbyRelationship } from '~/services/characterEvents/types';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';

type Subscription = {
  unsubscribe: () => void;
};

export type { CharacterSnapshot } from '~/services/townCharacterTypes';

const INITIAL_DECISION_STAGGER_MIN_MS = 500;
const INITIAL_DECISION_STAGGER_MAX_MS = 4500;
const DECISION_INTERVAL_MIN_MS = 2500;
const DECISION_INTERVAL_MAX_MS = 5500;
const RELATIONSHIP_MOMENT_DURATION_MS = 3000;
const RELATIONSHIP_MOMENT_DECISION_GRACE_MS = 1800;
const GOD_DROP_DECISION_GRACE_MS = 2600;

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  onGodDropOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;
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
  private readonly relationshipMomentOverlayCoordinator: RelationshipMomentOverlayCoordinator;
  private readonly godDropOpportunityService = new GodDropOpportunityService();
  private readonly nextDecisionAtByCharacterId = new Map<string, number>();
  private relationshipStore = createRelationshipStore();
  private tickTimer: number | null = null;
  private godDropAutoTimer: number | null = null;
  private godDropExpireTimer: number | null = null;
  private currentGodDropOpportunity: GodDropOpportunity | null = null;
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private readonly onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
  private readonly onGodDropOpportunityChange?: (opportunity: GodDropOpportunity | null) => void;

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
    this.relationshipMomentOverlayCoordinator = new RelationshipMomentOverlayCoordinator({
      sendToCharacter: (characterId, event) => this.sendToCharacter(characterId, event),
      pauseCharacterWalk: (characterId, durationMs) => {
        this.movementCoordinator.pauseCharacterWalk(characterId, durationMs);
      },
      showCharacterBubble: (characterId, text, durationMs) => {
        this.widget.showCharacterBubble(characterId, text, durationMs);
      },
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
      onOverlayFinished: participantIds => {
        this.deferCharactersDecision(participantIds, RELATIONSHIP_MOMENT_DECISION_GRACE_MS);
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
  }

  start(): void {
    CHARACTER_SEEDS.forEach(character => {
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

  chooseGodDropCandidate(candidateId: string): void {
    const opportunity = this.currentGodDropOpportunity;
    const candidate = opportunity?.candidates.find(item => item.id === candidateId);

    if (!opportunity || !candidate) {
      return;
    }

    this.executeGodDropCandidate(opportunity, candidate, 'player');
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
    this.performanceRunner.dispose();
    this.activityManager.clear();
    this.nextDecisionAtByCharacterId.clear();

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
        this.relationshipMomentOverlayCoordinator.isCharacterInOverlay(targetCharacterId)
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
      },
    });

    this.characterActors.set(character.id, actor);

    const subscription = actor.subscribe(snapshot => {
      this.onCharacterSnapshot?.(character.id, snapshot);
      this.movementCoordinator.syncCharacterWithWidget(character.id, snapshot);
      this.activityCoordinator.handleCurrentActivity(character.id, snapshot);
      this.activityCoordinator.handlePendingActivityJoin(character.id, snapshot);
      this.activityCoordinator.handleActivityTravelProgress(character.id, snapshot);
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
      const nearbyCharacterIds = this.getNearbyCharacterIds(character.id, 2);

      this.sendToCharacter(character.id, {
        type: EventType.Tick,
        nearbyCharacterIds,
        nearbyRelationships: this.getNearbyRelationshipSnapshots(character.id, nearbyCharacterIds),
        nearbyJoinableActivities: this.activityCoordinator.getNearbyJoinableActivities(character.id, timestamp),
        timestamp,
        allowAutonomousDecision,
      });
    });

    this.relationshipStore = this.relationshipTicker.triggerPassByRelationships(
      this.characterActors,
      this.relationshipStore,
      timestamp,
    );
    this.onRelationshipStoreChange?.(this.relationshipStore);
    this.activityCoordinator.pruneEndedActivities(timestamp);
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

}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}
