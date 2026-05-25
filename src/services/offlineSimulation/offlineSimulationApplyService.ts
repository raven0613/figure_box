import { characterRuntimeSaveService } from '~/services/save/characterRuntimeSaveService';
import { offlineRecapSaveService } from '~/services/save/offlineRecapSaveService';
import type { OfflineRecapSaveRecord } from '~/services/save/saveTypes';
import type {
  OfflineFinalCharacterStatePreview,
  OfflineRecapListItemPreview,
  OfflineSimulationDryRun,
} from './types';

export type OfflineSimulationApplyFailureReason =
  | 'planIgnoredByElapsedTime'
  | 'noEvents'
  | 'unsupportedEvents'
  | 'alreadyApplied';

export type OfflineSimulationApplyResult =
  | {
    success: true;
    simulationSeed: string;
    appliedCharacterCount: number;
    recapCount: number;
    appliedAt: number;
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

  if (dryRun.simulationPreview.events.length === 0) {
    return {
      success: false,
      simulationSeed,
      reason: 'noEvents',
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

  appliedPreviews.forEach(preview => {
    characterRuntimeSaveService.applyOfflineFinalStatePreview(preview);
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
    recapCount: addedRecapRecords.length,
    appliedAt: timestamp,
  };
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
    timestamp: input.recap.timestamp,
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
