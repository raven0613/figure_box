import { itemPlacementService } from '~/services/items/itemPlacementService';
import { itemService } from '~/services/items/itemService';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { TownMapTile } from '~/widgets/townMapGrid';
import type {
  ItemDefinition,
  ItemInstance,
  MapId,
  PlacedObject,
} from '~/typing/item';

export interface PlacedItemView {
  placedObject: PlacedObject;
  definition: ItemDefinition;
}

export interface PlacedItemMenuView {
  placedObject: PlacedObject;
  itemInstance: ItemInstance;
  definition: ItemDefinition;
}

export function getTilePlacementBlockReason(tile: TownMapTile, widget: FabricTownMapWidget): string | null {
  if (!tile.cell.walkable) {
    return '這格不能放置物品。';
  }

  if (widget.getOccupantIdsAt(tile.x, tile.y).length > 0) {
    return '角色站著的格子目前不能放置物品。';
  }

  if (widget.getMapObjectsAt(tile.x, tile.y).length > 0) {
    return '已有地圖物件的格子目前不能放置物品。';
  }

  return null;
}

export function getPlacedItemViews(mapId: MapId): readonly PlacedItemView[] {
  return itemPlacementService.getPlacedObjects(mapId)
    .map(placedObject => {
      const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);

      if (!itemInstance) {
        return null;
      }

      const definition = itemService.getDefinition(itemInstance.definitionId);

      if (!definition) {
        return null;
      }

      return {
        placedObject,
        definition,
      };
    })
    .filter((item): item is PlacedItemView => item !== null);
}

export function getPlacedItemMenuView(placedObjectId: string): PlacedItemMenuView | null {
  const placedObject = itemPlacementService.getPlacedObject(placedObjectId);

  if (!placedObject) {
    return null;
  }

  const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);

  if (!itemInstance) {
    return null;
  }

  const definition = itemService.getDefinition(itemInstance.definitionId);

  if (!definition) {
    return null;
  }

  return {
    placedObject,
    itemInstance,
    definition,
  };
}
