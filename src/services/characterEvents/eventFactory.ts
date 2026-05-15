import { EventType, type CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { CharacterEventAction, CharacterEventTarget } from './definitions';
import { getRandomDestinationTarget } from './targets';
import type { CharacterEventDecisionInput } from './types';

export function createCharacterEventFromAction(
  action: CharacterEventAction,
  input: CharacterEventDecisionInput,
  sourceEventId: string,
  random: () => number = Math.random,
): CharacterEvent | null {
  switch (action.type) {
    case 'goIdle':
      return { type: EventType.GoIdle };
    case 'goRest':
      return { type: EventType.GoRest };
    case 'goPlay':
      return { type: EventType.GoPlay };
    case 'goEat':
      return {
        type: EventType.GoEat,
        target: resolveCharacterEventTarget(action.target),
      };
    case 'proposeChat': {
      const targetCharId = selectRandomNearbyCharacterId(input.nearbyCharacterIds ?? [], random);

      if (!targetCharId) {
        return null;
      }

      return {
        type: EventType.ProposeChat,
        targetCharId,
        proposalId: createProposalId(random),
        sourceEventId,
      };
    }
    case 'proposePlay': {
      const targetCharId = selectRandomNearbyCharacterId(input.nearbyCharacterIds ?? [], random);

      if (!targetCharId) {
        return null;
      }

      return {
        type: EventType.ProposePlay,
        targetCharId,
        proposalId: createProposalId(random),
        sourceEventId,
      };
    }
  }
}

function resolveCharacterEventTarget(target: CharacterEventTarget) {
  if (target === 'randomDestination.findFood') {
    return getRandomDestinationTarget('findFood') ?? { x: 1, y: 20 };
  }

  return target;
}

function selectRandomNearbyCharacterId(
  nearbyCharacterIds: string[],
  random: () => number,
): string | null {
  if (nearbyCharacterIds.length === 0) {
    return null;
  }

  return nearbyCharacterIds[Math.floor(random() * nearbyCharacterIds.length)];
}

function createProposalId(random: () => number): string {
  return `interaction-${Date.now()}-${Math.floor(random() * 1_000_000)}`;
}
