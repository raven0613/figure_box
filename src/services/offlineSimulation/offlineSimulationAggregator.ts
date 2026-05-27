import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type {
  CharacterEventActivityType,
} from '~/constants/charactarEventsDefinitions';
import { OFFLINE_SIMULATION_POLICY } from './offlineSimulationPolicy';
import type {
  OfflineFinalCharacterStatePreview,
  OfflineNumericPatchPreview,
  OfflineParticipantResolutionPreview,
  OfflineRecapListItemPreview,
  OfflineRelationshipPatchPreview,
  OfflineSimulationAggregatePreview,
  OfflineSimulationPreviewEvent,
  OfflineSimulationRunPreview,
  OfflineStatusPatchPreview,
} from './types';
import { createSeededRandom } from './offlineRandom';
import {
  getOfflineTimeBucketKey,
  getOfflineTimeBucketOrder,
} from './offlineTimeOfDay';

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

    if (event.resolutionPreview.kind === 'unsupported') {
      finalStateByCharacterId[event.characterId] = {
        ...currentPreview,
        unsupportedEventIds: [...currentPreview.unsupportedEventIds, event.eventId],
      };
      return;
    }

    if (event.resolutionPreview.kind === 'solo') {
      finalStateByCharacterId[event.characterId] = applyParticipantResolutionPreview({
        currentPreview,
        context,
        eventId: event.eventId,
        participant: {
          characterId: event.characterId,
          characterName: event.characterName,
          statusPatch: event.resolutionPreview.statusPatch,
          positionPatch: event.resolutionPreview.positionPatch,
          currentMotivation: event.resolutionPreview.currentMotivation,
          relationshipPatches: [],
          activityCooldownRecord: null,
        },
      });
      return;
    }

    event.resolutionPreview.participants.forEach(participant => {
      const participantContext = contextsById.get(participant.characterId);
      const participantPreview = finalStateByCharacterId[participant.characterId];

      if (!participantContext || !participantPreview) {
        return;
      }

      finalStateByCharacterId[participant.characterId] = applyParticipantResolutionPreview({
        currentPreview: participantPreview,
        context: participantContext,
        eventId: event.eventId,
        participant,
      });
    });
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
        relationshipPatches: [],
        activityCooldownRecords: [],
        appliedEventIds: [],
        unsupportedEventIds: [],
      },
    ]),
  );
}

function applyParticipantResolutionPreview(input: {
  currentPreview: OfflineFinalCharacterStatePreview;
  context: CharacterContext;
  eventId: string;
  participant: OfflineParticipantResolutionPreview;
}): OfflineFinalCharacterStatePreview {
  return {
    ...input.currentPreview,
    statusPatch: mergeStatusPatch(input.currentPreview.statusPatch, input.participant.statusPatch),
    position: input.participant.positionPatch?.target
      ? {
        from: input.currentPreview.position?.from ?? { ...input.context.position },
        to: { ...input.participant.positionPatch.target },
        mode: input.participant.positionPatch.mode,
        reason: input.participant.positionPatch.reason,
      }
      : input.currentPreview.position,
    presence: input.participant.positionPatch?.mode === 'contained' && input.participant.positionPatch.spaceId
      ? {
        from: input.context.presence.spaceId,
        to: input.participant.positionPatch.spaceId,
        kind: 'contained',
      }
      : input.currentPreview.presence,
    relationshipPatches: mergeRelationshipPatches(
      input.currentPreview.relationshipPatches,
      input.participant.relationshipPatches,
    ),
    activityCooldownRecords: input.participant.activityCooldownRecord
      ? [
        ...input.currentPreview.activityCooldownRecords,
        input.participant.activityCooldownRecord,
      ]
      : input.currentPreview.activityCooldownRecords,
    appliedEventIds: [...input.currentPreview.appliedEventIds, input.eventId],
  };
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

function mergeRelationshipPatches(
  currentPatches: readonly OfflineRelationshipPatchPreview[],
  nextPatches: readonly OfflineRelationshipPatchPreview[],
): OfflineRelationshipPatchPreview[] {
  return nextPatches.reduce<OfflineRelationshipPatchPreview[]>((mergedPatches, nextPatch) => {
    const existingPatch = mergedPatches.find(patch => patch.targetCharacterId === nextPatch.targetCharacterId);

    if (!existingPatch) {
      return [...mergedPatches, nextPatch];
    }

    return mergedPatches.map(patch => (
      patch.targetCharacterId === nextPatch.targetCharacterId
        ? {
          ...patch,
          intimacyDelta: patch.intimacyDelta + nextPatch.intimacyDelta,
          feelingTarget: nextPatch.feelingTarget ?? patch.feelingTarget,
          timestamp: nextPatch.timestamp,
        }
        : patch
    ));
  }, [...currentPatches]);
}

function createRecapListPreview(
  events: readonly OfflineSimulationPreviewEvent[],
): OfflineRecapListItemPreview[] {
  return orderRecapDisplayEvents(selectRecapDisplayEvents(events), events)
    .map((event, index) => createRecapListItemPreview(event, index));
}

interface RecapDisplayEventEntry {
  event: OfflineSimulationPreviewEvent;
  sequence: number;
  bucketKey: string;
  bucketOrder: number;
}

function orderRecapDisplayEvents(
  selectedEvents: readonly OfflineSimulationPreviewEvent[],
  allEvents: readonly OfflineSimulationPreviewEvent[],
): OfflineSimulationPreviewEvent[] {
  const entries = selectedEvents.map<RecapDisplayEventEntry>(event => ({
    event,
    sequence: getEventSequence(event, allEvents),
    bucketKey: getOfflineTimeBucketKey(event.timestamp, OFFLINE_SIMULATION_POLICY),
    bucketOrder: getOfflineTimeBucketOrder(event.timestamp, OFFLINE_SIMULATION_POLICY),
  }));

  if (OFFLINE_SIMULATION_POLICY.recap.displayOrder.mode === 'timestamp') {
    return entries
      .sort(compareRecapEntrySequence)
      .map(entry => entry.event);
  }

  return createTimeBucketGroups(entries)
    .sort(compareRecapBucketGroups)
    .flatMap(group => shuffleRecapBucketGroup(group.entries, group.bucketKey))
    .map(entry => entry.event);
}

interface RecapBucketGroup {
  bucketKey: string;
  bucketOrder: number;
  entries: readonly RecapDisplayEventEntry[];
}

function createTimeBucketGroups(entries: readonly RecapDisplayEventEntry[]): RecapBucketGroup[] {
  const groupsByKey = entries.reduce<Map<string, RecapDisplayEventEntry[]>>((groups, entry) => {
    const currentEntries = groups.get(entry.bucketKey) ?? [];

    groups.set(entry.bucketKey, [...currentEntries, entry]);
    return groups;
  }, new Map());

  return Array.from(groupsByKey.entries()).map(([bucketKey, groupEntries]) => ({
    bucketKey,
    bucketOrder: Math.min(...groupEntries.map(entry => entry.bucketOrder)),
    entries: groupEntries,
  }));
}

function shuffleRecapBucketGroup(
  entries: readonly RecapDisplayEventEntry[],
  bucketKey: string,
): RecapDisplayEventEntry[] {
  const sequenceBlocks = createRecapSequenceBlocks(entries);
  const random = createSeededRandom(createRecapShuffleSeed(bucketKey, entries));

  return shuffleArray(sequenceBlocks, random).flatMap(block => block.entries);
}

interface RecapSequenceBlock {
  entries: readonly RecapDisplayEventEntry[];
}

function createRecapSequenceBlocks(entries: readonly RecapDisplayEventEntry[]): RecapSequenceBlock[] {
  const sortedEntries = [...entries].sort(compareRecapEntrySequence);
  const blocksByKey = sortedEntries.reduce<Map<string, RecapDisplayEventEntry[]>>((blocks, entry) => {
    const sequenceKey = entry.event.recapPreview?.sequenceKey ?? createEventSelectionKey(entry.event);
    const blockEntries = blocks.get(sequenceKey) ?? [];

    blocks.set(sequenceKey, [...blockEntries, entry]);
    return blocks;
  }, new Map());

  return Array.from(blocksByKey.values()).map(blockEntries => ({
    entries: [...blockEntries].sort(compareRecapSequenceBlockEntries),
  }));
}

function compareRecapSequenceBlockEntries(
  left: RecapDisplayEventEntry,
  right: RecapDisplayEventEntry,
): number {
  return (left.event.recapPreview?.sequenceOrder ?? left.sequence) -
    (right.event.recapPreview?.sequenceOrder ?? right.sequence) ||
    left.sequence - right.sequence;
}

function compareRecapEntrySequence(
  left: RecapDisplayEventEntry,
  right: RecapDisplayEventEntry,
): number {
  return left.sequence - right.sequence;
}

function compareRecapBucketGroups(
  left: RecapBucketGroup,
  right: RecapBucketGroup,
): number {
  return left.bucketOrder - right.bucketOrder || left.bucketKey.localeCompare(right.bucketKey);
}

function createRecapShuffleSeed(
  bucketKey: string,
  entries: readonly RecapDisplayEventEntry[],
): string {
  return [
    'offline-recap-display',
    bucketKey,
    entries.map(entry => createEventSelectionKey(entry.event)).join('|'),
  ].join(':');
}

function shuffleArray<T>(
  items: readonly T[],
  random: () => number,
): T[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const currentItem = shuffledItems[index];

    shuffledItems[index] = shuffledItems[swapIndex];
    shuffledItems[swapIndex] = currentItem;
  }

  return shuffledItems;
}

function selectRecapDisplayEvents(
  events: readonly OfflineSimulationPreviewEvent[],
): OfflineSimulationPreviewEvent[] {
  const recapEvents = events
    .filter(event => event.recapPreview)
    .map((event, sequence) => ({
      event,
      score: calculateRecapDisplayScore(event),
      sequence,
    }));
  const multiplayerSelections = recapEvents
    .filter(item => isMultiplayerEvent(item.event))
    .sort(compareRecapSelectionItems)
    .slice(0, OFFLINE_SIMULATION_POLICY.recap.preferredMultiplayerItems);
  const selectedKeys = new Set(multiplayerSelections.map(item => createEventSelectionKey(item.event)));
  const soloSelections = recapEvents
    .filter(item => !selectedKeys.has(createEventSelectionKey(item.event)) && !isMultiplayerEvent(item.event))
    .sort(compareRecapSelectionItems)
    .slice(0, OFFLINE_SIMULATION_POLICY.recap.preferredSoloItems);
  const primarySelections = [...multiplayerSelections, ...soloSelections];
  const primaryKeys = new Set(primarySelections.map(item => createEventSelectionKey(item.event)));
  const fallbackSelections = recapEvents
    .filter(item => !primaryKeys.has(createEventSelectionKey(item.event)))
    .sort(compareRecapSelectionItems)
    .slice(0, Math.max(0, OFFLINE_SIMULATION_POLICY.recap.maxItems - primarySelections.length));

  return [...primarySelections, ...fallbackSelections]
    .slice(0, OFFLINE_SIMULATION_POLICY.recap.maxItems)
    .map(item => item.event);
}

function createRecapListItemPreview(
  event: OfflineSimulationPreviewEvent,
  index: number,
): OfflineRecapListItemPreview {
  const recapPreview = event.recapPreview;
  const canKeepDetail = index < OFFLINE_SIMULATION_POLICY.recap.maxDetailedItems;

  return {
    eventId: event.eventId,
    characterId: event.characterId,
    characterName: event.characterName,
    participantIds: getEventParticipantIds(event),
    participantNames: getEventParticipantNames(event),
    timestamp: event.timestamp,
    summary: recapPreview?.summary ?? '',
    detail: canKeepDetail ? recapPreview?.detail : undefined,
    quote: canKeepDetail ? recapPreview?.quote : undefined,
    hasDetail: canKeepDetail && Boolean(recapPreview?.detail || recapPreview?.quote),
  };
}

function calculateRecapDisplayScore(event: OfflineSimulationPreviewEvent): number {
  const scorePolicy = OFFLINE_SIMULATION_POLICY.recap.displayScore;
  const activityType = event.activityType;

  return scorePolicy.base +
    (isMultiplayerEvent(event) ? scorePolicy.multiplayerBonus : 0) +
    Math.max(0, getEventParticipantIds(event).length - 1) * scorePolicy.participantBonus +
    (activityType ? getActivityTypeScore(activityType) : 0) +
    (event.recapPreview?.detail ? scorePolicy.detailBonus : 0) +
    (event.recapPreview?.quote ? scorePolicy.quoteBonus : 0) +
    (event.recapPreview?.priority ?? 0);
}

function compareRecapSelectionItems(
  left: { score: number; sequence: number },
  right: { score: number; sequence: number },
): number {
  return right.score - left.score || left.sequence - right.sequence;
}

function getActivityTypeScore(activityType: CharacterEventActivityType): number {
  return OFFLINE_SIMULATION_POLICY.recap.displayScore.activityType[activityType] ?? 0;
}

function isMultiplayerEvent(event: OfflineSimulationPreviewEvent): boolean {
  return event.resolutionPreview.kind === 'group' &&
    event.resolutionPreview.participantIds.length > 1;
}

function createEventSelectionKey(event: OfflineSimulationPreviewEvent): string {
  return `${event.eventId}:${event.characterId}:${String(event.timestamp)}`;
}

function getEventSequence(
  event: OfflineSimulationPreviewEvent,
  events: readonly OfflineSimulationPreviewEvent[],
): number {
  return events.findIndex(candidate => candidate === event);
}

function getEventParticipantIds(event: OfflineSimulationPreviewEvent): readonly string[] {
  return event.resolutionPreview.kind === 'group'
    ? event.resolutionPreview.participantIds
    : [event.characterId];
}

function getEventParticipantNames(event: OfflineSimulationPreviewEvent): readonly string[] {
  return event.resolutionPreview.kind === 'group'
    ? event.resolutionPreview.participants.map(participant => participant.characterName)
    : [event.characterName];
}
