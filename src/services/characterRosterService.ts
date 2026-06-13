import { CHARACTER_SEEDS } from '~/constants/character';
import type { CharacterPersonality } from '~/constants/characterPersonality';
import {
  DEFAULT_APARTMENT_BUILDING_ID,
  isValidApartmentRoomNumber,
} from '~/services/characterHousingService';
import { characterProfileSaveService } from '~/services/save/characterProfileSaveService';
import type { CharacterProfileRecord } from '~/services/save/saveTypes';
import {
  PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION,
  type CharacterCreationStatus,
  type CharacterHousing,
  type CharacterProfileData,
  type PlayerCreatedCharacterProfileData,
} from '~/typing/characterProfile';

export type CharacterRosterSource = 'seed' | CharacterProfileRecord['source'];

export interface CharacterRosterEntry {
  id: string;
  name: string;
  source: CharacterRosterSource;
  color: string;
  personality: CharacterPersonality | null;
  housing: CharacterHousing | null;
  creationStatus: CharacterCreationStatus | null;
}

const DEFAULT_CHARACTER_COLOR = '#f0cc5f';

export function getCharacterRoster(
  profileRecords: readonly CharacterProfileRecord[] = characterProfileSaveService.getRecords(),
): readonly CharacterRosterEntry[] {
  const seedEntries = CHARACTER_SEEDS.map(character => ({
    id: character.id,
    name: character.name,
    source: 'seed' as const,
    color: character.color,
    personality: null,
    housing: null,
    creationStatus: null,
  }));
  const seedCharacterIds = new Set<string>(seedEntries.map(character => character.id));
  const savedEntries = profileRecords
    .filter(record => !seedCharacterIds.has(record.id))
    .map(createSavedRosterEntry);

  return [...seedEntries, ...savedEntries];
}

export function getOccupiedApartmentRoomNumbers(
  roster: readonly CharacterRosterEntry[] = getCharacterRoster(),
  buildingId = DEFAULT_APARTMENT_BUILDING_ID,
): readonly number[] {
  return roster.flatMap(character => (
    character.housing?.buildingId === buildingId
      ? [character.housing.roomNumber]
      : []
  ));
}

export function isPlayerCreatedCharacterProfile(
  profile: CharacterProfileData,
): profile is PlayerCreatedCharacterProfileData {
  return (
    profile.schemaVersion === PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION &&
    isCharacterPersonality(profile.personality) &&
    isCharacterHousing(profile.housing) &&
    isCharacterCreationStatus(profile.creationStatus)
  );
}

function createSavedRosterEntry(record: CharacterProfileRecord): CharacterRosterEntry {
  const profile = record.profile;
  const isPlayerCreatedProfile = isPlayerCreatedCharacterProfile(profile);

  return {
    id: record.id,
    name: record.name,
    source: record.source,
    color: readCharacterColor(profile),
    personality: isPlayerCreatedProfile ? { ...profile.personality } : null,
    housing: isPlayerCreatedProfile ? { ...profile.housing } : null,
    creationStatus: isPlayerCreatedProfile ? profile.creationStatus : null,
  };
}

function isCharacterPersonality(value: unknown): value is CharacterPersonality {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPersonalityLevel(value.socialTendency) &&
    isPersonalityLevel(value.initiative) &&
    isPersonalityLevel(value.activityPace) &&
    isPersonalityLevel(value.emotionalExpression) &&
    isPersonalityLevel(value.noveltyPreference) &&
    isPersonalityLevel(value.interpersonalAttitude)
  );
}

function readCharacterColor(profile: CharacterProfileData): string {
  return typeof profile.color === 'string' && profile.color.length > 0
    ? profile.color
    : DEFAULT_CHARACTER_COLOR;
}

function isCharacterHousing(value: unknown): value is CharacterHousing {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.buildingId === 'string' &&
    value.buildingId.length > 0 &&
    typeof value.roomId === 'string' &&
    value.roomId.length > 0 &&
    typeof value.roomNumber === 'number' &&
    isValidApartmentRoomNumber(value.roomNumber)
  );
}

function isCharacterCreationStatus(value: unknown): value is CharacterCreationStatus {
  return value === 'pendingBake' || value === 'ready';
}

function isPersonalityLevel(value: unknown): value is CharacterPersonality[keyof CharacterPersonality] {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
