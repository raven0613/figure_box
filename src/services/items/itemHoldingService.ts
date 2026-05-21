import type {
  ActorId,
  ItemDefinitionId,
  ItemInstance,
  ItemInstanceId,
} from '~/typing/item';
import { itemService, type ItemService } from './itemService';

export interface HoldItemForActorInput {
  actorId: ActorId;
  definitionId: ItemDefinitionId;
}

export interface HeldItemRecord {
  actorId: ActorId;
  itemInstanceId: ItemInstanceId;
}

export class ItemHoldingService {
  private readonly items: ItemService;
  private readonly heldItemsByActorId = new Map<ActorId, HeldItemRecord>();

  constructor(items: ItemService = itemService) {
    this.items = items;
  }

  holdItemForActor(input: HoldItemForActorInput): ItemInstance {
    const currentHeldItem = this.items.getActorItems(input.actorId)
      .find(itemInstance => (
        itemInstance.definitionId === input.definitionId &&
        itemInstance.state === 'held'
      ));

    if (currentHeldItem) {
      this.heldItemsByActorId.set(input.actorId, {
        actorId: input.actorId,
        itemInstanceId: currentHeldItem.id,
      });
      return currentHeldItem;
    }

    this.releaseHeldItemForActor(input.actorId);

    const itemInstance = this.getOrCreateActorItem(input);
    const heldItemInstance = this.items.updateItemInstance({
      ...itemInstance,
      state: 'held',
    });

    this.heldItemsByActorId.set(input.actorId, {
      actorId: input.actorId,
      itemInstanceId: heldItemInstance.id,
    });

    return heldItemInstance;
  }

  releaseHeldItemForActor(actorId: ActorId): ItemInstance | null {
    const heldItem = this.heldItemsByActorId.get(actorId);

    if (!heldItem) {
      return null;
    }

    this.heldItemsByActorId.delete(actorId);

    const itemInstance = this.items.getItemInstance(heldItem.itemInstanceId);

    if (!itemInstance) {
      return null;
    }

    return this.items.updateItemInstance({
      ...itemInstance,
      state: 'stored',
    });
  }

  getHeldItem(actorId: ActorId): HeldItemRecord | null {
    return this.heldItemsByActorId.get(actorId) ?? null;
  }

  restoreHeldItemForActor(actorId: ActorId): ItemInstance | null {
    const heldItemInstance = this.items.getActorItems(actorId)
      .find(itemInstance => itemInstance.state === 'held');

    if (!heldItemInstance) {
      this.heldItemsByActorId.delete(actorId);
      return null;
    }

    this.heldItemsByActorId.set(actorId, {
      actorId,
      itemInstanceId: heldItemInstance.id,
    });

    return heldItemInstance;
  }

  clear(): void {
    this.heldItemsByActorId.clear();
  }

  private getOrCreateActorItem(input: HoldItemForActorInput): ItemInstance {
    const existingItem = this.items.getActorItems(input.actorId)
      .find(itemInstance => (
        itemInstance.definitionId === input.definitionId &&
        itemInstance.state === 'stored'
      ));

    if (existingItem) {
      return existingItem;
    }

    throw new Error(`Actor "${input.actorId}" does not own a stored "${input.definitionId}" item.`);
  }
}

export const itemHoldingService = new ItemHoldingService();
