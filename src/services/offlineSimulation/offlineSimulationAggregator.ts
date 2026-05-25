import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { OFFLINE_SIMULATION_POLICY } from './offlineSimulationPolicy';
import type {
  OfflineFinalCharacterStatePreview,
  OfflineNumericPatchPreview,
  OfflineRecapListItemPreview,
  OfflineSimulationAggregatePreview,
  OfflineSimulationPreviewEvent,
  OfflineSimulationRunPreview,
  OfflineStatusPatchPreview,
} from './types';

export function createOfflineSimulationAggregatePreview(input: {
  contexts: readonly CharacterContext[];
  simulationPreview: OfflineSimulationRunPreview;
}): OfflineSimulationAggregatePreview {
  const contextsById = new Map(input.contexts.map(context => [context.id, context]));
  const finalStateByCharacterId = createInitialFinalStatePreview(input.contexts);

  input.simulationPreview.events.forEach(event => {
    const context = contextsById.get(event.characterId);
    const currentPreview = finalStateByCharacterId[event.characterId];

    if (!context || !currentPreview) {
      return;
    }

    if (event.resolutionPreview.kind !== 'solo') {
      finalStateByCharacterId[event.characterId] = {
        ...currentPreview,
        unsupportedEventIds: [...currentPreview.unsupportedEventIds, event.eventId],
      };
      return;
    }

    finalStateByCharacterId[event.characterId] = {
      ...currentPreview,
      statusPatch: mergeStatusPatch(currentPreview.statusPatch, event.resolutionPreview.statusPatch),
      position: event.resolutionPreview.positionPatch?.target
        ? {
          from: currentPreview.position?.from ?? { ...context.position },
          to: { ...event.resolutionPreview.positionPatch.target },
          mode: event.resolutionPreview.positionPatch.mode,
          reason: event.resolutionPreview.positionPatch.reason,
        }
        : currentPreview.position,
      presence: event.resolutionPreview.positionPatch?.mode === 'contained' && event.resolutionPreview.positionPatch.spaceId
        ? {
          from: context.presence.spaceId,
          to: event.resolutionPreview.positionPatch.spaceId,
          kind: 'contained',
        }
        : currentPreview.presence,
      appliedEventIds: [...currentPreview.appliedEventIds, event.eventId],
    };
  });

  const recapListPreview = createRecapListPreview(input.simulationPreview.events);
  const unsupportedEventIds = Object.values(finalStateByCharacterId)
    .flatMap(preview => [...preview.unsupportedEventIds]);

  return {
    finalStateByCharacterId,
    recapListPreview,
    applyReadiness: {
      canApplyAll: unsupportedEventIds.length === 0,
      eventCount: input.simulationPreview.events.length,
      supportedEventCount: input.simulationPreview.events.length - unsupportedEventIds.length,
      unsupportedEventCount: unsupportedEventIds.length,
      unsupportedEventIds,
    },
  };
}

function createInitialFinalStatePreview(
  contexts: readonly CharacterContext[],
): Record<string, OfflineFinalCharacterStatePreview> {
  return Object.fromEntries(
    contexts.map(context => [
      context.id,
      {
        characterId: context.id,
        characterName: context.name,
        statusPatch: null,
        position: null,
        presence: null,
        appliedEventIds: [],
        unsupportedEventIds: [],
      },
    ]),
  );
}

function mergeStatusPatch(
  currentPatch: OfflineStatusPatchPreview | null,
  nextPatch: OfflineStatusPatchPreview | null,
): OfflineStatusPatchPreview | null {
  if (!nextPatch) {
    return currentPatch;
  }

  return {
    saturation: mergeOptionalNumericPatch(currentPatch?.saturation, nextPatch.saturation),
    moodValue: mergeOptionalNumericPatch(currentPatch?.moodValue, nextPatch.moodValue),
    playNeed: mergeOptionalNumericPatch(currentPatch?.playNeed, nextPatch.playNeed),
  };
}

function mergeOptionalNumericPatch(
  currentPatch: OfflineNumericPatchPreview | undefined,
  nextPatch: OfflineNumericPatchPreview | undefined,
): OfflineNumericPatchPreview | undefined {
  if (!nextPatch) {
    return currentPatch;
  }

  const from = currentPatch?.from ?? nextPatch.from;

  return {
    from,
    to: nextPatch.to,
    delta: nextPatch.to - from,
  };
}

function createRecapListPreview(
  events: readonly OfflineSimulationPreviewEvent[],
): OfflineRecapListItemPreview[] {
  return events
    .filter(event => event.recapPreview)
    .slice(0, OFFLINE_SIMULATION_POLICY.recap.maxItems)
    .map((event, index) => {
      const recapPreview = event.recapPreview;
      const canKeepDetail = index < OFFLINE_SIMULATION_POLICY.recap.maxDetailedItems;

      return {
        eventId: event.eventId,
        characterId: event.characterId,
        characterName: event.characterName,
        timestamp: event.timestamp,
        summary: recapPreview?.summary ?? '',
        detail: canKeepDetail ? recapPreview?.detail : undefined,
        quote: canKeepDetail ? recapPreview?.quote : undefined,
        hasDetail: canKeepDetail && Boolean(recapPreview?.detail || recapPreview?.quote),
      };
    });
}
