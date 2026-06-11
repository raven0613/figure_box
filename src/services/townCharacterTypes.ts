import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { Position } from '~/constants/character';
import type { characterMachine } from '~/stateMachines/gameFlow/children/character';
import type { CharacterEvent } from '~/stateMachines/gameFlow/events';
import type { CharacterSeedItem } from '~/typing/item';
import type { CharacterPersonality } from '~/constants/characterPersonality';

export type CharacterActor = ActorRefFrom<typeof characterMachine>;

export interface CharacterSeed {
  id: string;
  name: string;
  label: string;
  color: string;
  position: Position;
  saturation: number;
  personality?: CharacterPersonality;
  ownItems?: readonly CharacterSeedItem[];
}

export type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;

export type SendCharacterEvent = (characterId: string, event: CharacterEvent) => boolean;
