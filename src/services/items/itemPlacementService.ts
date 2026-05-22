import type {
  ActorId,
  ItemInstanceId,
  ItemPosition,
  MapId,
  MapObjectId,
  PlacedObject,
  PlacementSurfaceType,
} from '~/typing/item';
import { itemService, type ItemService } from './itemService';

interface ItemPlacementServiceOptions {
  items?: ItemService;
}

export interface PlaceItemOnMapInput {
  itemInstanceId: ItemInstanceId;
  ownerActorId: ActorId;
  mapId: MapId;
  worldPosition: ItemPosition;
  surfaceType?: PlacementSurfaceType;
}

export interface PickupPlacedItemInput {
  placedObjectId: MapObjectId;
  actorId: ActorId;
}

export class ItemPlacementService {
  private readonly items: ItemService;

  constructor(options: ItemPlacementServiceOptions = {}) {
    this.items = options.items ?? itemService;
  }

  placeItemOnMap(input: PlaceItemOnMapInput): PlacedObject {
    const itemInstance = this.items.getItemInstance(input.itemInstanceId);

    if (!itemInstance) {
      throw new Error(`Item instance "${input.itemInstanceId}" does not exist.`);
    }

    if (itemInstance.ownerActorId !== input.ownerActorId) {
      throw new Error(`Actor "${input.ownerActorId}" does not own item instance "${input.itemInstanceId}".`);
    }

    if (itemInstance.state !== 'stored') {
      throw new Error(`Item instance "${input.itemInstanceId}" must be stored before placing.`);
    }

    if (itemInstance.quantity !== 1) {
      throw new Error('Only quantity 1 item stacks can be placed on the map for now.');
    }

    const definition = this.items.getDefinitionOrThrow(itemInstance.definitionId);

    if (!definition.placement) {
      throw new Error(`Item definition "${definition.id}" cannot be placed on the map.`);
    }

    this.assertWorldPositionIsAvailable(input.mapId, input.worldPosition);

    const placedObject = this.items.createPlacedObject({
      itemInstanceId: itemInstance.id,
      mapId: input.mapId,
      surfaceType: input.surfaceType ?? 'floor',
      worldPosition: input.worldPosition,
    });

    this.items.updateItemInstance({
      ...itemInstance,
      state: 'placed',
    });
    return placedObject;
  }

  pickupPlacedItem(input: PickupPlacedItemInput): PlacedObject {
    const placedObject = this.items.getPlacedObject(input.placedObjectId);

    if (!placedObject) {
      throw new Error(`Placed object "${input.placedObjectId}" does not exist.`);
    }

    const itemInstance = this.items.getItemInstance(placedObject.itemInstanceId);

    if (!itemInstance) {
      throw new Error(`Placed object "${input.placedObjectId}" references a missing item instance.`);
    }

    if (itemInstance.state !== 'placed') {
      throw new Error(`Item instance "${itemInstance.id}" is not placed.`);
    }

    if (itemInstance.ownerActorId !== input.actorId) {
      throw new Error(`Actor "${input.actorId}" cannot pick up item instance "${itemInstance.id}".`);
    }

    this.items.updateItemInstance({
      ...itemInstance,
      ownerActorId: input.actorId,
      state: 'stored',
    });
    this.items.removePlacedObject(placedObject.id);
    return placedObject;
  }

  getPlacedObject(placedObjectId: MapObjectId): PlacedObject | null {
    return this.items.getPlacedObject(placedObjectId);
  }

  getPlacedObjects(mapId?: MapId): readonly PlacedObject[] {
    return this.items.getPlacedObjects(mapId);
  }

  clear(): void {
    this.items.getPlacedObjects().forEach(placedObject => {
      const itemInstance = this.items.getItemInstance(placedObject.itemInstanceId);

      if (itemInstance?.state === 'placed') {
        this.items.updateItemInstance({
          ...itemInstance,
          state: 'stored',
        });
      }

      this.items.removePlacedObject(placedObject.id);
    });
  }

  private assertWorldPositionIsAvailable(mapId: MapId, worldPosition: ItemPosition): void {
    const existingPlacedObject = this.items.getPlacedObjects(mapId).find(placedObject => (
      placedObject.worldPosition?.x === worldPosition.x &&
      placedObject.worldPosition?.y === worldPosition.y
    ));

    if (existingPlacedObject) {
      throw new Error(`Map position "${worldPosition.x},${worldPosition.y}" already has a placed item.`);
    }
  }
}

export const itemPlacementService = new ItemPlacementService();
