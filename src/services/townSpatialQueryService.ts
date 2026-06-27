import type { Position } from '~/constants/character';
import { TOWN_WORLD_SPACE_ID, type TownMapObjectData } from '~/constants/townMap';
import type {
  CharacterEventNearbyObservableObject,
  CharacterEventNearbyVisibleItem,
} from '~/services/characterEvents/types';
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

    return this.getNearbyVisibleItemsAtPosition(position, radius);
  }

  getNearbyObservableObjects(
    characterId: string,
    radius: number,
  ): CharacterEventNearbyObservableObject[] {
    const position = this.getCharacterPosition(characterId);

    if (!position) {
      return [];
    }

    return this.getNearbyObservableObjectsAtPosition(position, radius);
  }

  getNearbyObservableObjectsAtPosition(
    position: Position,
    radius: number,
  ): CharacterEventNearbyObservableObject[] {
    return [
      ...this.getNearbyObservableMapObjectsAtPosition(position, radius),
      ...this.getNearbyVisibleItemsAtPosition(position, radius).map(item => ({
        id: `placedItem:${item.placedObjectId}`,
        kind: 'placedItem' as const,
        label: item.definitionId,
        position: { ...item.position },
        distance: item.distance,
        placedObjectId: item.placedObjectId,
        itemInstanceId: item.itemInstanceId,
        definitionId: item.definitionId,
      })),
    ];
  }

  private getNearbyVisibleItemsAtPosition(
    position: Position,
    radius: number,
  ): CharacterEventNearbyVisibleItem[] {
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

  private getNearbyObservableMapObjectsAtPosition(
    position: Position,
    radius: number,
  ): CharacterEventNearbyObservableObject[] {
    return this.widget.getMapObjectsInRadius(position.x, position.y, radius)
      .flatMap(object => {
        const targetPosition = this.getMapObjectObservationTarget(object, position);

        if (!targetPosition) {
          return [];
        }

        return [{
          id: `mapObject:${object.id}`,
          kind: 'mapObject' as const,
          label: object.label,
          position: targetPosition,
          distance: getMapObjectDistance(object, position),
          mapObjectId: object.id,
        }];
      });
  }

  private getMapObjectObservationTarget(
    object: TownMapObjectData,
    origin: Position,
  ): Position | null {
    const targetCandidates = this.getMapObjectTiles(object)
      .flatMap(tile => [
        tile,
        ...this.widget.getNeighbors(tile.x, tile.y, 1).map(neighbor => ({
          x: neighbor.x,
          y: neighbor.y,
        })),
      ])
      .filter((tile, index, tiles) => (
        tiles.findIndex(candidate => candidate.x === tile.x && candidate.y === tile.y) === index
      ))
      .filter(tile => this.widget.isCharacterTileWalkable(tile))
      .sort((left, right) => getGridDistance(origin, left) - getGridDistance(origin, right));

    return targetCandidates[0] ? { ...targetCandidates[0] } : null;
  }

  private getMapObjectTiles(object: TownMapObjectData): Position[] {
    const tiles: Position[] = [];

    for (let y = object.y; y < object.y + object.length; y++) {
      for (let x = object.x; x < object.x + object.width; x++) {
        tiles.push({ x, y });
      }
    }

    return tiles;
  }
}

function getMapObjectDistance(object: TownMapObjectData, position: Position): number {
  const minX = object.x;
  const maxX = object.x + object.width - 1;
  const minY = object.y;
  const maxY = object.y + object.length - 1;
  const nearestX = Math.min(maxX, Math.max(minX, position.x));
  const nearestY = Math.min(maxY, Math.max(minY, position.y));

  return getGridDistance(position, { x: nearestX, y: nearestY });
}

function getGridDistance(from: Position, to: Position): number {
  return Math.max(Math.abs(from.x - to.x), Math.abs(from.y - to.y));
}
