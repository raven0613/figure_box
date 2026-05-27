import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import { calculateCharacterUtilityScores } from '~/services/characterEvents/utility';
import { collectCharacterEventCandidates } from '~/services/characterEvents/buckets';
import { WeightedDecisionSelector } from '~/services/decisionSelector';
import { OFFLINE_SIMULATION_POLICY } from './offlineSimulationPolicy';
import { createOfflineCandidateDebug } from './offlineCandidateDebugFactory';
import { createOfflineDecisionInput } from './offlineDecisionInputFactory';
import { createSeededRandom } from './offlineRandom';
import type {
  OfflineCharacterCandidateDebug,
  OfflineSimulationPlan,
  OfflineSimulationPreviewEvent,
  OfflineSimulationPreviewSuppressedEvent,
  OfflineSimulationRunPreview,
} from './types';

const selector = new WeightedDecisionSelector();

interface RecapSelectionQuotaState {
  multiplayerCount: number;
  soloCount: number;
}

export function createOfflineSimulationRunPreview(input: {
  plan: OfflineSimulationPlan;
  contexts: readonly CharacterContext[];
  lastActiveAt: number | null;
}): OfflineSimulationRunPreview {
  const seed = createSimulationSeed(input.lastActiveAt, input.plan.elapsedMs);

  if (input.plan.ignored) {
    return {
      seed,
      events: [],
      suppressed: input.contexts.map(context => ({
        slotIndex: -1,
        timestamp: input.lastActiveAt ?? 0,
        characterId: context.id,
        eventId: '',
        reason: 'planIgnoredByElapsedTime',
      })),
    };
  }

  const eventCountsByCharacterId = new Map<string, number>();
  const eventCountsByEventId = new Map<string, number>();
  const quotaState: RecapSelectionQuotaState = {
    multiplayerCount: 0,
    soloCount: 0,
  };
  const events: OfflineSimulationPreviewEvent[] = [];
  const suppressed: OfflineSimulationPreviewSuppressedEvent[] = [];

  input.plan.slots.forEach(slot => {
    const occupiedCharacterIds = new Set<string>();

    input.contexts.forEach(context => {
      if (
        quotaState.multiplayerCount >= OFFLINE_SIMULATION_POLICY.recap.preferredMultiplayerItems ||
        occupiedCharacterIds.has(context.id) ||
        (eventCountsByCharacterId.get(context.id) ?? 0) >= OFFLINE_SIMULATION_POLICY.limits.maxEventsPerCharacter
      ) {
        return;
      }

      const random = createSeededRandom(`${seed}:${slot.index}:${context.id}`);
      const selectableCandidates = createSelectableCandidates({
        context,
        contexts: input.contexts,
        eventCountsByEventId,
        random,
        slotIndex: slot.index,
        timestamp: slot.timestamp,
        suppressed,
        shouldRecordSuppression: false,
      });
      const selectedCandidate = selectBestMultiplayerCandidate(
        selectableCandidates
          .filter(isMultiplayerCandidate),
      );

      if (!selectedCandidate) {
        return;
      }

      events.push(createPreviewEvent(slot.index, slot.timestamp, context, selectedCandidate));
      updateRecapSelectionQuotaState(quotaState, selectedCandidate);
      getResolutionParticipantIds(selectedCandidate, context.id).forEach(participantId => {
        occupiedCharacterIds.add(participantId);
        eventCountsByCharacterId.set(participantId, (eventCountsByCharacterId.get(participantId) ?? 0) + 1);
      });
      eventCountsByEventId.set(selectedCandidate.id, (eventCountsByEventId.get(selectedCandidate.id) ?? 0) + 1);
    });

    input.contexts.forEach(context => {
      if (occupiedCharacterIds.has(context.id)) {
        suppressed.push({
          slotIndex: slot.index,
          timestamp: slot.timestamp,
          characterId: context.id,
          eventId: '',
          reason: 'participantAlreadyReserved',
        });
        return;
      }

      const characterEventCount = eventCountsByCharacterId.get(context.id) ?? 0;

      if (characterEventCount >= OFFLINE_SIMULATION_POLICY.limits.maxEventsPerCharacter) {
        suppressed.push({
          slotIndex: slot.index,
          timestamp: slot.timestamp,
          characterId: context.id,
          eventId: '',
          reason: 'characterMaxEventsPerReturn',
        });
        return;
      }

      const random = createSeededRandom(`${seed}:${slot.index}:${context.id}`);
      const selectableCandidates = createSelectableCandidates({
        context,
        contexts: input.contexts,
        eventCountsByEventId,
        random,
        slotIndex: slot.index,
        timestamp: slot.timestamp,
        suppressed,
        shouldRecordSuppression: true,
      });
      const selectedCandidate = selectCandidateForOfflineEvent(
        selectableCandidates,
        quotaState,
        random,
      );

      if (!selectedCandidate) {
        suppressed.push({
          slotIndex: slot.index,
          timestamp: slot.timestamp,
          characterId: context.id,
          eventId: '',
          reason: 'noSelectableCandidate',
        });
        return;
      }

      events.push(createPreviewEvent(slot.index, slot.timestamp, context, selectedCandidate));
      updateRecapSelectionQuotaState(quotaState, selectedCandidate);
      getResolutionParticipantIds(selectedCandidate, context.id).forEach(participantId => {
        occupiedCharacterIds.add(participantId);
        eventCountsByCharacterId.set(participantId, (eventCountsByCharacterId.get(participantId) ?? 0) + 1);
      });
      eventCountsByEventId.set(selectedCandidate.id, (eventCountsByEventId.get(selectedCandidate.id) ?? 0) + 1);
    });
  });

  return {
    seed,
    events,
    suppressed,
  };
}

function createSelectableCandidates(input: {
  context: CharacterContext;
  contexts: readonly CharacterContext[];
  eventCountsByEventId: ReadonlyMap<string, number>;
  random: () => number;
  slotIndex: number;
  timestamp: number;
  suppressed: OfflineSimulationPreviewSuppressedEvent[];
  shouldRecordSuppression: boolean;
}): OfflineCharacterCandidateDebug[] {
  const inputSnapshot = createOfflineDecisionInput(input.context, input.contexts, input.timestamp, input.random);
  const utilityScores = calculateCharacterUtilityScores(input.context);
  const candidates = collectCharacterEventCandidates(input.context, utilityScores, inputSnapshot)
    .map(candidate => createOfflineCandidateDebug(candidate, input.context, inputSnapshot, input.contexts));

  return candidates.filter(candidate => {
    const suppressionReason = getSuppressionReason(candidate, input.eventCountsByEventId);

    if (suppressionReason) {
      if (input.shouldRecordSuppression) {
        input.suppressed.push({
          slotIndex: input.slotIndex,
          timestamp: input.timestamp,
          characterId: input.context.id,
          eventId: candidate.id,
          reason: suppressionReason,
        });
      }

      return false;
    }

    return true;
  });
}

function selectBestMultiplayerCandidate(
  candidates: readonly OfflineCharacterCandidateDebug[],
): OfflineCharacterCandidateDebug | null {
  return [...candidates]
    .sort(compareMultiplayerCandidates)[0] ?? null;
}

function compareMultiplayerCandidates(
  left: OfflineCharacterCandidateDebug,
  right: OfflineCharacterCandidateDebug,
): number {
  return getMultiplayerCandidateScore(right) - getMultiplayerCandidateScore(left) ||
    right.offlineWeight - left.offlineWeight ||
    left.id.localeCompare(right.id);
}

function getMultiplayerCandidateScore(candidate: OfflineCharacterCandidateDebug): number {
  const participantCount = candidate.resolutionPreview.kind === 'group'
    ? candidate.resolutionPreview.participantIds.length
    : 1;
  const activityScore = candidate.activityType
    ? OFFLINE_SIMULATION_POLICY.recap.displayScore.activityType[candidate.activityType] ?? 0
    : 0;

  return OFFLINE_SIMULATION_POLICY.recap.displayScore.base +
    OFFLINE_SIMULATION_POLICY.recap.displayScore.multiplayerBonus +
    Math.max(0, participantCount - 1) * OFFLINE_SIMULATION_POLICY.recap.displayScore.participantBonus +
    activityScore +
    (candidate.recapPreview?.priority ?? 0);
}

function selectCandidateForOfflineEvent(
  candidates: readonly OfflineCharacterCandidateDebug[],
  quotaState: RecapSelectionQuotaState,
  random: () => number,
): OfflineCharacterCandidateDebug | null {
  const preferredCandidates = getPreferredQuotaCandidates(candidates, quotaState);
  const candidatePool = preferredCandidates.length > 0 ? preferredCandidates : candidates;

  return selector.select(
    candidatePool.map(candidate => ({
      item: candidate,
      weight: candidate.offlineWeight,
    })),
    random,
  );
}

function getPreferredQuotaCandidates(
  candidates: readonly OfflineCharacterCandidateDebug[],
  quotaState: RecapSelectionQuotaState,
): readonly OfflineCharacterCandidateDebug[] {
  const recapCandidates = candidates.filter(candidate => candidate.recapPreview);

  if (quotaState.multiplayerCount < OFFLINE_SIMULATION_POLICY.recap.preferredMultiplayerItems) {
    const multiplayerCandidates = recapCandidates.filter(isMultiplayerCandidate);

    if (multiplayerCandidates.length > 0) {
      return multiplayerCandidates;
    }
  }

  if (quotaState.soloCount < OFFLINE_SIMULATION_POLICY.recap.preferredSoloItems) {
    const soloCandidates = recapCandidates.filter(candidate => !isMultiplayerCandidate(candidate));

    if (soloCandidates.length > 0) {
      return soloCandidates;
    }
  }

  return [];
}

function updateRecapSelectionQuotaState(
  quotaState: RecapSelectionQuotaState,
  candidate: OfflineCharacterCandidateDebug,
): void {
  if (!candidate.recapPreview) {
    return;
  }

  if (isMultiplayerCandidate(candidate)) {
    quotaState.multiplayerCount += 1;
    return;
  }

  quotaState.soloCount += 1;
}

function isMultiplayerCandidate(candidate: OfflineCharacterCandidateDebug): boolean {
  return candidate.resolutionPreview.kind === 'group' &&
    candidate.resolutionPreview.participantIds.length > 1;
}

function getResolutionParticipantIds(
  candidate: OfflineCharacterCandidateDebug,
  fallbackCharacterId: string,
): readonly string[] {
  if (candidate.resolutionPreview.kind === 'group') {
    return candidate.resolutionPreview.participantIds;
  }

  return [fallbackCharacterId];
}

function getSuppressionReason(
  candidate: OfflineCharacterCandidateDebug,
  eventCountsByEventId: ReadonlyMap<string, number>,
): string | null {
  if (!candidate.policy.enabled) {
    return 'policyDisabled';
  }

  if (candidate.resolutionPreview.kind === 'unsupported') {
    if (candidate.resolutionPreview.reason === 'activityUnavailableAtTimestamp') {
      return 'activityUnavailableAtTimestamp';
    }

    return 'unsupportedOfflineResolution';
  }

  if (candidate.offlineWeight <= 0) {
    return 'zeroOfflineWeight';
  }

  if (candidate.policy.recap === 'none') {
    return 'recapNone';
  }

  if ((eventCountsByEventId.get(candidate.id) ?? 0) >= candidate.policy.maxPerReturn) {
    return 'eventMaxPerReturn';
  }

  return null;
}

function createPreviewEvent(
  slotIndex: number,
  timestamp: number,
  context: CharacterContext,
  candidate: OfflineCharacterCandidateDebug,
): OfflineSimulationPreviewEvent {
  return {
    slotIndex,
    timestamp,
    characterId: context.id,
    characterName: context.name,
    eventId: candidate.id,
    bucketId: candidate.bucketId,
    motivation: candidate.motivation,
    eventType: candidate.eventType,
    ...(candidate.activityType ? { activityType: candidate.activityType } : {}),
    offlineWeight: candidate.offlineWeight,
    recapPreview: candidate.recapPreview,
    resolutionPreview: candidate.resolutionPreview,
  };
}

function createSimulationSeed(lastActiveAt: number | null, elapsedMs: number): string {
  return [
    'offline-preview',
    String(lastActiveAt ?? 0),
    String(Math.round(elapsedMs)),
    String(OFFLINE_SIMULATION_POLICY.version),
  ].join(':');
}
