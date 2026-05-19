import type { CharacterRequest, CharacterRequestLevel } from './types';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';

export const MINOR_REQUEST_MAP_MIN_ZOOM = 3;

export type RequestVisibilityAnchor =
  | { type: 'character'; characterId: string }
  | { type: 'space'; spaceId: string };

export interface RequestVisibilityIndicator {
  id: string;
  request: CharacterRequest;
  anchor: RequestVisibilityAnchor;
  label: string;
}

export interface RequestListItem {
  request: CharacterRequest;
  characterName: string;
  locationLabel: string;
  levelLabel: string;
}

export interface ApartmentRequestItem {
  request: CharacterRequest;
  characterId: string;
  characterName: string;
  levelLabel: string;
}

type CharacterSnapshotLookup = Record<string, CharacterSnapshot>;

const REQUEST_LEVEL_LABELS: Record<CharacterRequestLevel, string> = {
  critical: 'critical',
  social: 'social',
  minor: 'desire',
};

const REQUEST_INDICATOR_LABELS: Record<CharacterRequestLevel, string> = {
  critical: 'critical',
  social: 'social',
  minor: 'desire',
};

export function getVisibleRequestIndicators(input: {
  requests: readonly CharacterRequest[];
  snapshots: CharacterSnapshotLookup;
  zoom: number;
}): RequestVisibilityIndicator[] {
  return input.requests
    .filter(request => request.status === 'active')
    .flatMap(request => {
      const snapshot = input.snapshots[request.characterId];

      if (!snapshot) {
        return [];
      }

      if (snapshot.context.presence.kind === 'contained') {
        return request.level === 'critical'
          ? [createRequestVisibilityIndicator(request, { type: 'space', spaceId: snapshot.context.presence.spaceId })]
          : [];
      }

      if (request.level === 'minor' && input.zoom < MINOR_REQUEST_MAP_MIN_ZOOM) {
        return [];
      }

      return [createRequestVisibilityIndicator(request, { type: 'character', characterId: request.characterId })];
    });
}

export function getApartmentRequestItems(input: {
  requests: readonly CharacterRequest[];
  snapshots: CharacterSnapshotLookup;
  apartmentSpaceId: string;
}): ApartmentRequestItem[] {
  return input.requests
    .filter(request => {
      const snapshot = input.snapshots[request.characterId];

      return snapshot?.context.presence.kind === 'contained' &&
        snapshot.context.presence.spaceId === input.apartmentSpaceId;
    })
    .map(request => {
      const snapshot = input.snapshots[request.characterId];

      return {
        request,
        characterId: request.characterId,
        characterName: snapshot?.context.name ?? request.characterId,
        levelLabel: getRequestLevelLabel(request.level),
      };
    });
}

export function getRequestListItems(input: {
  requests: readonly CharacterRequest[];
  snapshots: CharacterSnapshotLookup;
}): RequestListItem[] {
  return input.requests.map(request => {
    const snapshot = input.snapshots[request.characterId];

    return {
      request,
      characterName: snapshot?.context.name ?? request.characterId,
      locationLabel: getRequestLocationLabel(snapshot),
      levelLabel: getRequestLevelLabel(request.level),
    };
  });
}

export function getRequestLevelLabel(level: CharacterRequestLevel): string {
  return REQUEST_LEVEL_LABELS[level];
}

function createRequestVisibilityIndicator(
  request: CharacterRequest,
  anchor: RequestVisibilityAnchor,
): RequestVisibilityIndicator {
  return {
    id: `request-indicator-${request.id}`,
    request,
    anchor,
    label: REQUEST_INDICATOR_LABELS[request.level],
  };
}

function getRequestLocationLabel(snapshot?: CharacterSnapshot): string {
  if (!snapshot) {
    return '未知';
  }

  if (snapshot.context.presence.kind === 'contained') {
    return snapshot.context.presence.spaceId;
  }

  return '地圖上';
}
