import { v4 as createUuid } from 'uuid';

import { getMoodForMoodValue } from '~/constants/character';
import { DEFAULT_EXPRESSION_PRESET_ID } from '~/constants/expressionCatalog';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import { TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import { createEmptyActivityCooldowns } from '~/services/characterEvents/activityCooldowns';
import { createCharacterHousing } from '~/services/characterHousingService';
import {
  getCharacterRoster,
  getOccupiedApartmentRoomNumbers,
  isPlayerCreatedCharacterProfile,
} from '~/services/characterRosterService';
import { characterAvatarSaveService } from '~/services/save/characterAvatarSaveService';
import { characterProfileSaveService } from '~/services/save/characterProfileSaveService';
import { characterRuntimeSaveService } from '~/services/save/characterRuntimeSaveService';
import { saveDb } from '~/services/save/saveDb';
import { normalizeSaveMetaRecord } from '~/services/save/saveNormalizer';
import type {
  CharacterAvatarRecord,
  CharacterRuntimeSaveRecord,
  CharacterRuntimeSnapshot,
  PlayerCreatedCharacterProfileRecord,
} from '~/services/save/saveTypes';
import {
  PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION,
  type CharacterHousing,
} from '~/typing/characterProfile';
import type { AvatarState } from '~/widgets/avatarCanvas';

export interface CreatePlayerCharacterInput {
  name: string;
  personality: CharacterPersonality;
  avatarState: AvatarState;
}

export interface CreatePlayerCharacterResult {
  characterId: string;
  profileRecord: PlayerCreatedCharacterProfileRecord;
  avatarRecord: CharacterAvatarRecord;
  runtimeRecord: CharacterRuntimeSaveRecord;
  housing: CharacterHousing;
}

const CHARACTER_AVATAR_SCHEMA_VERSION = 1;
const INITIAL_CHARACTER_POSITION = { x: 0, y: 0 };
const INITIAL_MOOD_VALUE = 65;
const INITIAL_SATURATION = 70;
const INITIAL_PLAY_NEED = 35;
const INITIAL_HUNGER_THRESHOLD = 30;

export async function createPlayerCharacter(
  input: CreatePlayerCharacterInput,
): Promise<CreatePlayerCharacterResult> {
  const name = input.name.trim();

  if (name.length === 0) {
    throw new Error('請輸入名字。');
  }

  const timestamp = Date.now();
  const characterId = createUuid();
  const avatarRecord = createCharacterAvatarRecord({
    characterId,
    avatarState: input.avatarState,
    timestamp,
  });
  const runtimeSnapshot = createApartmentRuntimeSnapshot(characterId);
  const runtimeRecord: CharacterRuntimeSaveRecord = {
    id: characterId,
    seedId: characterId,
    snapshot: runtimeSnapshot,
    updatedAt: timestamp,
  };

  const { profileRecord, housing } = await saveDb.transaction('rw', [
    saveDb.saveMeta,
    saveDb.characters,
    saveDb.characterAvatars,
    saveDb.characterRuntime,
  ], async () => {
    const existingProfileRecords = await saveDb.characters.toArray();
    const occupiedRoomNumbers = getOccupiedApartmentRoomNumbers(
      getCharacterRoster(existingProfileRecords),
    );
    const nextHousing = createCharacterHousing({
      occupiedRoomNumbers,
    });
    const nextProfileRecord = createPlayerCharacterProfileRecord({
      characterId,
      name,
      personality: input.personality,
      housing: nextHousing,
      timestamp,
    });

    await saveDb.characters.add(nextProfileRecord);
    await saveDb.characterAvatars.add(avatarRecord);
    await saveDb.characterRuntime.add(runtimeRecord);

    const saveMetaRecord = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));
    await saveDb.saveMeta.put({
      ...saveMetaRecord,
      updatedAt: Date.now(),
    });

    return {
      profileRecord: nextProfileRecord,
      housing: nextHousing,
    };
  });

  characterProfileSaveService.upsert(profileRecord);
  characterAvatarSaveService.upsert(avatarRecord);
  characterRuntimeSaveService.upsertRuntimeSnapshot(runtimeSnapshot);

  return {
    characterId,
    profileRecord,
    avatarRecord,
    runtimeRecord,
    housing,
  };
}

export async function markPlayerCharacterCreationReady(
  characterId: string,
): Promise<PlayerCreatedCharacterProfileRecord> {
  const timestamp = Date.now();
  const nextProfileRecord = await saveDb.transaction('rw', [
    saveDb.saveMeta,
    saveDb.characters,
  ], async () => {
    const currentRecord = await saveDb.characters.get(characterId);

    if (
      !currentRecord ||
      currentRecord.source !== 'playerCreated' ||
      !isPlayerCreatedCharacterProfile(currentRecord.profile)
    ) {
      throw new Error('找不到可完成的自創角色。');
    }

    const readyProfileRecord: PlayerCreatedCharacterProfileRecord = {
      ...currentRecord,
      source: 'playerCreated',
      updatedAt: timestamp,
      profile: {
        ...currentRecord.profile,
        creationStatus: 'ready',
      },
    };

    await saveDb.characters.put(readyProfileRecord);

    const saveMetaRecord = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));
    await saveDb.saveMeta.put({
      ...saveMetaRecord,
      updatedAt: timestamp,
    });

    return readyProfileRecord;
  });

  characterProfileSaveService.upsert(nextProfileRecord);
  return nextProfileRecord;
}

export async function deletePlayerCharacterCreation(characterId: string): Promise<void> {
  await saveDb.transaction('rw', [
    saveDb.saveMeta,
    saveDb.characters,
    saveDb.characterAvatars,
    saveDb.characterRuntime,
  ], async () => {
    await saveDb.characters.delete(characterId);
    await saveDb.characterAvatars.where('characterId').equals(characterId).delete();
    await saveDb.characterRuntime.delete(characterId);

    const saveMetaRecord = normalizeSaveMetaRecord(await saveDb.saveMeta.get('current'));
    await saveDb.saveMeta.put({
      ...saveMetaRecord,
      updatedAt: Date.now(),
    });
  });

  characterProfileSaveService.delete(characterId);
  characterAvatarSaveService.delete(characterId);
  characterRuntimeSaveService.deleteRuntimeSnapshot(characterId);
}

function createPlayerCharacterProfileRecord(input: {
  characterId: string;
  name: string;
  personality: CharacterPersonality;
  housing: CharacterHousing;
  timestamp: number;
}): PlayerCreatedCharacterProfileRecord {
  return {
    id: input.characterId,
    source: 'playerCreated',
    name: input.name,
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    profile: {
      schemaVersion: PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION,
      personality: { ...input.personality },
      housing: { ...input.housing },
      creationStatus: 'pendingBake',
    },
  };
}

function createCharacterAvatarRecord(input: {
  characterId: string;
  avatarState: AvatarState;
  timestamp: number;
}): CharacterAvatarRecord {
  return {
    id: createUuid(),
    characterId: input.characterId,
    avatarSchemaVersion: CHARACTER_AVATAR_SCHEMA_VERSION,
    avatarState: structuredClone(input.avatarState),
    updatedAt: input.timestamp,
  };
}

function createApartmentRuntimeSnapshot(
  characterId: string,
): CharacterRuntimeSnapshot {
  return {
    id: characterId,
    seedId: characterId,
    status: {
      mood: getMoodForMoodValue(INITIAL_MOOD_VALUE),
      expressionPresetId: DEFAULT_EXPRESSION_PRESET_ID,
      saturation: INITIAL_SATURATION,
      moodValue: INITIAL_MOOD_VALUE,
      playNeed: INITIAL_PLAY_NEED,
      hungerThreshold: INITIAL_HUNGER_THRESHOLD,
    },
    position: { ...INITIAL_CHARACTER_POSITION },
    presence: {
      kind: 'contained',
      spaceId: TOWN_APARTMENT_SPACE_ID,
    },
    heldItem: null,
    activityCooldowns: createEmptyActivityCooldowns(),
    locks: {
      bodyAction: [],
      bodyMove: [],
      mind: [],
      communication: [],
    },
    relationships: [],
  };
}
