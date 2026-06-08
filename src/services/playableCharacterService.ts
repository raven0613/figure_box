import { CHARACTER_SEEDS } from '~/constants/character';
import {
  isPlayerCreatedCharacterProfile,
} from '~/services/characterRosterService';
import { characterProfileSaveService } from '~/services/save/characterProfileSaveService';
import { characterRuntimeSaveService } from '~/services/save/characterRuntimeSaveService';
import type { CharacterProfileRecord } from '~/services/save/saveTypes';
import type { CharacterSeed } from '~/services/townCharacterTypes';

const DEFAULT_PLAYER_CHARACTER_COLOR = '#f0cc5f';
const DEFAULT_PLAYER_CHARACTER_POSITION = { x: 0, y: 0 };
const DEFAULT_PLAYER_CHARACTER_SATURATION = 70;

export function getPlayableCharacters(
  profileRecords: readonly CharacterProfileRecord[] = characterProfileSaveService.getRecords(),
): readonly CharacterSeed[] {
  const seedIds = new Set(CHARACTER_SEEDS.map(character => character.id));
  const seedCharacters = getSeedPlayableCharacters();
  const playerCreatedCharacters = profileRecords
    .filter(record => !seedIds.has(record.id))
    .flatMap(createPlayablePlayerCharacter);

  return [...seedCharacters, ...playerCreatedCharacters];
}

export function getSeedPlayableCharacters(): readonly CharacterSeed[] {
  return CHARACTER_SEEDS.map(character => ({
    id: character.id,
    name: character.name,
    label: character.label,
    color: character.color,
    position: { ...character.position },
    saturation: character.saturation,
    ...('ownItems' in character && character.ownItems
      ? {
        ownItems: character.ownItems.map(item => ({
          definitionId: item.definitionId,
          quantity: item.quantity,
          ...(item.state === 'held' || item.state === 'stored' ? { state: item.state } : {}),
        })),
      }
      : {}),
  }));
}

function createPlayablePlayerCharacter(record: CharacterProfileRecord): CharacterSeed[] {
  if (
    record.source !== 'playerCreated' ||
    !isPlayerCreatedCharacterProfile(record.profile) ||
    record.profile.creationStatus !== 'ready'
  ) {
    return [];
  }

  const runtimeSnapshot = characterRuntimeSaveService.getRuntimeSnapshot(record.id);

  return [{
    id: record.id,
    name: record.name,
    label: createCharacterLabel(record.name),
    color: readCharacterColor(record),
    position: runtimeSnapshot
      ? { ...runtimeSnapshot.position }
      : { ...DEFAULT_PLAYER_CHARACTER_POSITION },
    saturation: runtimeSnapshot?.status.saturation ?? DEFAULT_PLAYER_CHARACTER_SATURATION,
  }];
}

function readCharacterColor(record: CharacterProfileRecord): string {
  return typeof record.profile.color === 'string' && record.profile.color.length > 0
    ? record.profile.color
    : DEFAULT_PLAYER_CHARACTER_COLOR;
}

function createCharacterLabel(name: string): string {
  const characters = Array.from(name.trim());

  return (characters[0] ?? '?').toUpperCase();
}
