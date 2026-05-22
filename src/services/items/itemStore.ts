import type {
  ActorId,
  ActorInventory,
  ItemInstance,
  ItemInstanceId,
  MapId,
  MapObjectId,
  PlacedObject,
} from '~/typing/item';

export interface ItemStoreSnapshot {
  itemInstances: readonly ItemInstance[];
  placedObjects?: readonly PlacedObject[];
}

export class ItemStore {
  private readonly itemInstancesById = new Map<ItemInstanceId, ItemInstance>();
  private readonly placedObjectsById = new Map<MapObjectId, PlacedObject>();

  constructor(snapshot?: ItemStoreSnapshot) {
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  loadSnapshot(snapshot: ItemStoreSnapshot): void {
    this.itemInstancesById.clear();
    this.placedObjectsById.clear();

    snapshot.itemInstances.forEach(itemInstance => {
      this.itemInstancesById.set(itemInstance.id, itemInstance);
    });
    (snapshot.placedObjects ?? []).forEach(placedObject => {
      this.placedObjectsById.set(placedObject.id, placedObject);
    });
  }

  getSnapshot(): ItemStoreSnapshot {
    return {
      itemInstances: this.getItemInstances(),
      placedObjects: this.getPlacedObjects(),
    };
  }

  getItemInstances(): readonly ItemInstance[] {
    return Array.from(this.itemInstancesById.values());
  }

  getItemInstance(itemInstanceId: ItemInstanceId): ItemInstance | null {
    return this.itemInstancesById.get(itemInstanceId) ?? null;
  }

  getItemInstancesByOwner(actorId: ActorId): readonly ItemInstance[] {
    return this.getItemInstances()
      .filter(itemInstance => itemInstance.ownerActorId === actorId)
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  getActorInventory(actorId: ActorId): ActorInventory {
    return {
      actorId,
      itemInstanceIds: this.getItemInstancesByOwner(actorId)
        .map(itemInstance => itemInstance.id),
    };
  }

  getPlacedObjects(mapId?: MapId): readonly PlacedObject[] {
    const placedObjects = Array.from(this.placedObjectsById.values());

    if (!mapId) {
      return placedObjects;
    }

    return placedObjects.filter(placedObject => placedObject.mapId === mapId);
  }

  getPlacedObject(placedObjectId: MapObjectId): PlacedObject | null {
    return this.placedObjectsById.get(placedObjectId) ?? null;
  }

  addPlacedObject(placedObject: PlacedObject): PlacedObject {
    if (this.placedObjectsById.has(placedObject.id)) {
      throw new Error(`Placed object "${placedObject.id}" already exists.`);
    }

    this.placedObjectsById.set(placedObject.id, placedObject);
    return placedObject;
  }

  removePlacedObject(placedObjectId: MapObjectId): PlacedObject | null {
    const placedObject = this.getPlacedObject(placedObjectId);

    if (!placedObject) {
      return null;
    }

    this.placedObjectsById.delete(placedObjectId);
    return placedObject;
  }

  addItemInstance(itemInstance: ItemInstance): ItemInstance {
    if (this.itemInstancesById.has(itemInstance.id)) {
      throw new Error(`Item instance "${itemInstance.id}" already exists.`);
    }

    this.itemInstancesById.set(itemInstance.id, itemInstance);
    return itemInstance;
  }

  updateItemInstance(itemInstance: ItemInstance): ItemInstance {
    if (!this.itemInstancesById.has(itemInstance.id)) {
      throw new Error(`Item instance "${itemInstance.id}" does not exist.`);
    }

    this.itemInstancesById.set(itemInstance.id, itemInstance);
    return itemInstance;
  }

  removeItemInstance(itemInstanceId: ItemInstanceId): ItemInstance | null {
    const itemInstance = this.getItemInstance(itemInstanceId);

    if (!itemInstance) {
      return null;
    }

    this.itemInstancesById.delete(itemInstanceId);
    return itemInstance;
  }

  clear(): void {
    this.itemInstancesById.clear();
    this.placedObjectsById.clear();
  }
}
