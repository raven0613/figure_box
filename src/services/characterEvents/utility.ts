import type { CharacterContext, CharacterUtilityScores } from '~/stateMachines/gameFlow/context';

export const SATURATION_LOSS_PER_TICK = 0.1;
export const SATURATION_GAIN_AFTER_EATING = 100;
export const LOW_SATURATION_THRESHOLD = 5;

export function calculateCharacterUtilityScores(context: CharacterContext): CharacterUtilityScores {
  const saturationNeed = 100 - context.status.saturation;
  const hungerScore = context.status.saturation <= context.status.hungerThreshold
    ? Math.min(100, saturationNeed + 25)
    : saturationNeed;
  const moodNeed = 100 - context.status.moodValue;
  const restScore = Math.min(100, 18 + moodNeed * 0.35);
  const playScore = Math.min(100, 28 + moodNeed * 0.8);
  const chatScore = Math.min(100, 16 + context.status.moodValue * 0.25);
  const idleScore = context.status.saturation > 70 && context.status.moodValue > 70 ? 45 : 8;

  return {
    idle: Math.round(idleScore),
    findFood: Math.round(hungerScore),
    rest: Math.round(restScore),
    play: Math.round(playScore),
    chat: Math.round(chatScore),
  };
}
