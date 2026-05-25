import type { Position } from '~/constants/character';
import {
  DESTINATION_MAP,
  TOWN_APARTMENT_SPACE_ID,
  TOWN_MAP_HEIGHT,
  TOWN_MAP_WIDTH,
} from '~/constants/townMap';
import type { OfflinePositionPatchPreview } from './types';

export function createOfflineDestinationPositionPatch(
  reason: string,
  target: Position | null,
): OfflinePositionPatchPreview | null {
  if (!target) {
    return null;
  }

  return {
    mode: 'destination',
    reason,
    target: { ...target },
  };
}

export function createOfflineContainedPositionPatch(reason: string): OfflinePositionPatchPreview {
  return {
    mode: 'contained',
    reason,
    spaceId: TOWN_APARTMENT_SPACE_ID,
  };
}

export function createOfflineNearbyDriftPositionPatch(
  position: Position,
  reason: string,
): OfflinePositionPatchPreview {
  return {
    mode: 'nearbyDrift',
    reason,
    target: {
      x: (position.x + 1) % TOWN_MAP_WIDTH,
      y: Math.min(TOWN_MAP_HEIGHT - 1, position.y),
    },
  };
}

export function getFirstDestinationTarget(motivation: string): Position | null {
  const destination = DESTINATION_MAP[motivation]?.[0];
  const serviceTile = destination?.serviceTiles[0];

  return serviceTile ? { ...serviceTile } : null;
}
