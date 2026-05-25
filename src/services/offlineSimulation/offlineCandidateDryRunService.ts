import { CHARACTER_SEEDS, Feeling, SocialStatus, type Position } from '~/constants/character';
import { TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import { collectCharacterEventCandidates } from '~/services/characterEvents/buckets';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import type {
  CharacterEventCandidate,
  CharacterEventDecisionInput,
  CharacterEventNearbyRelationship,
  CharacterEventNearbyVisibleItem,
} from '~/services/characterEvents/types';
import { itemService } from '~/services/items/itemService';
import { characterRuntimeSaveService, createDefaultCharacterRuntimeSnapshot } from '~/services/save/characterRuntimeSaveService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import {
  OFFLINE_SIMULATION_POLICY,
  resolveOfflineEventPolicy,
} from './offlineSimulationPolicy';
import { createOfflineSimulationPlan } from './offlineSimulationPlanner';
import {
  getOfflineCandidateActivityType,
  resolveOfflineRecapTemplate,
} from './offlineRecapTemplates';
import { offlineSessionService } from './offlineSessionService';
import type {
  OfflineCharacterCandidateDebug,
  OfflineRecapPreview,
  OfflineSimulationDryRun,
} from './types';
import { normalizeRelationshipPair } from '~/stateMachines/gameFlow/relationships';

const NEARBY_CHARACTER_RANGE = 2;
const ITEM_VISIBILITY_RADIUS = 10;
const MAX_CANDIDATES_PER_CHARACTER = 12;

export function createOfflineSimulationDryRun(now: number = Date.now()): OfflineSimulationDryRun {
  const sessionSnapshot = offlineSessionService.getSnapshot();
  const elapsedMs = sessionSnapshot.lastObservedAwayMs;
  const plan = createOfflineSimulationPlan({
    elapsedMs,
    lastActiveAt: sessionSnapshot.lastActiveAt,
    now,
    policy: OFFLINE_SIMULATION_POLICY.elapsedTime,
  });
  const runtimeSnapshots = getRuntimeSnapshotsByCharacterId();
  const contexts = CHARACTER_SEEDS.map(character => createCharacterContext(
    runtimeSnapshots.get(character.id) ?? createDefaultCharacterRuntimeSnapshot(character.id),
  ));

  return {
    generatedAt: now,
    lastActiveAt: sessionSnapshot.lastActiveAt,
    elapsedMs,
    policyVersion: OFFLINE_SIMULATION_POLICY.version,
    plan,
    characters: contexts.map(context => {
      const utilityScores = calculateCharacterUtilityScores(context);
      const input = createDecisionInput(context, contexts, now);
      const candidates = collectCharacterEventCandidates(context, utilityScores, input)
        .map(candidate => createCandidateDebug(candidate, context, input, contexts))
        .sort((left, right) => right.offlineWeight - left.offlineWeight)
        .slice(0, MAX_CANDIDATES_PER_CHARACTER);

      return {
        characterId: context.id,
        characterName: context.name,
        elapsedMs: elapsedMs ?? 0,
        ignoredByElapsedTime: (elapsedMs ?? 0) < OFFLINE_SIMULATION_POLICY.elapsedTime.ignoreBelowMs,
        candidateCount: candidates.length,
        candidates,
      };
    }),
  };
}

function getRuntimeSnapshotsByCharacterId(): Map<string, CharacterRuntimeSnapshot> {
  return new Map(
    characterRuntimeSaveService.getRuntimeSnapshots()
      .map(snapshot => [snapshot.id, snapshot]),
  );
}

function createCharacterContext(snapshot: CharacterRuntimeSnapshot): CharacterContext {
  const seed = CHARACTER_SEEDS.find(character => character.id === snapshot.id);
  const ownItems = seed && 'ownItems' in seed ? [...(seed.ownItems ?? [])] : [];
  const contextWithoutUtilityScores = {
    id: snapshot.id,
    name: seed?.name ?? snapshot.id,
    ownItems,
    status: { ...snapshot.status },
    lastEventDecision: null,
    target: null,
    position: { ...snapshot.position },
    presence: clonePresence(snapshot.presence),
    currentMotivation: 'idle' as const,
    controlState: CharacterControlState.Normal,
    pendingActivityJoin: null,
    currentActivity: null,
    heldItem: snapshot.heldItem ? { ...snapshot.heldItem } : null,
    activityCooldowns: {
      categoryUntilByKey: { ...snapshot.activityCooldowns.categoryUntilByKey },
      pairUntilByKey: { ...snapshot.activityCooldowns.pairUntilByKey },
      repeatByKey: Object.fromEntries(
        Object.entries(snapshot.activityCooldowns.repeatByKey).map(([key, record]) => [
          key,
          { ...record },
        ]),
      ),
    },
    relationships: snapshot.relationships.map(relationship => ({
      ...relationship,
      memories: {
        impression: { ...relationship.memories.impression },
        argument: { ...relationship.memories.argument },
        fight: { ...relationship.memories.fight },
      },
    })),
    locks: {
      bodyAction: [...snapshot.locks.bodyAction],
      bodyMove: [...snapshot.locks.bodyMove],
      mind: [...snapshot.locks.mind],
      communication: [...snapshot.locks.communication],
    },
  };

  return {
    ...contextWithoutUtilityScores,
    utilityScores: calculateCharacterUtilityScores({
      ...contextWithoutUtilityScores,
      utilityScores: {
        idle: 0,
        findFood: 0,
        rest: 0,
        play: 0,
        chat: 0,
        goHome: 0,
      },
    }),
  };
}

function clonePresence(
  presence: CharacterRuntimeSnapshot['presence'],
): CharacterRuntimeSnapshot['presence'] {
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

function createDecisionInput(
  context: CharacterContext,
  contexts: readonly CharacterContext[],
  timestamp: number,
): CharacterEventDecisionInput {
  const nearbyCharacterIds = getNearbyCharacterIds(context, contexts);

  return {
    nearbyCharacterIds,
    nearbyRelationships: getNearbyRelationships(context, nearbyCharacterIds),
    nearbyVisibleItems: getNearbyVisibleItems(context),
    ownItemIds: itemService.getActorItems(context.id)
      .filter(item => item.state === 'stored' || item.state === 'held')
      .map(item => item.definitionId),
    nearbyJoinableActivities: [],
    timestamp,
  };
}

function getNearbyCharacterIds(
  context: CharacterContext,
  contexts: readonly CharacterContext[],
): string[] {
  if (context.presence.kind !== 'positioned') {
    return [];
  }

  return contexts
    .filter(candidate => (
      candidate.id !== context.id &&
      candidate.presence.kind === 'positioned' &&
      candidate.presence.spaceId === context.presence.spaceId &&
      getDistance(context.position, candidate.position) <= NEARBY_CHARACTER_RANGE
    ))
    .map(candidate => candidate.id);
}

function getNearbyRelationships(
  context: CharacterContext,
  nearbyCharacterIds: readonly string[],
): CharacterEventNearbyRelationship[] {
  return nearbyCharacterIds.map(characterId => {
    const relationship = context.relationships.find(candidate => candidate.targetCharId === characterId);
    const mutualRelationship = getMutualRelationshipStatus(context.id, characterId);

    return {
      characterId,
      feeling: relationship?.feeling ?? Feeling.Neutral,
      intimacy: relationship?.intimacy ?? 0,
      socialStatus: mutualRelationship,
    };
  });
}

function getMutualRelationshipStatus(characterId: string, targetCharacterId: string): SocialStatus {
  const relationshipPair = normalizeRelationshipPair(characterId, targetCharacterId);

  if (!relationshipPair) {
    return SocialStatus.Stranger;
  }

  return relationshipStoreService.getSnapshot().mutualRelationships.find(relationship => (
    relationship.charIds[0] === relationshipPair[0] &&
    relationship.charIds[1] === relationshipPair[1]
  ))?.status ?? SocialStatus.Stranger;
}

function getNearbyVisibleItems(context: CharacterContext): CharacterEventNearbyVisibleItem[] {
  if (context.presence.kind !== 'positioned' || context.presence.spaceId !== TOWN_WORLD_SPACE_ID) {
    return [];
  }

  return itemService.getPlacedObjects(TOWN_WORLD_SPACE_ID)
    .flatMap(placedObject => {
      if (!placedObject.worldPosition) {
        return [];
      }

      const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);
      const definition = itemInstance ? itemService.getDefinition(itemInstance.definitionId) : null;

      if (!itemInstance || !definition) {
        return [];
      }

      const distance = getDistance(context.position, placedObject.worldPosition);

      if (distance > ITEM_VISIBILITY_RADIUS) {
        return [];
      }

      return [{
        placedObjectId: placedObject.id,
        itemInstanceId: itemInstance.id,
        definitionId: definition.id,
        category: definition.category,
        tags: definition.tags,
        rarity: definition.rarity,
        position: {
          x: placedObject.worldPosition.x,
          y: placedObject.worldPosition.y,
        },
        distance,
      }];
    });
}

function createCandidateDebug(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): OfflineCharacterCandidateDebug {
  const policy = resolveOfflineEventPolicy(OFFLINE_SIMULATION_POLICY, candidate);
  const offlineWeight = policy.enabled ? candidate.weight * policy.weightMultiplier : 0;
  const activityType = getOfflineCandidateActivityType(candidate);

  return {
    id: candidate.id,
    bucketId: candidate.bucketId,
    motivation: candidate.motivation,
    onlineWeight: roundWeight(candidate.weight),
    offlineWeight: roundWeight(offlineWeight),
    policy,
    eventType: candidate.event.type,
    activityType,
    recapPreview: policy.recap === 'none'
      ? null
      : createRecapPreview(candidate, context, input, contexts),
  };
}

function createRecapPreview(
  candidate: CharacterEventCandidate,
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): OfflineRecapPreview {
  const resolvedTemplate = resolveOfflineRecapTemplate(candidate);
  const variables = createTemplateVariables(context, input, contexts);

  return {
    templateSource: resolvedTemplate.source,
    summary: formatTemplate(resolvedTemplate.template.summary, variables),
    detail: resolvedTemplate.template.detail
      ? formatTemplate(resolvedTemplate.template.detail, variables)
      : undefined,
    quote: resolvedTemplate.template.quote
      ? formatTemplate(resolvedTemplate.template.quote, variables)
      : undefined,
  };
}

function createTemplateVariables(
  context: CharacterContext,
  input: CharacterEventDecisionInput,
  contexts: readonly CharacterContext[],
): Record<string, string> {
  const targetCharacterId = input.nearbyCharacterIds?.[0] ?? '';
  const targetContext = contexts.find(candidate => candidate.id === targetCharacterId);
  const itemName = input.ownItemIds?.[0] ?? input.nearbyVisibleItems?.[0]?.definitionId ?? '物品';

  return {
    characterName: context.name,
    initiatorName: context.name,
    targetName: targetContext?.name ?? '附近的人',
    itemName,
    locationName: '附近',
  };
}

function formatTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (_, key: string) => variables[key] ?? `{${key}}`);
}

function getDistance(left: Position, right: Position): number {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function roundWeight(value: number): number {
  return Math.round(value * 1000) / 1000;
}
