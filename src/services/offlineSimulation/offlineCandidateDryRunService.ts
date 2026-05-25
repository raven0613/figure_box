import { CHARACTER_SEEDS } from '~/constants/character';
import { collectCharacterEventCandidates } from '~/services/characterEvents/buckets';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import { characterRuntimeSaveService, createDefaultCharacterRuntimeSnapshot } from '~/services/save/characterRuntimeSaveService';
import type { CharacterRuntimeSnapshot } from '~/services/save/saveTypes';
import { CharacterControlState } from '~/stateMachines/gameFlow/states';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { OFFLINE_SIMULATION_POLICY } from './offlineSimulationPolicy';
import { createOfflineSimulationPlan } from './offlineSimulationPlanner';
import { createOfflineSimulationRunPreview } from './offlineSimulationPreviewRunner';
import { createOfflineSimulationAggregatePreview } from './offlineSimulationAggregator';
import { createOfflineCandidateDebug } from './offlineCandidateDebugFactory';
import { createOfflineDecisionInput } from './offlineDecisionInputFactory';
import { normalizeOfflineBaselineSnapshots } from './offlineBaselineNormalizer';
import { offlineSessionService } from './offlineSessionService';
import type {
  OfflineSimulationDryRun,
} from './types';

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
  const runtimeSnapshotsByCharacterId = getRuntimeSnapshotsByCharacterId();
  const characterNameById = new Map(CHARACTER_SEEDS.map(character => [character.id, character.name]));
  const baseline = normalizeOfflineBaselineSnapshots({
    characterNameById,
    snapshots: CHARACTER_SEEDS.map(character => (
      runtimeSnapshotsByCharacterId.get(character.id) ?? createDefaultCharacterRuntimeSnapshot(character.id)
    )),
  });
  const contexts = baseline.snapshots.map(snapshot => createCharacterContext(snapshot));
  const simulationPreview = createOfflineSimulationRunPreview({
    plan,
    contexts,
    lastActiveAt: sessionSnapshot.lastActiveAt,
  });

  return {
    generatedAt: now,
    lastActiveAt: sessionSnapshot.lastActiveAt,
    elapsedMs,
    policyVersion: OFFLINE_SIMULATION_POLICY.version,
    plan,
    baselinePreview: baseline.preview,
    simulationPreview,
    aggregatePreview: createOfflineSimulationAggregatePreview({
      contexts,
      simulationPreview,
    }),
    characters: contexts.map(context => {
      const utilityScores = calculateCharacterUtilityScores(context);
      const input = createOfflineDecisionInput(context, contexts, now);
      const candidates = collectCharacterEventCandidates(context, utilityScores, input)
        .map(candidate => createOfflineCandidateDebug(candidate, context, input, contexts))
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
