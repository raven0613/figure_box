import type {
  ActorId,
  ActorInventory,
  ItemInstance,
  ItemInstanceId,
} from '~/typing/item';

export interface ItemStoreSnapshot {
  itemInstances: readonly ItemInstance[];
}

export class ItemStore {
  private readonly itemInstancesById = new Map<ItemInstanceId, ItemInstance>();

  constructor(snapshot?: ItemStoreSnapshot) {
    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  loadSnapshot(snapshot: ItemStoreSnapshot): void {
    this.itemInstancesById.clear();

    snapshot.itemInstances.forEach(itemInstance => {
      this.itemInstancesById.set(itemInstance.id, itemInstance);
    });
  }

  getSnapshot(): ItemStoreSnapshot {
    return {
      itemInstances: this.getItemInstances(),
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
  }
}
