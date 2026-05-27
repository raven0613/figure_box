import {
  clampMoodValue,
  getMoodForMoodValue,
  getMoodMinValue,
} from '~/constants/character';
import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';
import type { CharacterContext } from '~/stateMachines/gameFlow/context';

export function applyCompletedActivityStatusEffects(
  status: CharacterContext['status'],
  activityEffects: CharacterEventActivity['effects'],
): CharacterContext['status'] {
  const moodValue = activityEffects?.moodStageTarget
    ? getMoodMinValue(activityEffects.moodStageTarget)
    : status.moodValue + (activityEffects?.moodValueDelta ?? 0);
  const playNeed = activityEffects?.playNeedDelta === undefined
    ? status.playNeed
    : Math.max(0, Math.min(100, status.playNeed + activityEffects.playNeedDelta));

  return updateCharacterMoodValue(
    {
      ...status,
      playNeed,
    },
    moodValue,
  );
}

function updateCharacterMoodValue(
  status: CharacterContext['status'],
  moodValue: number,
): CharacterContext['status'] {
  const clampedMoodValue = clampMoodValue(moodValue);

  return {
    ...status,
    moodValue: clampedMoodValue,
    mood: getMoodForMoodValue(clampedMoodValue),
  };
}
