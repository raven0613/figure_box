import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import type {
  OfflineBaselineCharacterPreview,
  OfflineBaselinePreview,
} from './types';

export interface OfflineBaselineNormalizationResult {
  snapshots: readonly CharacterRuntimeSnapshot[];
  preview: OfflineBaselinePreview;
}

export function normalizeOfflineBaselineSnapshots(input: {
  snapshots: readonly CharacterRuntimeSnapshot[];
  characterNameById: ReadonlyMap<string, string>;
}): OfflineBaselineNormalizationResult {
  const normalized = input.snapshots.map(snapshot => normalizeOfflineBaselineSnapshot({
    snapshot,
    characterName: input.characterNameById.get(snapshot.id) ?? snapshot.id,
  }));

  return {
    snapshots: normalized.map(item => item.snapshot),
    preview: {
      settlementPolicy: 'committedOnly',
      normalizedCharacterCount: normalized.filter(item => item.preview.changed).length,
      characters: normalized.map(item => item.preview),
    },
  };
}

function normalizeOfflineBaselineSnapshot(input: {
  snapshot: CharacterRuntimeSnapshot;
  characterName: string;
}): {
  snapshot: CharacterRuntimeSnapshot;
  preview: OfflineBaselineCharacterPreview;
} {
  const clearedLocks = cloneLocks(input.snapshot.locks);
  const hasLocks = Object.values(clearedLocks).some(locks => locks.length > 0);
  const normalizedPresence = normalizePositionedPresence(input.snapshot);
  const changed = hasLocks || Boolean(normalizedPresence.positionPreview);
  const notes = [
    '只承認已 commit 的 runtime 結果，不替半途活動補結算。',
    ...(hasLocks ? ['清除離開前的暫態控制鎖，讓離線事件可從穩定狀態開始。'] : []),
    ...(normalizedPresence.positionPreview ? ['修正 positioned presence 與 runtime position 不一致。'] : []),
  ];
  const snapshot: CharacterRuntimeSnapshot = {
    ...input.snapshot,
    status: { ...input.snapshot.status },
    position: { ...normalizedPresence.position },
    presence: normalizedPresence.presence,
    heldItem: input.snapshot.heldItem ? { ...input.snapshot.heldItem } : null,
    activityCooldowns: cloneActivityCooldowns(input.snapshot.activityCooldowns),
    locks: {
      bodyAction: [],
      bodyMove: [],
      mind: [],
      communication: [],
    },
    relationships: cloneRelationships(input.snapshot.relationships),
  };

  return {
    snapshot,
    preview: {
      characterId: input.snapshot.id,
      characterName: input.characterName,
      changed,
      clearedLocks,
      position: normalizedPresence.positionPreview,
      presence: normalizedPresence.presencePreview,
      notes,
    },
  };
}

function normalizePositionedPresence(snapshot: CharacterRuntimeSnapshot): {
  position: CharacterRuntimeSnapshot['position'];
  presence: CharacterRuntimeSnapshot['presence'];
  positionPreview: OfflineBaselineCharacterPreview['position'];
  presencePreview: OfflineBaselineCharacterPreview['presence'];
} {
  if (snapshot.presence.kind === 'contained') {
    return {
      position: { ...snapshot.position },
      presence: {
        kind: 'contained',
        spaceId: snapshot.presence.spaceId,
      },
      positionPreview: null,
      presencePreview: null,
    };
  }

  const didAlignPosition = (
    snapshot.presence.position.x !== snapshot.position.x ||
    snapshot.presence.position.y !== snapshot.position.y
  );
  const position = didAlignPosition
    ? { ...snapshot.position }
    : { ...snapshot.presence.position };

  return {
    position,
    presence: {
      kind: 'positioned',
      spaceId: snapshot.presence.spaceId,
      position,
    },
    positionPreview: didAlignPosition
      ? {
        from: { ...snapshot.presence.position },
        to: position,
        reason: 'alignPresenceToCommittedRuntimePosition',
      }
      : null,
    presencePreview: didAlignPosition
      ? {
        from: snapshot.presence.spaceId,
        to: snapshot.presence.spaceId,
        kind: 'positioned',
        reason: 'alignPresenceToCommittedRuntimePosition',
      }
      : null,
  };
}

function cloneLocks(
  locks: CharacterRuntimeSnapshot['locks'],
): OfflineBaselineCharacterPreview['clearedLocks'] {
  return {
    bodyAction: [...locks.bodyAction],
    bodyMove: [...locks.bodyMove],
    mind: [...locks.mind],
    communication: [...locks.communication],
  };
}

function cloneActivityCooldowns(
  activityCooldowns: CharacterRuntimeSnapshot['activityCooldowns'],
): CharacterRuntimeSnapshot['activityCooldowns'] {
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

function cloneRelationships(
  relationships: CharacterRuntimeSnapshot['relationships'],
): CharacterRuntimeSnapshot['relationships'] {
  return relationships.map(relationship => ({
    ...relationship,
    memories: {
      impression: { ...relationship.memories.impression },
      argument: { ...relationship.memories.argument },
      fight: { ...relationship.memories.fight },
    },
  }));
}
