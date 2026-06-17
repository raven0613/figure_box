import type { ApartmentRequestItem } from '~/services/characterRequests/visibility';
import type { CharacterSnapshot } from '~/services/townCharacterController';

export interface ApartmentResident {
  id: string;
  name: string;
  statusText: string;
  requests: readonly ApartmentResidentRequest[];
}

export interface ApartmentResidentRequest {
  id: string;
  label: string;
  level: 'critical' | 'social' | 'minor';
  levelLabel: string;
  status: string;
}

export function getApartmentResidents({
  apartmentRequests,
  apartmentSpaceId,
  featuredCharacterId = null,
  snapshots,
}: {
  apartmentRequests: readonly ApartmentRequestItem[];
  apartmentSpaceId: string;
  featuredCharacterId?: string | null;
  snapshots: Record<string, CharacterSnapshot>;
}): ApartmentResident[] {
  return Object.values(snapshots)
    .filter(snapshot => (
      snapshot.context.presence.kind === 'contained' &&
      snapshot.context.presence.spaceId === apartmentSpaceId
    ))
    .map(snapshot => ({
      id: snapshot.context.id,
      name: snapshot.context.name,
      statusText: snapshot.context.currentMotivation,
      requests: apartmentRequests
        .filter(item => item.characterId === snapshot.context.id)
        .map(item => ({
          id: item.request.id,
          label: item.request.label,
          level: item.request.level,
          levelLabel: item.levelLabel,
          status: item.request.status,
        })),
    }))
    .sort((leftResident, rightResident) => {
      if (leftResident.id === featuredCharacterId) {
        return -1;
      }

      if (rightResident.id === featuredCharacterId) {
        return 1;
      }

      return 0;
    });
}
