import type { Position } from '~/constants/character';
import type { CharacterEventActivity } from '~/constants/charactarEventsDefinitions';

export function sampleWithoutReplacement<T>(
  candidates: readonly T[],
  count: number,
  random: () => number = Math.random,
): T[] {
  const remaining = [...new Set(candidates)];

  for (let index = remaining.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [remaining[index], remaining[swapIndex]] = [remaining[swapIndex], remaining[index]];
  }

  return remaining.slice(0, count);
}

export function isNearPosition(position: Position, target: Position, range: number): boolean {
  return Math.max(
    Math.abs(position.x - target.x),
    Math.abs(position.y - target.y),
  ) <= range;
}

export function shouldResolveGroupInvites(activityDefinition: CharacterEventActivity): boolean {
  return getGroupMaxParticipants(activityDefinition) > 1 || getGroupMinParticipants(activityDefinition) > 1;
}

export function getPostInviteActivityPhase(activityDefinition: CharacterEventActivity): 'active' | 'traveling' {
  if (activityDefinition.startPhase) {
    return activityDefinition.startPhase;
  }

  return activityDefinition.destination ? 'traveling' : 'active';
}

export function getGroupMinParticipants(activityDefinition: CharacterEventActivity): number {
  return activityDefinition.group.minParticipants ?? 1;
}

export function getGroupMaxParticipants(activityDefinition: CharacterEventActivity): number {
  const minParticipants = getGroupMinParticipants(activityDefinition);
  return Math.max(minParticipants, activityDefinition.group.maxParticipants ?? minParticipants);
}
