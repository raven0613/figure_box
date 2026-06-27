import { EventType } from '~/stateMachines/gameFlow/events';
import type {
  CharacterContext,
  CharacterEventBucketId,
  UtilityDrivenMotivation,
} from '~/stateMachines/gameFlow/context';
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
import { WeightedDecisionSelector } from '../decisionSelector';
import { getActivityCooldownMotivationWeight } from './activityCooldowns';

const weightedDecisionSelector = new WeightedDecisionSelector();

export function decideCharacterEvent(
  context: CharacterContext,
  input: CharacterEventDecisionInput = {},
): CharacterEventDecisionResult {
  const utilityScores = calculateCharacterUtilityScores(context);
  const candidates = collectCharacterEventCandidates(context, utilityScores, input);
  const random = input.random ?? Math.random;
  const timestamp = input.timestamp ?? Date.now();
  const candidateGroups = groupCandidatesByMotivation(candidates);
  const selectedGroup = weightedDecisionSelector.select(
    candidateGroups.map(group => ({
      item: group,
      weight: getActivityCooldownMotivationWeight(
        context,
        group.motivation,
        utilityScores[group.motivation],
        timestamp,
      ) * getMotivationGroupWeightMultiplier(group),
    })),
    random,
  );
  const selectedCandidate = selectedGroup
    ? weightedDecisionSelector.select(
      selectedGroup.candidates.map(candidate => ({
        item: candidate,
        weight: candidate.weight,
      })),
      random,
    )
    : null;
  const selectedPresentationVariant = selectedCandidate
    ? selectPresentationVariant(context, utilityScores, input, selectedCandidate, random)
    : null;

  return {
    event: selectedCandidate?.event ?? { type: EventType.GoIdle },
    utilityScores,
    decision: {
      selectedMotivation: selectedGroup?.motivation ?? null,
      selectedCandidateId: selectedCandidate?.id ?? null,
      selectedBucketId: selectedCandidate?.bucketId ?? null,
      selectedPresentationVariantId: selectedPresentationVariant?.variant.id ?? null,
      selectedPresentationTags: [...(selectedPresentationVariant?.variant.presentationTags ?? [])],
      motivationCount: candidateGroups.length,
      selectedMotivationCandidateCount: selectedGroup?.candidates.length ?? 0,
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
  random: () => number,
) {
  const definition = CHARACTER_EVENT_DEFINITIONS_BY_ID[selectedCandidate.id];

  if (!definition) {
    return null;
  }

  return selectCharacterEventPresentationVariant(
    definition.presentationVariants,
    createCharacterEventRuleContext(context, utilityScores, input),
    random,
  );
}

interface CharacterEventMotivationGroup {
  motivation: UtilityDrivenMotivation;
  candidates: CharacterEventCandidate[];
}

function groupCandidatesByMotivation(
  candidates: readonly CharacterEventCandidate[],
): CharacterEventMotivationGroup[] {
  const candidatesByMotivation = candidates.reduce<
    Map<UtilityDrivenMotivation, CharacterEventCandidate[]>
  >((groups, candidate) => {
    const groupCandidates = groups.get(candidate.motivation) ?? [];

    groups.set(candidate.motivation, [...groupCandidates, candidate]);
    return groups;
  }, new Map());

  return Array.from(candidatesByMotivation, ([motivation, groupCandidates]) => ({
    motivation,
    candidates: groupCandidates,
  }));
}

function getMotivationGroupWeightMultiplier(group: CharacterEventMotivationGroup): number {
  return Math.max(
    1,
    ...group.candidates.map(candidate => candidate.motivationWeightMultiplier ?? 1),
  );
}

function getCandidateBucketIds(candidates: CharacterEventCandidate[]): CharacterEventBucketId[] {
  return Array.from(new Set(candidates.map(candidate => candidate.bucketId)));
}
