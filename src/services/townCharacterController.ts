import { createActor } from 'xstate';
import { CHARACTER_SEEDS, Expression, type Position } from '~/constants/character';
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
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import { TownActivityCoordinator } from '~/services/townActivityCoordinator';
import { TownMovementCoordinator } from '~/services/townMovementCoordinator';
import { TownRelationshipTicker } from '~/services/townRelationshipTicker';
import type {
  CharacterActor,
  CharacterSeed,
  CharacterSnapshot,
} from '~/services/townCharacterTypes';
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

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;
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
  private readonly nextDecisionAtByCharacterId = new Map<string, number>();
  private relationshipStore = createRelationshipStore();
  private tickTimer: number | null = null;
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private readonly onJoinableActivitiesChange?: (activities: readonly JoinableActivity[]) => void;

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
      return;
    }

    this.sendToCharacter(characterId, { type: EventType.Drop });
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
    this.notifyJoinableActivitiesChanged();
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

      this.sendToCharacter(character.id, {
        type: EventType.Tick,
        nearbyCharacterIds: this.getNearbyCharacterIds(character.id, 2),
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
