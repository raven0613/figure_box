import { CHARACTER_SEEDS, Expression, getMoodForMoodValue } from '~/constants/character';
import { TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import { createEmptyActivityCooldowns } from '~/services/characterEvents/activityCooldowns';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type {
  CharacterRuntimeSnapshot,
  CharacterRuntimeSaveRecord,
} from './saveTypes';

class CharacterRuntimeSaveService {
  private readonly snapshotsByCharacterId = new Map<string, CharacterRuntimeSnapshot>();
  private lastSnapshotHash = '';

  load(records: readonly CharacterRuntimeSaveRecord[]): void {
    this.snapshotsByCharacterId.clear();

    records.forEach(record => {
      this.snapshotsByCharacterId.set(record.id, cloneCharacterRuntimeSnapshot(record.snapshot));
    });
    this.lastSnapshotHash = this.createRecordsHash();
  }

  captureSnapshot(snapshot: CharacterSnapshot): boolean {
    const runtimeSnapshot = createCharacterRuntimeSnapshot(snapshot);
    const currentSnapshot = this.snapshotsByCharacterId.get(runtimeSnapshot.id);

    if (currentSnapshot && JSON.stringify(currentSnapshot) === JSON.stringify(runtimeSnapshot)) {
      return false;
    }

    this.snapshotsByCharacterId.set(runtimeSnapshot.id, runtimeSnapshot);
    return true;
  }

  getRuntimeSnapshot(characterId: string): CharacterRuntimeSnapshot | null {
    const snapshot = this.snapshotsByCharacterId.get(characterId);

    return snapshot ? cloneCharacterRuntimeSnapshot(snapshot) : null;
  }

  getSaveRecords(): readonly CharacterRuntimeSaveRecord[] {
    const timestamp = Date.now();

    return Array.from(this.snapshotsByCharacterId.values()).map(snapshot => ({
      id: snapshot.id,
      seedId: snapshot.seedId,
      snapshot: cloneCharacterRuntimeSnapshot(snapshot),
      updatedAt: timestamp,
    }));
  }

  didSaveRecordsChange(): boolean {
    const nextHash = this.createRecordsHash();

    if (nextHash === this.lastSnapshotHash) {
      return false;
    }

    this.lastSnapshotHash = nextHash;
    return true;
  }

  private createRecordsHash(): string {
    return JSON.stringify(
      Array.from(this.snapshotsByCharacterId.entries())
        .sort(([leftId], [rightId]) => leftId.localeCompare(rightId)),
    );
  }
}

export function createDefaultCharacterRuntimeSnapshot(
  characterId: string,
): CharacterRuntimeSnapshot {
  const seed = CHARACTER_SEEDS.find(character => character.id === characterId);
  const position = seed?.position ?? { x: 0, y: 0 };
  const moodValue = 65;

  return {
    id: characterId,
    seedId: seed?.id ?? characterId,
    status: {
      mood: getMoodForMoodValue(moodValue),
      expression: Expression.Normal,
      saturation: seed?.saturation ?? 70,
      moodValue,
      playNeed: 35,
      hungerThreshold: 30,
    },
    position,
    presence: {
      kind: 'positioned',
      spaceId: TOWN_WORLD_SPACE_ID,
      position,
    },
    heldItem: null,
    activityCooldowns: createEmptyActivityCooldowns(),
    locks: {
      bodyAction: [],
      bodyMove: [],
      mind: [],
      communication: [],
    },
    relationships: [],
  };
}

function createCharacterRuntimeSnapshot(snapshot: CharacterSnapshot): CharacterRuntimeSnapshot {
  const context = snapshot.context;

  return {
    id: context.id,
    seedId: context.id,
    status: cloneStatus(context.status),
    position: { ...context.position },
    presence: clonePresence(context.presence),
    heldItem: context.heldItem ? { ...context.heldItem } : null,
    activityCooldowns: cloneActivityCooldowns(context.activityCooldowns),
    locks: cloneLocks(context.locks),
    relationships: context.relationships.map(relationship => ({
      ...relationship,
      memories: {
        impression: { ...relationship.memories.impression },
        argument: { ...relationship.memories.argument },
        fight: { ...relationship.memories.fight },
      },
    })),
  };
}

function cloneCharacterRuntimeSnapshot(snapshot: CharacterRuntimeSnapshot): CharacterRuntimeSnapshot {
  return {
    id: snapshot.id,
    seedId: snapshot.seedId,
    status: cloneStatus(snapshot.status),
    position: { ...snapshot.position },
    presence: clonePresence(snapshot.presence),
    heldItem: snapshot.heldItem ? { ...snapshot.heldItem } : null,
    activityCooldowns: cloneActivityCooldowns(snapshot.activityCooldowns),
    locks: cloneLocks(snapshot.locks),
    relationships: snapshot.relationships.map(relationship => ({
      ...relationship,
      memories: {
        impression: { ...relationship.memories.impression },
        argument: { ...relationship.memories.argument },
        fight: { ...relationship.memories.fight },
      },
    })),
  };
}

function cloneStatus(status: CharacterContext['status']): CharacterContext['status'] {
  return { ...status };
}

function clonePresence(presence: CharacterContext['presence']): CharacterContext['presence'] {
  return presence.kind === 'positioned'
    ? {
      kind: 'positioned',
      spaceId: presence.spaceId,
      position: { ...presence.position },
    }
    : {
      kind: 'contained',
      spaceId: presence.spaceId,
    };
}

function cloneActivityCooldowns(
  activityCooldowns: CharacterContext['activityCooldowns'],
): CharacterContext['activityCooldowns'] {
  return {
    categoryUntilByKey: { ...activityCooldowns.categoryUntilByKey },
    pairUntilByKey: { ...activityCooldowns.pairUntilByKey },
    repeatByKey: Object.fromEntries(
      Object.entries(activityCooldowns.repeatByKey).map(([key, record]) => [
        key,
        { ...record },
      ]),
    ),
  };
}

function cloneLocks(locks: CharacterContext['locks']): CharacterContext['locks'] {
  return {
    bodyAction: [...locks.bodyAction],
    bodyMove: [...locks.bodyMove],
    mind: [...locks.mind],
    communication: [...locks.communication],
  };
}

export const characterRuntimeSaveService = new CharacterRuntimeSaveService();
