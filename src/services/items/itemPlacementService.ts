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
import { ItemStackService } from './itemStackService';

interface ItemPlacementServiceOptions {
  items?: ItemService;
  stacks?: ItemStackService;
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
  private readonly stacks: ItemStackService;

  constructor(options: ItemPlacementServiceOptions = {}) {
    this.items = options.items ?? itemService;
    this.stacks = options.stacks ?? new ItemStackService(this.items);
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

    const definition = this.items.getDefinitionOrThrow(itemInstance.definitionId);

    if (!definition.placement) {
      throw new Error(`Item definition "${definition.id}" cannot be placed on the map.`);
    }

    this.assertWorldPositionIsAvailable(input.mapId, input.worldPosition);

    const extractionResult = this.stacks.extractItemQuantity({
      itemInstanceId: itemInstance.id,
      quantity: 1,
      reuseSourceWhenExtractingAll: true,
      createExtractedItemInput: {
        ownerActorId: input.ownerActorId,
        state: 'placed',
        stacking: 'separate',
        transferHistory: itemInstance.quantity > 1 ? itemInstance.transferHistory ?? [] : undefined,
      },
    });
    const placedObject = this.items.createPlacedObject({
      itemInstanceId: extractionResult.extractedItemInstance.id,
      mapId: input.mapId,
      surfaceType: input.surfaceType ?? 'floor',
      worldPosition: input.worldPosition,
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

    this.stacks.mergeIntoStoredStack({
      itemInstanceId: itemInstance.id,
      ownerActorId: input.actorId,
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

      if (itemInstance?.state === 'placed' && itemInstance.ownerActorId) {
        this.stacks.mergeIntoStoredStack({
          itemInstanceId: itemInstance.id,
          ownerActorId: itemInstance.ownerActorId,
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
