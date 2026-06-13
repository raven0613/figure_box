import { v4 as createUuid } from 'uuid';
import type { CharacterHousing } from '~/typing/characterProfile';

export const DEFAULT_APARTMENT_BUILDING_ID = 'main-apartment';

const ROOMS_PER_FLOOR = 20;
const FIRST_APARTMENT_FLOOR = 1;
const EXCLUDED_APARTMENT_FLOORS = new Set([13]);
const EXCLUDED_APARTMENT_ROOM_NUMBERS = new Set([404]);

interface CreateCharacterHousingOptions {
  occupiedRoomNumbers: readonly number[];
  buildingId?: string;
  createRoomId?: () => string;
}

export function createCharacterHousing({
  occupiedRoomNumbers,
  buildingId = DEFAULT_APARTMENT_BUILDING_ID,
  createRoomId = createUuid,
}: CreateCharacterHousingOptions): CharacterHousing {
  return {
    buildingId,
    roomId: createRoomId(),
    roomNumber: getNextAvailableApartmentRoomNumber(occupiedRoomNumbers),
  };
}

export function getNextAvailableApartmentRoomNumber(
  occupiedRoomNumbers: readonly number[],
): number {
  const occupiedRooms = new Set(
    occupiedRoomNumbers.filter(isValidApartmentRoomNumber),
  );
  let floor = FIRST_APARTMENT_FLOOR;

  while (true) {
    if (EXCLUDED_APARTMENT_FLOORS.has(floor)) {
      floor += 1;
      continue;
    }

    for (let unit = 1; unit <= ROOMS_PER_FLOOR; unit += 1) {
      const roomNumber = floor * 100 + unit;

      if (
        !EXCLUDED_APARTMENT_ROOM_NUMBERS.has(roomNumber) &&
        !occupiedRooms.has(roomNumber)
      ) {
        return roomNumber;
      }
    }

    floor += 1;
  }
}

export function isValidApartmentRoomNumber(roomNumber: number): boolean {
  if (!Number.isInteger(roomNumber) || roomNumber < 101) {
    return false;
  }

  const floor = Math.floor(roomNumber / 100);
  const unit = roomNumber % 100;

  return (
    floor >= FIRST_APARTMENT_FLOOR &&
    unit >= 1 &&
    unit <= ROOMS_PER_FLOOR &&
    !EXCLUDED_APARTMENT_FLOORS.has(floor) &&
    !EXCLUDED_APARTMENT_ROOM_NUMBERS.has(roomNumber)
  );
}
