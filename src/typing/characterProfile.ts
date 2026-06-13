import type { CharacterPersonality } from '~/constants/characterPersonality';

export const PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION = 1;

export type CharacterCreationStatus = 'pendingBake' | 'ready';

export interface CharacterHousing {
  buildingId: string;
  roomId: string;
  roomNumber: number;
}

export interface CharacterProfileData {
  schemaVersion?: number;
  personality?: CharacterPersonality;
  housing?: CharacterHousing;
  creationStatus?: CharacterCreationStatus;
  [key: string]: unknown;
}

export interface PlayerCreatedCharacterProfileData extends CharacterProfileData {
  schemaVersion: typeof PLAYER_CREATED_CHARACTER_PROFILE_SCHEMA_VERSION;
  personality: CharacterPersonality;
  housing: CharacterHousing;
  creationStatus: CharacterCreationStatus;
}
