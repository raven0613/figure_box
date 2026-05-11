import {
  DirectedRelationship,
  Feeling,
  MemoryType,
  MemoryValueMap,
  MutualRelationship,
  RelationshipRecord,
  SocialStatus,
} from '~/constants/character';

export interface RelationshipStore {
  mutualRelationships: MutualRelationship[];
  relationshipRecords: RelationshipRecord[];
}

const EMPTY_STARTED_BY_ID = '';
const IMPRESSION_COOLDOWN_MS = 60 * 1000;

export function createRelationshipStore(): RelationshipStore {
  return {
    mutualRelationships: [],
    relationshipRecords: [],
  };
}

export function rememberPassBy(
  relationships: DirectedRelationship[],
  charId: string,
  targetCharId: string,
  timestamp: number = Date.now(),
): DirectedRelationship[] {
  return upsertDirectedRelationship(
    relationships,
    charId,
    targetCharId,
    relationship => rememberImpression(relationship, timestamp),
    timestamp,
  );
}

function rememberImpression(
  relationship: DirectedRelationship,
  timestamp: number,
): DirectedRelationship {
  const impression = relationship.memories[MemoryType.Impression];

  if (
    impression.counts > 0
    && timestamp - impression.lastUpdate < IMPRESSION_COOLDOWN_MS
  ) {
    return relationship;
  }

  return {
    ...relationship,
    memories: {
      ...relationship.memories,
      [MemoryType.Impression]: {
        counts: impression.counts + 1,
        lastUpdate: timestamp,
      },
    },
  };
}

export function ensureMutualRelationship(
  store: RelationshipStore,
  charId: string,
  targetCharId: string,
  timestamp: number = Date.now(),
): RelationshipStore {
  const charIds = normalizeRelationshipPair(charId, targetCharId);

  if (!charIds) {
    return store;
  }

  const relationshipExists = store.mutualRelationships.some(relationship => (
    isSameRelationshipPair(relationship.charIds, charIds)
  ));

  if (relationshipExists) {
    return {
      ...store,
      relationshipRecords: ensureRelationshipRecord(store.relationshipRecords, charIds, timestamp),
    };
  }

  const mutualRelationship: MutualRelationship = {
    charIds,
    status: SocialStatus.Stranger,
    timestamp,
  };

  return {
    mutualRelationships: [...store.mutualRelationships, mutualRelationship],
    relationshipRecords: ensureRelationshipRecord(store.relationshipRecords, charIds, timestamp),
  };
}

export function updateMutualRelationshipStatus(
  store: RelationshipStore,
  charId: string,
  targetCharId: string,
  status: SocialStatus,
  timestamp: number = Date.now(),
): RelationshipStore {
  const charIds = normalizeRelationshipPair(charId, targetCharId);

  if (!charIds) {
    return store;
  }

  const ensuredStore = ensureMutualRelationship(store, charId, targetCharId, timestamp);

  return {
    mutualRelationships: ensuredStore.mutualRelationships.map(relationship => (
      isSameRelationshipPair(relationship.charIds, charIds)
        ? { ...relationship, status, timestamp }
        : relationship
    )),
    relationshipRecords: appendRelationshipRecord(
      ensuredStore.relationshipRecords,
      charIds,
      status,
      timestamp,
    ),
  };
}

export function recordPassByPair(
  store: RelationshipStore,
  charId: string,
  targetCharId: string,
  timestamp: number = Date.now(),
): RelationshipStore {
  return ensureMutualRelationship(store, charId, targetCharId, timestamp);
}

export function getRelationshipKey(charId: string, targetCharId: string): string | null {
  const charIds = normalizeRelationshipPair(charId, targetCharId);

  return charIds ? charIds.join('::') : null;
}

export function normalizeRelationshipPair(
  charId: string,
  targetCharId: string,
): [string, string] | null {
  if (charId === targetCharId) {
    return null;
  }

  return [charId, targetCharId].sort() as [string, string];
}

function upsertDirectedRelationship(
  relationships: DirectedRelationship[],
  charId: string,
  targetCharId: string,
  update: (relationship: DirectedRelationship) => DirectedRelationship,
  timestamp: number,
): DirectedRelationship[] {
  const existingRelationship = relationships.find(relationship => (
    relationship.charId === charId && relationship.targetCharId === targetCharId
  ));

  if (existingRelationship) {
    return relationships.map(relationship => (
      relationship === existingRelationship ? update(relationship) : relationship
    ));
  }

  return [
    ...relationships,
    update(createDirectedRelationship(charId, targetCharId, timestamp)),
  ];
}

export function createDirectedRelationship(
  charId: string,
  targetCharId: string,
  timestamp: number,
): DirectedRelationship {
  return {
    charId,
    targetCharId,
    feeling: Feeling.Neutral,
    intimacy: 0,
    memories: createMemoryValueMap(timestamp),
  };
}

export function createMemoryValueMap(timestamp: number): MemoryValueMap {
  return {
    [MemoryType.Impression]: {
      counts: 0,
      lastUpdate: timestamp,
    },
    [MemoryType.Argument]: {
      counts: 0,
      lastUpdate: timestamp,
      startedById: EMPTY_STARTED_BY_ID,
    },
    [MemoryType.Fight]: {
      counts: 0,
      lastUpdate: timestamp,
      startedById: EMPTY_STARTED_BY_ID,
    },
  };
}

function ensureRelationshipRecord(
  relationshipRecords: RelationshipRecord[],
  charIds: [string, string],
  timestamp: number,
): RelationshipRecord[] {
  const existingRecord = relationshipRecords.find(record => (
    isSameRelationshipPair(record.charIds, charIds)
  ));

  if (existingRecord) {
    return relationshipRecords;
  }

  return [
    ...relationshipRecords,
    {
      charIds,
      records: [
        {
          status: SocialStatus.Stranger,
          timestamp,
        },
      ],
    },
  ];
}

function appendRelationshipRecord(
  relationshipRecords: RelationshipRecord[],
  charIds: [string, string],
  status: SocialStatus,
  timestamp: number,
): RelationshipRecord[] {
  const records = ensureRelationshipRecord(relationshipRecords, charIds, timestamp);

  return records.map(record => {
    if (!isSameRelationshipPair(record.charIds, charIds)) {
      return record;
    }

    const latestRecord = record.records.at(-1);

    if (latestRecord?.status === status) {
      return record;
    }

    return {
      ...record,
      records: [
        ...record.records,
        {
          status,
          timestamp,
        },
      ],
    };
  });
}

function isSameRelationshipPair(
  left: [string, string],
  right: [string, string],
): boolean {
  return left[0] === right[0] && left[1] === right[1];
}
