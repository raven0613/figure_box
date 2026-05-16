import type { ActorRefFrom, SnapshotFrom } from 'xstate';
import type { CHARACTER_SEEDS } from '~/constants/character';
import type { characterMachine } from '~/stateMachines/gameFlow/children/character';
import type { CharacterEvent } from '~/stateMachines/gameFlow/events';

export type CharacterActor = ActorRefFrom<typeof characterMachine>;
export type CharacterSeed = (typeof CHARACTER_SEEDS)[number];
export type CharacterSnapshot = SnapshotFrom<typeof characterMachine>;

export type SendCharacterEvent = (characterId: string, event: CharacterEvent) => boolean;

