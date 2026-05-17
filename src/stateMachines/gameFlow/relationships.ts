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
const MIN_INTIMACY = -100;
const MAX_INTIMACY = 100;

export interface RelationshipStageThreshold<TStage extends string> {
  minIntimacy: number;
  stage: TStage;
}

export const FEELING_INTIMACY_THRESHOLDS: readonly RelationshipStageThreshold<Feeling>[] = [
  { minIntimacy: -100, stage: Feeling.Hate },
  { minIntimacy: -70, stage: Feeling.Dislike },
  { minIntimacy: -40, stage: Feeling.Wary },
  { minIntimacy: -10, stage: Feeling.Neutral },
  { minIntimacy: 10, stage: Feeling.Warm },
  { minIntimacy: 25, stage: Feeling.Like },
  { minIntimacy: 45, stage: Feeling.Fond },
  { minIntimacy: 65, stage: Feeling.SecretCrush },
  { minIntimacy: 80, stage: Feeling.OpenCrush },
  { minIntimacy: 95, stage: Feeling.Love },
];

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

export function changeRelationshipIntimacy(
  relationships: DirectedRelationship[],
  charId: string,
  targetCharId: string,
  delta: number,
  timestamp: number = Date.now(),
): DirectedRelationship[] {
  if (delta === 0) {
    return relationships;
  }

  return upsertDirectedRelationship(
    relationships,
    charId,
    targetCharId,
    relationship => updateDirectedRelationshipIntimacy(relationship, delta),
    timestamp,
  );
}

export function getFeelingForIntimacy(intimacy: number): Feeling {
  return getRelationshipStageForIntimacy(
    FEELING_INTIMACY_THRESHOLDS,
    intimacy,
    Feeling.Neutral,
  );
}

export function getFeelingMinIntimacy(feeling: Feeling): number {
  return FEELING_INTIMACY_THRESHOLDS.find(threshold => threshold.stage === feeling)
    ?.minIntimacy ?? 0;
}

export function decreaseRelationshipIntimacyToFeelingMin(
  relationships: DirectedRelationship[],
  charId: string,
  targetCharId: string,
  feeling: Feeling,
  timestamp: number = Date.now(),
): DirectedRelationship[] {
  return upsertDirectedRelationship(
    relationships,
    charId,
    targetCharId,
    relationship => decreaseDirectedRelationshipIntimacyToFeelingMin(relationship, feeling),
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
    intimacy: 0,
    feeling: getFeelingForIntimacy(0),
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

function updateDirectedRelationshipIntimacy(
  relationship: DirectedRelationship,
  delta: number,
): DirectedRelationship {
  const intimacy = clampIntimacy(relationship.intimacy + delta);

  return {
    ...relationship,
    intimacy,
    feeling: getFeelingForIntimacy(intimacy),
  };
}

function decreaseDirectedRelationshipIntimacyToFeelingMin(
  relationship: DirectedRelationship,
  feeling: Feeling,
): DirectedRelationship {
  const intimacy = Math.min(relationship.intimacy, getFeelingMinIntimacy(feeling));

  return {
    ...relationship,
    intimacy,
    feeling: getFeelingForIntimacy(intimacy),
  };
}

function clampIntimacy(intimacy: number): number {
  return Math.max(MIN_INTIMACY, Math.min(MAX_INTIMACY, intimacy));
}

function getRelationshipStageForIntimacy<TStage extends string>(
  thresholds: readonly RelationshipStageThreshold<TStage>[],
  intimacy: number,
  fallbackStage: TStage,
): TStage {
  const clampedIntimacy = clampIntimacy(intimacy);

  for (let index = thresholds.length - 1; index >= 0; index -= 1) {
    const threshold = thresholds[index];

    if (clampedIntimacy >= threshold.minIntimacy) {
      return threshold.stage;
    }
  }

  return fallbackStage;
}
