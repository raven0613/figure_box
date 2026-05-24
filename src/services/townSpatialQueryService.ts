import type { Position } from '~/constants/character';
import { TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import type { CharacterEventNearbyVisibleItem } from '~/services/characterEvents/types';
import { itemService, type ItemService } from '~/services/items/itemService';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

interface TownSpatialQueryServiceOptions {
  widget: FabricTownMapWidget;
  characterIds: readonly string[];
  items?: ItemService;
}

export class TownSpatialQueryService {
  private readonly widget: FabricTownMapWidget;
  private readonly characterIds: readonly string[];
  private readonly items: ItemService;

  constructor(options: TownSpatialQueryServiceOptions) {
    this.widget = options.widget;
    this.characterIds = options.characterIds;
    this.items = options.items ?? itemService;
  }

  getNearbyCharacterIds(characterId: string, range: number): string[] {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return [];
    }

    return this.widget.getOccupiedNeighborIds(tile.x, tile.y, range, characterId);
  }

  getCharacterIdsNearPosition(position: Position, radius: number): string[] {
    return this.characterIds
      .flatMap(characterId => {
        const characterPosition = this.getCharacterPosition(characterId);

        if (!characterPosition) {
          return [];
        }

        const candidate = {
          characterId,
          distance: getGridDistance(position, characterPosition),
        };

        return candidate.distance <= radius ? [candidate] : [];
      })
      .map(candidate => candidate.characterId);
  }

  getCharacterPosition(characterId: string): Position | null {
    const tile = this.widget.getCharacterTile(characterId);

    if (!tile) {
      return null;
    }

    return { x: tile.x, y: tile.y };
  }

  getNearbyVisibleItems(
    characterId: string,
    radius: number,
  ): CharacterEventNearbyVisibleItem[] {
    const position = this.getCharacterPosition(characterId);

    if (!position) {
      return [];
    }

    return this.items.getPlacedObjects(TOWN_WORLD_SPACE_ID)
      .flatMap(placedObject => {
        if (!placedObject.worldPosition) {
          return [];
        }

        const distance = getGridDistance(position, placedObject.worldPosition);

        if (distance > radius) {
          return [];
        }

        const itemInstance = this.items.getItemInstance(placedObject.itemInstanceId);
        const definition = itemInstance ? this.items.getDefinition(itemInstance.definitionId) : null;

        if (!itemInstance || !definition) {
          return [];
        }

        return [{
          placedObjectId: placedObject.id,
          itemInstanceId: itemInstance.id,
          definitionId: definition.id,
          category: definition.category,
          tags: definition.tags,
          rarity: definition.rarity,
          position: placedObject.worldPosition,
          distance,
        }];
      });
  }
}

function getGridDistance(from: Position, to: Position): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}
