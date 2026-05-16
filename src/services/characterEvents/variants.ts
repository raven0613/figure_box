import type { CharacterEventPresentationVariant } from '../../constants/charactarEventsDefinitions';
import {
  applyCharacterEventWeightModifiers,
  matchesCharacterEventClauses,
  type CharacterEventRuleContext,
} from './rules';

export interface SelectedCharacterEventPresentationVariant {
  variant: CharacterEventPresentationVariant;
  weight: number;
}

export function selectCharacterEventPresentationVariant(
  variants: readonly CharacterEventPresentationVariant[] | undefined,
  context: CharacterEventRuleContext,
  random: () => number = Math.random,
): SelectedCharacterEventPresentationVariant | null {
  const weightedVariants = (variants ?? [])
    .filter(variant => matchesCharacterEventClauses(variant.conditions, variant.conditionMode, context))
    .map(variant => ({
      variant,
      weight: applyCharacterEventWeightModifiers(variant.baseWeight, variant.weightModifiers, context),
    }))
    .filter(candidate => candidate.weight > 0);

  return sampleWeighted(weightedVariants, candidate => candidate.weight, random);
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
