import type { CharacterEvent } from '~/stateMachines/gameFlow/events';
import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterSeed, CharacterSnapshot } from '~/services/townCharacterTypes';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import type { CharacterActorRegistry } from '~/services/characterActorRegistry';
import type { CharacterHeldItemCoordinator } from '~/services/characterHeldItemCoordinator';
import type { TownMovementCoordinator } from '~/services/townMovementCoordinator';
import type { Position } from '~/constants/character';
import { itemService } from '~/services/items/itemService';
import { characterRuntimeSaveService } from '~/services/save/characterRuntimeSaveService';
import { saveService } from '~/services/save/saveService';
import { createDefaultCharacterPersonality } from '~/constants/characterPersonality';

const OFFLINE_RUNTIME_SYNC_DECISION_GRACE_MS = 1800;

type SpawnRuntime = CharacterRuntimeSnapshot | CharacterSnapshot['context'];

interface TownCharacterRuntimeCoordinatorOptions {
  actorRegistry: CharacterActorRegistry;
  movementCoordinator: TownMovementCoordinator;
  heldItemCoordinator: CharacterHeldItemCoordinator;
  isSimWorldPaused: () => boolean;
  clearLiveActivitiesForOfflineApply: () => void;
  handleCurrentActivity: (characterId: string, snapshot: CharacterSnapshot) => void;
  handlePendingActivityJoin: (characterId: string, snapshot: CharacterSnapshot) => void;
  handleActivityTravelProgress: (characterId: string, snapshot: CharacterSnapshot) => void;
  deferCharacterDecision: (characterId: string, durationMs: number) => void;
  syncRequestIndicators: () => void;
  sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;
  onCharacterSnapshot: (characterId: string, snapshot: CharacterSnapshot) => void;
}

export class TownCharacterRuntimeCoordinator {
  private readonly actorRegistry: CharacterActorRegistry;
  private readonly movementCoordinator: TownMovementCoordinator;
  private readonly heldItemCoordinator: CharacterHeldItemCoordinator;
  private readonly isSimWorldPaused: () => boolean;
  private readonly clearLiveActivitiesForOfflineApply: () => void;
  private readonly handleCurrentActivity: (
    characterId: string,
    snapshot: CharacterSnapshot,
  ) => void;
  private readonly handlePendingActivityJoin: (
    characterId: string,
    snapshot: CharacterSnapshot,
  ) => void;
  private readonly handleActivityTravelProgress: (
    characterId: string,
    snapshot: CharacterSnapshot,
  ) => void;
  private readonly deferCharacterDecision: (characterId: string, durationMs: number) => void;
  private readonly syncRequestIndicators: () => void;
  private readonly sendToCharacter: (characterId: string, event: CharacterEvent) => boolean;
  private readonly onCharacterSnapshot: (
    characterId: string,
    snapshot: CharacterSnapshot,
  ) => void;

  constructor(options: TownCharacterRuntimeCoordinatorOptions) {
    this.actorRegistry = options.actorRegistry;
    this.movementCoordinator = options.movementCoordinator;
    this.heldItemCoordinator = options.heldItemCoordinator;
    this.isSimWorldPaused = options.isSimWorldPaused;
    this.clearLiveActivitiesForOfflineApply = options.clearLiveActivitiesForOfflineApply;
    this.handleCurrentActivity = options.handleCurrentActivity;
    this.handlePendingActivityJoin = options.handlePendingActivityJoin;
    this.handleActivityTravelProgress = options.handleActivityTravelProgress;
    this.deferCharacterDecision = options.deferCharacterDecision;
    this.syncRequestIndicators = options.syncRequestIndicators;
    this.sendToCharacter = options.sendToCharacter;
    this.onCharacterSnapshot = options.onCharacterSnapshot;
  }

  seedCharacterItems(character: CharacterSeed): void {
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

  getAvailableActorItemDefinitionIds(characterId: string): string[] {
    return itemService.getActorItems(characterId)
      .filter(itemInstance => itemInstance.state === 'stored' || itemInstance.state === 'held')
      .map(itemInstance => itemInstance.definitionId);
  }

  spawnCharacterActor(character: CharacterSeed): void {
    const previousContext = this.actorRegistry.getSnapshot(character.id)?.context;
    const savedRuntime = previousContext
      ? null
      : characterRuntimeSaveService.getRuntimeSnapshot(character.id);
    const runtime = this.resolveVisibleSpawnRuntime(
      previousContext ?? savedRuntime ?? undefined,
      character.position,
    );

    if (runtime?.presence.kind === 'contained') {
      this.movementCoordinator.registerCharacterRenderData(character.id, character);
    } else {
      this.movementCoordinator.placeCharacter(character.id, character, runtime);
    }

    this.actorRegistry.spawn(character, {
      id: character.id,
      name: character.name,
      personality: {
        ...(character.personality ?? createDefaultCharacterPersonality()),
      },
      position: runtime?.position ?? character.position,
      ownItems: previousContext?.ownItems ?? ('ownItems' in character ? character.ownItems : undefined),
      saturation: runtime?.status.saturation ?? character.saturation,
      relationships: runtime?.relationships,
      heldItem: runtime?.heldItem ?? this.heldItemCoordinator.restoreHeldItemForCharacter(character.id),
      runtime,
    });
  }

  private resolveVisibleSpawnRuntime(
    runtime: CharacterRuntimeSnapshot,
    fallbackPosition: Position,
  ): CharacterRuntimeSnapshot;
  private resolveVisibleSpawnRuntime(
    runtime: CharacterSnapshot['context'],
    fallbackPosition: Position,
  ): CharacterSnapshot['context'];
  private resolveVisibleSpawnRuntime(
    runtime: undefined,
    fallbackPosition: Position,
  ): undefined;
  private resolveVisibleSpawnRuntime(
    runtime: SpawnRuntime | undefined,
    fallbackPosition: Position,
  ): SpawnRuntime | undefined;
  private resolveVisibleSpawnRuntime(
    runtime: SpawnRuntime | undefined,
    fallbackPosition: Position,
  ): SpawnRuntime | undefined {
    if (!runtime || runtime.presence.kind !== 'positioned') {
      return runtime;
    }

    const spawnPosition = this.movementCoordinator.resolveVisibleSpawnPosition(
      runtime.position,
      fallbackPosition,
    );

    if (
      spawnPosition.x === runtime.position.x &&
      spawnPosition.y === runtime.position.y &&
      spawnPosition.x === runtime.presence.position.x &&
      spawnPosition.y === runtime.presence.position.y
    ) {
      return runtime;
    }

    return {
      ...runtime,
      position: spawnPosition,
      presence: {
        ...runtime.presence,
        position: spawnPosition,
      },
    };
  }

  applyOfflineRuntimeSnapshots(
    snapshots: readonly CharacterRuntimeSnapshot[],
  ): number {
    if (this.isSimWorldPaused()) {
      return 0;
    }

    this.clearLiveActivitiesForOfflineApply();

    const syncedCharacterIds = snapshots.flatMap(snapshot => {
      const visibleSnapshot = this.resolveVisibleSpawnRuntime(snapshot, snapshot.position) ?? snapshot;
      const didSyncActor = this.sendToCharacter(snapshot.id, {
        type: EventType.ApplyOfflineRuntime,
        runtime: visibleSnapshot,
      });

      if (!didSyncActor) {
        return [];
      }

      this.movementCoordinator.applyRuntimeSnapshot(visibleSnapshot);
      this.deferCharacterDecision(
        visibleSnapshot.id,
        OFFLINE_RUNTIME_SYNC_DECISION_GRACE_MS,
      );

      return [visibleSnapshot.id];
    });

    this.syncRequestIndicators();
    return syncedCharacterIds.length;
  }

  handleCharacterSnapshot(characterId: string, snapshot: CharacterSnapshot): void {
    if (characterRuntimeSaveService.captureSnapshot(snapshot)) {
      saveService.markDirty('characterRuntime');
    }

    this.onCharacterSnapshot(characterId, snapshot);
    this.movementCoordinator.syncCharacterWithWidget(characterId, snapshot);
    this.handleCurrentActivity(characterId, snapshot);
    this.handlePendingActivityJoin(characterId, snapshot);
    this.handleActivityTravelProgress(characterId, snapshot);
    this.heldItemCoordinator.syncSnapshot(characterId, snapshot);
    this.syncRequestIndicators();
  }
}
