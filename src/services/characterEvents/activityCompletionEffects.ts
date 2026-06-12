import {
  clampMoodValue,
  getMoodForMoodValue,
  getMoodMinValue,
} from '~/constants/character';
import type {
  CharacterEventActivity,
  CharacterEventActivityEffects,
  CharacterEventActivityEffectsByRole,
} from '~/constants/charactarEventsDefinitions';
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

export function resolveActivityEffectsForRole(
  sharedEffects: CharacterEventActivityEffects | undefined,
  effectsByRole: CharacterEventActivityEffectsByRole | undefined,
  role: keyof CharacterEventActivityEffectsByRole,
): CharacterEventActivityEffects | undefined {
  const roleEffects = effectsByRole?.[role];

  if (!sharedEffects) {
    return roleEffects ? { ...roleEffects } : undefined;
  }

  if (!roleEffects) {
    return { ...sharedEffects };
  }

  return {
    ...sharedEffects,
    ...roleEffects,
  };
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
