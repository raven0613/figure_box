import { TOWN_APARTMENT_ENTRANCE_TILES, TOWN_APARTMENT_SPACE_ID } from '~/constants/townMap';
import type { CharacterSnapshot } from '~/services/townCharacterTypes';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { GridCoordinate } from '~/widgets/townMapGrid';
import { getVisibleRequestIndicators, type RequestVisibilityIndicator } from './visibility';
import type { CharacterRequest } from './types';

type CharacterSnapshotLookup = Record<string, CharacterSnapshot>;

interface CharacterRequestIndicatorPresenterOptions {
  widget: FabricTownMapWidget;
}

interface SyncCharacterRequestIndicatorsInput {
  requests: readonly CharacterRequest[];
  snapshots: CharacterSnapshotLookup;
  zoom: number;
}

export class CharacterRequestIndicatorPresenter {
  private readonly widget: FabricTownMapWidget;
  private readonly activeCharacterIds = new Set<string>();
  private readonly activeMapMarkerIds = new Set<string>();

  constructor(options: CharacterRequestIndicatorPresenterOptions) {
    this.widget = options.widget;
  }

  sync(input: SyncCharacterRequestIndicatorsInput): void {
    const indicators = getVisibleRequestIndicators(input);
    const nextCharacterIds = new Set(
      indicators
        .filter(isCharacterRequestIndicator)
        .map(indicator => indicator.anchor.characterId),
    );
    const nextSpaceMarkerIds = new Set(
      indicators
        .filter(indicator => indicator.anchor.type === 'space')
        .map(indicator => indicator.id),
    );

    this.clearStaleCharacterMarkers(nextCharacterIds);
    this.clearStaleMapMarkers(nextSpaceMarkerIds);
    this.renderIndicators(indicators);
  }

  clear(): void {
    this.activeCharacterIds.forEach(characterId => {
      this.widget.updateCharacterRequestMarker(characterId, null);
    });
    this.activeCharacterIds.clear();

    this.activeMapMarkerIds.forEach(markerId => {
      this.widget.removeMapActivity(markerId);
    });
    this.activeMapMarkerIds.clear();
  }

  private clearStaleCharacterMarkers(nextCharacterIds: ReadonlySet<string>): void {
    this.activeCharacterIds.forEach(characterId => {
      if (!nextCharacterIds.has(characterId)) {
        this.widget.updateCharacterRequestMarker(characterId, null);
      }
    });
    this.activeCharacterIds.clear();
  }

  private clearStaleMapMarkers(nextSpaceMarkerIds: ReadonlySet<string>): void {
    this.activeMapMarkerIds.forEach(markerId => {
      if (!nextSpaceMarkerIds.has(markerId)) {
        this.widget.removeMapActivity(markerId);
      }
    });
    this.activeMapMarkerIds.clear();
  }

  private renderIndicators(indicators: readonly RequestVisibilityIndicator[]): void {
    indicators.forEach(indicator => {
      if (indicator.anchor.type === 'character') {
        this.widget.updateCharacterRequestMarker(indicator.anchor.characterId, {
          label: indicator.label,
          level: indicator.request.level,
        });
        this.activeCharacterIds.add(indicator.anchor.characterId);
        return;
      }

      this.widget.showMapActivity({
        id: indicator.id,
        label: indicator.label,
        tone: indicator.request.level,
        participantIds: [],
        anchorTile: getRequestSpaceMarkerTile(indicator.anchor.spaceId),
      }, null);
      this.activeMapMarkerIds.add(indicator.id);
    });
  }
}

function isCharacterRequestIndicator(
  indicator: RequestVisibilityIndicator,
): indicator is RequestVisibilityIndicator & { anchor: { type: 'character'; characterId: string } } {
  return indicator.anchor.type === 'character';
}

function getRequestSpaceMarkerTile(spaceId: string): GridCoordinate | undefined {
  if (spaceId !== TOWN_APARTMENT_SPACE_ID) {
    return undefined;
  }

  const entranceTile = TOWN_APARTMENT_ENTRANCE_TILES[1] ?? TOWN_APARTMENT_ENTRANCE_TILES[0];

  return entranceTile ? { x: entranceTile.x, y: entranceTile.y } : undefined;
}
