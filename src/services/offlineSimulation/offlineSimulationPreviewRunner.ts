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

const MAX_EVENTS_PER_CHARACTER = 3;

const selector = new WeightedDecisionSelector();

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
  const events: OfflineSimulationPreviewEvent[] = [];
  const suppressed: OfflineSimulationPreviewSuppressedEvent[] = [];

  input.plan.slots.forEach(slot => {
    input.contexts.forEach(context => {
      if (events.length >= OFFLINE_SIMULATION_POLICY.recap.maxItems) {
        suppressed.push({
          slotIndex: slot.index,
          timestamp: slot.timestamp,
          characterId: context.id,
          eventId: '',
          reason: 'recapMaxItems',
        });
        return;
      }

      const characterEventCount = eventCountsByCharacterId.get(context.id) ?? 0;

      if (characterEventCount >= MAX_EVENTS_PER_CHARACTER) {
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
      const inputSnapshot = createOfflineDecisionInput(context, input.contexts, slot.timestamp, random);
      const utilityScores = calculateCharacterUtilityScores(context);
      const candidates = collectCharacterEventCandidates(context, utilityScores, inputSnapshot)
        .map(candidate => createOfflineCandidateDebug(candidate, context, inputSnapshot, input.contexts));
      const selectableCandidates = candidates.filter(candidate => {
        const suppressionReason = getSuppressionReason(candidate, eventCountsByEventId);

        if (suppressionReason) {
          suppressed.push({
            slotIndex: slot.index,
            timestamp: slot.timestamp,
            characterId: context.id,
            eventId: candidate.id,
            reason: suppressionReason,
          });
          return false;
        }

        return true;
      });
      const selectedCandidate = selector.select(
        selectableCandidates.map(candidate => ({
          item: candidate,
          weight: candidate.offlineWeight,
        })),
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
      eventCountsByCharacterId.set(context.id, characterEventCount + 1);
      eventCountsByEventId.set(selectedCandidate.id, (eventCountsByEventId.get(selectedCandidate.id) ?? 0) + 1);
    });
  });

  return {
    seed,
    events,
    suppressed,
  };
}

function getSuppressionReason(
  candidate: OfflineCharacterCandidateDebug,
  eventCountsByEventId: ReadonlyMap<string, number>,
): string | null {
  if (!candidate.policy.enabled) {
    return 'policyDisabled';
  }

  if (candidate.resolutionPreview.kind === 'unsupported') {
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
