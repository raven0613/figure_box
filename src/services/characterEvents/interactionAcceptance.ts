import type { CharacterContext } from '~/stateMachines/gameFlow/context';
import type { CharacterEventDefinition } from './definitions';

const DEFAULT_ACCEPTANCE_MIN_MOOD_VALUE = 30;
const DEFAULT_ACCEPTANCE_FALLBACK_CHANCE = 0.3;

export function shouldAcceptInteraction(
  context: CharacterContext,
  eventDefinition: CharacterEventDefinition,
  random: () => number = Math.random,
): boolean {
  const minMoodValue = eventDefinition.acceptance?.minMoodValue ?? DEFAULT_ACCEPTANCE_MIN_MOOD_VALUE;

  if (context.status.moodValue >= minMoodValue) {
    return true;
  }

  const fallbackChance = eventDefinition.acceptance?.fallbackChance ?? DEFAULT_ACCEPTANCE_FALLBACK_CHANCE;

  return random() < fallbackChance;
}
