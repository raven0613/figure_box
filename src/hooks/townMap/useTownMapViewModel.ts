import { useMemo } from 'react';

import { TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import type { CharacterRequest } from '~/services/characterRequests/types';
import {
  getApartmentRequestItems,
  getRequestListItems,
} from '~/services/characterRequests/visibility';
import type { CharacterSnapshot } from '~/services/townCharacterController';
import type { CharacterSeed } from '~/services/townCharacterTypes';
import { getApartmentResidents } from '~/utils/townMapResidents';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { TownMapTile } from '~/widgets/townMapGrid';

interface UseTownMapViewModelOptions {
  apartmentRevealCharacterId: string | null;
  characterRequests: readonly CharacterRequest[];
  characterSnapshots: Record<string, CharacterSnapshot>;
  playableCharacters: readonly CharacterSeed[];
  selectedCharacterId: string;
  selectedTile: TownMapTile | null;
  widgetRef: { current: FabricTownMapWidget | null };
}

export function useTownMapViewModel({
  apartmentRevealCharacterId,
  characterRequests,
  characterSnapshots,
  playableCharacters,
  selectedCharacterId,
  selectedTile,
  widgetRef,
}: UseTownMapViewModelOptions) {
  const requestListItems = useMemo(
    () => getRequestListItems({
      requests: characterRequests,
      snapshots: characterSnapshots,
    }),
    [characterRequests, characterSnapshots],
  );
  const apartmentRequestItems = useMemo(
    () => getApartmentRequestItems({
      requests: characterRequests,
      snapshots: characterSnapshots,
      apartmentSpaceId: TOWN_APARTMENT_SPACE_ID,
    }),
    [characterRequests, characterSnapshots],
  );
  const apartmentResidents = useMemo(
    () => getApartmentResidents({
      apartmentRequests: apartmentRequestItems,
      apartmentSpaceId: TOWN_APARTMENT_SPACE_ID,
      featuredCharacterId: apartmentRevealCharacterId,
      snapshots: characterSnapshots,
    }),
    [apartmentRequestItems, apartmentRevealCharacterId, characterSnapshots],
  );
  const selectedCharacterName = useMemo(
    () => playableCharacters.find(character => character.id === selectedCharacterId)?.name ?? selectedCharacterId,
    [playableCharacters, selectedCharacterId],
  );
  const selectedOccupantIds = selectedTile && widgetRef.current
    ? widgetRef.current.getOccupantIdsAt(selectedTile.x, selectedTile.y)
    : [];

  return {
    apartmentResidents,
    requestListItems,
    selectedCharacterName,
    selectedOccupantIds,
  };
}
