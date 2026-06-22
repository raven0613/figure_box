import { Feeling, type SocialStatus } from '~/constants/character';
import type { CharacterEventAcceptance } from '~/constants/charactarEventsDefinitions';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import {
  applyCharacterEventWeightModifiers,
  createCharacterEventRuleContext,
} from './rules';

interface CharacterEventInvitationAcceptanceInput {
  candidate: CharacterContext;
  hostCharacterId: string;
  hostSocialStatus: SocialStatus;
  acceptance: CharacterEventAcceptance | undefined;
  random?: () => number;
}

export function canAcceptCharacterEventInvitation(
  input: CharacterEventInvitationAcceptanceInput,
): boolean {
  if (!input.acceptance) {
    return true;
  }

  const meetsRequirements = meetsAcceptanceRequirements(
    input.candidate,
    input.hostCharacterId,
    input.hostSocialStatus,
    input.acceptance,
  );
  const baseChance = meetsRequirements
    ? input.acceptance.baseChance ?? 1
    : input.acceptance.fallbackChance ?? 0;
  const weightedChance = applyCharacterEventWeightModifiers(
    baseChance,
    input.acceptance.weightModifiers,
    createCharacterEventRuleContext(
      input.candidate,
      input.candidate.utilityScores,
      {},
    ),
  );
  const acceptanceChance = Math.max(0, Math.min(1, weightedChance));

  if (acceptanceChance <= 0) {
    return false;
  }

  if (acceptanceChance >= 1) {
    return true;
  }

  return (input.random ?? Math.random)() <= acceptanceChance;
}

function meetsAcceptanceRequirements(
  candidate: CharacterContext,
  hostCharacterId: string,
  hostSocialStatus: SocialStatus,
  acceptance: CharacterEventAcceptance,
): boolean {
  const meetsMinMood = acceptance.minMoodValue === undefined ||
    candidate.status.moodValue >= acceptance.minMoodValue;
  const meetsAllowedMood = !acceptance.allowedMoods?.length ||
    acceptance.allowedMoods.includes(candidate.status.mood);
  const meetsRelationship = !acceptance.relationships?.length ||
    acceptance.relationships.some(requirement => {
      const relationship = candidate.relationships.find(entry => (
        entry.targetCharId === hostCharacterId
      ));
      const intimacy = relationship?.intimacy ?? 0;

      if (requirement.minIntimacy !== undefined && intimacy < requirement.minIntimacy) {
        return false;
      }

      if (requirement.maxIntimacy !== undefined && intimacy > requirement.maxIntimacy) {
        return false;
      }

      const feeling = relationship?.feeling ?? Feeling.Neutral;

      if (requirement.allowedFeelings?.length && !requirement.allowedFeelings.includes(feeling)) {
        return false;
      }

      return !requirement.allowedSocialStatuses?.length ||
        requirement.allowedSocialStatuses.includes(hostSocialStatus);
    });

  return meetsMinMood && meetsAllowedMood && meetsRelationship;
}
