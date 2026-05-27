import { CHARACTER_SEEDS } from '~/constants/character';
import {
  characterRuntimeSaveService,
  createDefaultCharacterRuntimeSnapshot,
} from '~/services/save/characterRuntimeSaveService';
import { offlineRecapSaveService } from '~/services/save/offlineRecapSaveService';
import type {
  CharacterRuntimeSnapshot,
  OfflineRecapSaveRecord,
} from '~/services/save/saveTypes';
import { normalizeOfflineBaselineSnapshots } from './offlineBaselineNormalizer';
import type {
  OfflineFinalCharacterStatePreview,
  OfflineRecapListItemPreview,
  OfflineSimulationDryRun,
} from './types';

export type OfflineSimulationApplyFailureReason =
  | 'planIgnoredByElapsedTime'
  | 'unsupportedEvents'
  | 'alreadyApplied';

export type OfflineSimulationApplyResult =
  | {
    success: true;
    simulationSeed: string;
    appliedCharacterCount: number;
    baselineNormalizedCount: number;
    recapCount: number;
    appliedAt: number;
    appliedRuntimeSnapshots: readonly CharacterRuntimeSnapshot[];
  }
  | {
    success: false;
    simulationSeed: string;
    reason: OfflineSimulationApplyFailureReason;
  };

export async function applyOfflineSimulationDryRun(
  dryRun: OfflineSimulationDryRun,
  timestamp: number = Date.now(),
): Promise<OfflineSimulationApplyResult> {
  const simulationSeed = dryRun.simulationPreview.seed;

  if (dryRun.plan.ignored) {
    return {
      success: false,
      simulationSeed,
      reason: 'planIgnoredByElapsedTime',
    };
  }

  if (!dryRun.aggregatePreview.applyReadiness.canApplyAll) {
    return {
      success: false,
      simulationSeed,
      reason: 'unsupportedEvents',
    };
  }

  if (offlineRecapSaveService.hasSimulationSeed(simulationSeed)) {
    return {
      success: false,
      simulationSeed,
      reason: 'alreadyApplied',
    };
  }

  const appliedPreviews = Object.values(dryRun.aggregatePreview.finalStateByCharacterId)
    .filter(hasAppliedEvents);
  const baseline = createCurrentOfflineBaseline();
  const runtimeSnapshotsById = new Map(
    baseline.snapshots.map(snapshot => {
      const nextSnapshot = characterRuntimeSaveService.applyOfflineBaselineSnapshot(snapshot);

      return [nextSnapshot.id, nextSnapshot];
    }),
  );

  appliedPreviews.forEach(preview => {
    const nextSnapshot = characterRuntimeSaveService.applyOfflineFinalStatePreview(preview);

    runtimeSnapshotsById.set(nextSnapshot.id, nextSnapshot);
  });

  const recapRecords = dryRun.aggregatePreview.recapListPreview
    .map((recap, index) => createOfflineRecapSaveRecord({
      recap,
      simulationSeed,
      index,
      timestamp,
    }));

  const addedRecapRecords = offlineRecapSaveService.addRecords(recapRecords);

  return {
    success: true,
    simulationSeed,
    appliedCharacterCount: appliedPreviews.length,
    baselineNormalizedCount: baseline.preview.normalizedCharacterCount,
    recapCount: addedRecapRecords.length,
    appliedAt: timestamp,
    appliedRuntimeSnapshots: Array.from(runtimeSnapshotsById.values()),
  };
}

function createCurrentOfflineBaseline() {
  const runtimeSnapshotsByCharacterId = new Map(
    characterRuntimeSaveService.getRuntimeSnapshots().map(snapshot => [snapshot.id, snapshot]),
  );
  const characterNameById = new Map(CHARACTER_SEEDS.map(character => [character.id, character.name]));

  return normalizeOfflineBaselineSnapshots({
    characterNameById,
    snapshots: CHARACTER_SEEDS.map(character => (
      runtimeSnapshotsByCharacterId.get(character.id) ??
      createDefaultCharacterRuntimeSnapshot(character.id)
    )),
  });
}

function hasAppliedEvents(
  preview: OfflineFinalCharacterStatePreview,
): boolean {
  return preview.appliedEventIds.length > 0;
}

function createOfflineRecapSaveRecord(input: {
  recap: OfflineRecapListItemPreview;
  simulationSeed: string;
  index: number;
  timestamp: number;
}): OfflineRecapSaveRecord {
  return {
    id: createOfflineRecapId(input.simulationSeed, input.index),
    simulationSeed: input.simulationSeed,
    eventId: input.recap.eventId,
    characterId: input.recap.characterId,
    characterName: input.recap.characterName,
    participantIds: [...input.recap.participantIds],
    participantNames: [...input.recap.participantNames],
    timestamp: input.recap.timestamp,
    displayIndex: input.index,
    summary: input.recap.summary,
    ...(input.recap.detail ? { detail: input.recap.detail } : {}),
    ...(input.recap.quote ? { quote: input.recap.quote } : {}),
    isRead: false,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
}

function createOfflineRecapId(simulationSeed: string, index: number): string {
  const safeSeed = simulationSeed.replace(/[^a-zA-Z0-9_-]/g, '_');

  return `offline-recap-${safeSeed}-${String(index)}`;
}
