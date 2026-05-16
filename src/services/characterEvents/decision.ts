import { EventType } from '~/stateMachines/gameFlow/events';
import type { CharacterContext, CharacterEventBucketId } from '~/stateMachines/gameFlow/context';
import { calculateCharacterUtilityScores } from './utility';
import { collectCharacterEventCandidates } from './buckets';
import type {
  CharacterEventCandidate,
  CharacterEventDecisionInput,
  CharacterEventDecisionResult,
} from './types';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID } from '../../constants/charactarEventsDefinitions';
import { createCharacterEventRuleContext } from './rules';
import { selectCharacterEventPresentationVariant } from './variants';

export function decideCharacterEvent(
  context: CharacterContext,
  input: CharacterEventDecisionInput = {},
): CharacterEventDecisionResult {
  const utilityScores = calculateCharacterUtilityScores(context);
  const candidates = collectCharacterEventCandidates(context, utilityScores, input);
  const selectedCandidate = sampleWeighted(
    candidates,
    candidate => candidate.weight,
    input.random ?? Math.random,
  );
  const selectedPresentationVariant = selectedCandidate
    ? selectPresentationVariant(context, utilityScores, input, selectedCandidate)
    : null;

  return {
    event: selectedCandidate?.event ?? { type: EventType.GoIdle },
    utilityScores,
    decision: {
      selectedCandidateId: selectedCandidate?.id ?? null,
      selectedBucketId: selectedCandidate?.bucketId ?? null,
      selectedPresentationVariantId: selectedPresentationVariant?.variant.id ?? null,
      selectedPresentationTags: [...(selectedPresentationVariant?.variant.presentationTags ?? [])],
      candidateCount: candidates.length,
      bucketIds: getCandidateBucketIds(candidates),
    },
  };
}

function selectPresentationVariant(
  context: CharacterContext,
  utilityScores: CharacterEventDecisionResult['utilityScores'],
  input: CharacterEventDecisionInput,
  selectedCandidate: CharacterEventCandidate,
) {
  const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[selectedCandidate.id];

  if (!definition) {
    return null;
  }

  return selectCharacterEventPresentationVariant(
    definition.presentationVariants,
    createCharacterEventRuleContext(context, utilityScores, input),
    input.random ?? Math.random,
  );
}

function sampleWeighted<T>(
  candidates: T[],
  getWeight: (candidate: T) => number,
  random: () => number,
): T | null {
  const totalWeight = candidates.reduce((sum, candidate) => sum + getWeight(candidate), 0);

  if (totalWeight <= 0) {
    return null;
  }

  let cursor = random() * totalWeight;

  for (const candidate of candidates) {
    cursor -= getWeight(candidate);

    if (cursor <= 0) {
      return candidate;
    }
  }

  return candidates.at(-1) ?? null;
}

function getCandidateBucketIds(candidates: CharacterEventCandidate[]): CharacterEventBucketId[] {
  return Array.from(new Set(candidates.map(candidate => candidate.bucketId)));
}
