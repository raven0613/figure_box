import { createActor, type ActorRefFrom, type SnapshotFrom } from 'xstate';
import { CHARACTER_SEEDS, Expression, type Position } from '~/constants/character';
import { INVITATION_DIALOGUE } from '~/constants/dialogue';
import { DESTINATION_MAP } from '~/constants/townMap';
import { gameFlowMachine } from '~/stateMachines/gameFlow';
import {
  characterMachine,
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import { dialogueManagerMachine } from '~/stateMachines/gameFlow/children/dialogue';
import { EventType, type CharacterEvent, type DialogueManagerEmittedEvent } from '~/stateMachines/gameFlow/events';
import {
  createRelationshipStore,
  recordPassByPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';

type CharacterActor = ActorRefFrom<typeof characterMachine>;
type GameFlowActor = ActorRefFrom<typeof gameFlowMachine>;
type DialogueActor = ActorRefFrom<typeof dialogueManagerMachine>;
type CharacterSeed = typeof CHARACTER_SEEDS[number];
type Subscription = {
  unsubscribe: () => void;
};

export type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;
export type DialogueSnapshot = SnapshotFrom<typeof dialogueManagerMachine>;

interface TownCharacterControllerOptions {
  widget: FabricTownMapWidget;
  onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  onDialogueSnapshot?: (snapshot: DialogueSnapshot) => void;
}

export class TownCharacterController {
  private readonly widget: FabricTownMapWidget;
  private readonly characterActors = new Map<string, CharacterActor>();
  private readonly characterSubscriptions = new Map<string, Subscription>();
  private readonly walkingCharacterIds = new Set<string>();
  private relationshipStore = createRelationshipStore();
  private gameFlowActor: GameFlowActor | null = null;
  private dialogueSubscription: Subscription | null = null;
  private emittedSubscription: Subscription | null = null;
  private tickTimer: number | null = null;
  private readonly onCharacterSnapshot?: (characterId: string, snapshot: CharacterSnapshot) => void;
  private readonly onRelationshipStoreChange?: (relationshipStore: RelationshipStore) => void;
  private readonly onDialogueSnapshot?: (snapshot: DialogueSnapshot) => void;

  constructor(options: TownCharacterControllerOptions) {
    this.widget = options.widget;
    this.onCharacterSnapshot = options.onCharacterSnapshot;
    this.onRelationshipStoreChange = options.onRelationshipStoreChange;
    this.onDialogueSnapshot = options.onDialogueSnapshot;
  }

  start(): void {
    CHARACTER_SEEDS.forEach(character => {
      this.spawnCharacterActor(character);
    });

    this.gameFlowActor = createActor(gameFlowMachine);
    this.gameFlowActor.start();

    const dialogueActor = this.gameFlowActor.getSnapshot().children.dialogueManager as DialogueActor | undefined;

    if (!dialogueActor) {
      throw new Error('Dialogue manager actor was not created by gameFlowMachine.');
    }

    this.dialogueSubscription = dialogueActor.subscribe(snapshot => {
      this.onDialogueSnapshot?.(snapshot);
    });
    this.emittedSubscription = dialogueActor.on('*', event => {
      this.handleDialogueEmission(event as DialogueManagerEmittedEvent);
    });

    this.tickTimer = window.setInterval(() => {
      this.tick();
    }, 1000);
  }

  pickUpCharacter(characterId: string): void {
    if (this.isCharacterBodyFrozen(characterId)) {
      this.widget.showCharacterBubble(characterId, '對話中...');
      return;
    }

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

  startInvitationDialogue(): void {
    this.gameFlowActor?.send({
      type: 'START_DIALOGUE',
      script: INVITATION_DIALOGUE,
      participants: [
        {
          id: CHARACTER_SEEDS[0].id,
          role: 'initiator',
          name: CHARACTER_SEEDS[0].name,
        },
        {
          id: CHARACTER_SEEDS[1].id,
          role: 'target',
          name: CHARACTER_SEEDS[1].name,
        },
      ],
    });
  }

  resolveDialogueChoice(choiceId: string): void {
    this.gameFlowActor?.send({
      type: 'RESOLVE',
      choiceId,
    });
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

    this.walkingCharacterIds.forEach(id => this.widget.cancelWalk(id));
    this.walkingCharacterIds.clear();

    this.characterSubscriptions.forEach(subscription => {
      subscription.unsubscribe();
    });
    this.characterSubscriptions.clear();

    this.dialogueSubscription?.unsubscribe();
    this.dialogueSubscription = null;
    this.emittedSubscription?.unsubscribe();
    this.emittedSubscription = null;

    this.gameFlowActor?.stop();
    this.gameFlowActor = null;

    this.characterActors.forEach(actor => {
      actor.stop();
    });
    this.characterActors.clear();

    this.relationshipStore = createRelationshipStore();
    this.onRelationshipStoreChange?.(this.relationshipStore);
  }

  private spawnCharacterActor(character: CharacterSeed, previousActor?: CharacterActor): CharacterActor {
    this.characterSubscriptions.get(character.id)?.unsubscribe();

    const previousContext = previousActor?.getSnapshot().context;

    this.widget.placeCharacter({
      id: character.id,
      x: previousContext?.position.x ?? character.position.x,
      y: previousContext?.position.y ?? character.position.y,
      color: character.color,
      label: character.label,
      expression: previousContext?.status.expression ?? Expression.Normal,
    });

    const actor = createActor(characterMachine, {
      input: {
        id: character.id,
        name: character.name,
        position: previousContext?.position ?? character.position,
        saturation: previousContext?.status.saturation ?? character.saturation,
        relationships: previousContext?.relationships,
      },
    });

    this.characterActors.set(character.id, actor);

    const subscription = actor.subscribe(snapshot => {
      this.onCharacterSnapshot?.(character.id, snapshot);
      this.syncCharacterWithWidget(character.id, snapshot);
    });

    actor.start();
    this.characterSubscriptions.set(character.id, subscription);
    return actor;
  }

  private syncCharacterWithWidget(characterId: string, snapshot: CharacterSnapshot): void {
    this.widget.updateCharacterStatus(characterId, snapshot.context.currentMotivation);
    this.widget.updateCharacterExpression(characterId, snapshot.context.status.expression);

    const summary = getCharacterStateSummary(snapshot.value);
    const target = snapshot.context.target;

    if (summary.bodyMove !== 'walking' || !target) {
      this.cancelWalkIfNeeded(characterId);
      return;
    }

    if (this.walkingCharacterIds.has(characterId)) {
      return;
    }

    const currentPosition = snapshot.context.position;
    const path = this.widget.findPath(currentPosition, target, characterId);

    if (!path) {
      this.sendToCharacter(characterId, { type: EventType.MoveBlocked });
      return;
    }

    if (path.length === 0) {
      this.sendToCharacter(characterId, { type: EventType.Arrive, position: target });
      return;
    }

    this.walkingCharacterIds.add(characterId);

    this.widget.walkCharacterAlongPath(
      characterId,
      path,
      arrivedPosition => {
        this.walkingCharacterIds.delete(characterId);
        const actor = this.characterActors.get(characterId);
        const motivation = actor?.getSnapshot().context.currentMotivation ?? '';

        this.sendToCharacter(characterId, { type: EventType.Arrive, position: arrivedPosition });

        if (DESTINATION_MAP[motivation]) {
          const dispersalTarget = this.findNearbyEmptyTile(arrivedPosition, characterId, 4);

          if (dispersalTarget) {
            this.sendToCharacter(characterId, { type: EventType.MoveTo, target: dispersalTarget });
          }
        }
      },
      blockedPosition => {
        this.walkingCharacterIds.delete(characterId);
        this.sendToCharacter(characterId, { type: EventType.MoveBlocked, position: blockedPosition });
      },
    );
  }

  private tick(): void {
    const timestamp = Date.now();

    CHARACTER_SEEDS.forEach(character => {
      const actor = this.characterActors.get(character.id);

      if (!actor || actor.getSnapshot().status !== 'active') {
        this.spawnCharacterActor(character, actor);
      }

      this.sendToCharacter(character.id, { type: EventType.Tick });
    });

    this.relationshipStore = this.triggerPassByRelationships(timestamp);
    this.onRelationshipStoreChange?.(this.relationshipStore);
  }

  private triggerPassByRelationships(timestamp: number): RelationshipStore {
    let nextRelationshipStore = this.relationshipStore;
    const processedPairs = new Set<string>();

    this.characterActors.forEach((_actor, characterId) => {
      const tile = this.widget.getCharacterTile(characterId);

      if (!tile) {
        return;
      }

      const nearbyIds = this.widget.getOccupiedNeighborIds(tile.x, tile.y, 2, characterId);

      nearbyIds.forEach(targetCharId => {
        const pairKey = characterId < targetCharId
          ? `${characterId}::${targetCharId}`
          : `${targetCharId}::${characterId}`;

        if (processedPairs.has(pairKey)) {
          return;
        }

        processedPairs.add(pairKey);

        this.sendToCharacter(characterId, { type: EventType.PassBy, targetCharId, timestamp });
        this.sendToCharacter(targetCharId, { type: EventType.PassBy, targetCharId: characterId, timestamp });

        nextRelationshipStore = recordPassByPair(
          nextRelationshipStore,
          characterId,
          targetCharId,
          timestamp,
        );
      });
    });

    return nextRelationshipStore;
  }

  private handleDialogueEmission(event: DialogueManagerEmittedEvent): void {
    switch (event.type) {
      case 'DIALOGUE_CHARACTER_EVENT':
        this.sendToCharacter(event.characterId, event.event);
        return;
      case 'DIALOGUE_LINE':
        this.sendToCharacter(event.speakerId, {
          type: EventType.SetExpression,
          expression: event.expression ?? Expression.Normal,
        });
        this.widget.showCharacterBubble(event.speakerId, event.text, 1800);
        return;
      case 'DIALOGUE_CHOICE_REQUESTED':
        if (event.choice.text) {
          event.participantIds.forEach(characterId => {
            this.widget.showCharacterBubble(characterId, event.choice.text ?? '', 4200);
          });
        }
        return;
      case 'DIALOGUE_CHOICE_RESOLVED':
      case 'DIALOGUE_ENDED':
        return;
    }
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

  private cancelWalkIfNeeded(characterId: string): void {
    if (!this.walkingCharacterIds.has(characterId)) {
      return;
    }

    this.widget.cancelWalk(characterId);
    this.walkingCharacterIds.delete(characterId);
  }

  private findNearbyEmptyTile(position: Position, occupantId: string, range: number): GridCoordinate | null {
    const neighbors = this.widget.getNeighbors(position.x, position.y, range);
    const candidates = neighbors.filter(tile =>
      tile.cell.walkable && (!tile.cell.occupantId || tile.cell.occupantId === occupantId)
    );

    if (candidates.length === 0) {
      return null;
    }

    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    return { x: chosen.x, y: chosen.y };
  }
}
