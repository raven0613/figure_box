import type {
  ActorId,
  ItemInstance,
  ItemInstanceId,
  ItemTransferHistoryEntry,
} from '~/typing/item';
import { itemService, type CreateItemInstanceInput, type ItemService } from './itemService';
import { appendItemTransferHistoryEntry } from './itemTransferHistory';

export interface ExtractItemQuantityInput {
  itemInstanceId: ItemInstanceId;
  quantity: number;
  createExtractedItemInput: Omit<CreateItemInstanceInput, 'definitionId' | 'quantity'>;
  sourceTransferHistoryEntry?: ItemTransferHistoryEntry;
  reuseSourceWhenExtractingAll?: boolean;
}

export interface ExtractItemQuantityResult {
  extractedItemInstance: ItemInstance;
  sourceItemInstance?: ItemInstance;
  previousOwnerActorId?: ActorId;
}

export interface MergeIntoStoredStackInput {
  itemInstanceId: ItemInstanceId;
  ownerActorId: ActorId;
}

export interface MergeIntoStoredStackResult {
  itemInstance: ItemInstance;
  mergedIntoItemInstance?: ItemInstance;
}

export class ItemStackService {
  private readonly items: ItemService;

  constructor(items: ItemService = itemService) {
    this.items = items;
  }

  extractItemQuantity(input: ExtractItemQuantityInput): ExtractItemQuantityResult {
    const itemInstance = this.getItemInstanceOrThrow(input.itemInstanceId);

    this.assertValidQuantity(itemInstance, input.quantity);

    const previousOwnerActorId = itemInstance.ownerActorId;

    if (input.quantity === itemInstance.quantity && input.reuseSourceWhenExtractingAll) {
      return {
        extractedItemInstance: this.items.updateItemInstance({
          ...itemInstance,
          ...this.getReusableSourceUpdates(input.createExtractedItemInput),
        }),
        previousOwnerActorId,
      };
    }

    const sourceItemInstance = this.removeQuantityFromSource(itemInstance, input);
    const extractedItemInstance = this.items.createItemInstance({
      ...input.createExtractedItemInput,
      definitionId: itemInstance.definitionId,
      quantity: input.quantity,
    });

    return {
      extractedItemInstance,
      sourceItemInstance,
      previousOwnerActorId,
    };
  }

  mergeIntoStoredStack(input: MergeIntoStoredStackInput): MergeIntoStoredStackResult {
    const itemInstance = this.getItemInstanceOrThrow(input.itemInstanceId);

    if (itemInstance.ownerActorId !== input.ownerActorId) {
      throw new Error(`Actor "${input.ownerActorId}" does not own item instance "${input.itemInstanceId}".`);
    }

    const definition = this.items.getDefinitionOrThrow(itemInstance.definitionId);
    const storedItemInstance = this.items.getActorItems(input.ownerActorId).find(actorItem => (
      actorItem.id !== itemInstance.id &&
      actorItem.definitionId === itemInstance.definitionId &&
      actorItem.state === 'stored' &&
      this.canMergeQuantities(actorItem.quantity, itemInstance.quantity, definition.maxStack)
    ));

    if (!definition.stackable || !storedItemInstance) {
      return {
        itemInstance: this.items.updateItemInstance({
          ...itemInstance,
          state: 'stored',
        }),
      };
    }

    const mergedIntoItemInstance = this.items.updateItemInstance({
      ...storedItemInstance,
      quantity: storedItemInstance.quantity + itemInstance.quantity,
    });

    this.items.removeItemInstance(itemInstance.id);
    return {
      itemInstance: mergedIntoItemInstance,
      mergedIntoItemInstance,
    };
  }

  private removeQuantityFromSource(
    itemInstance: ItemInstance,
    input: ExtractItemQuantityInput,
  ): ItemInstance | undefined {
    const remainingQuantity = itemInstance.quantity - input.quantity;

    if (remainingQuantity <= 0) {
      this.items.removeItemInstance(itemInstance.id);
      return undefined;
    }

    return this.items.updateItemInstance({
      ...itemInstance,
      quantity: remainingQuantity,
      transferHistory: input.sourceTransferHistoryEntry
        ? appendItemTransferHistoryEntry(itemInstance.transferHistory, input.sourceTransferHistoryEntry)
        : itemInstance.transferHistory,
    });
  }

  private getReusableSourceUpdates(
    input: Omit<CreateItemInstanceInput, 'definitionId' | 'quantity'>,
  ): Partial<ItemInstance> {
    return {
      ...(input.ownerActorId !== undefined ? { ownerActorId: input.ownerActorId } : {}),
      ...(input.state !== undefined ? { state: input.state } : {}),
      ...(input.transferHistory !== undefined ? { transferHistory: input.transferHistory } : {}),
    };
  }

  private getItemInstanceOrThrow(itemInstanceId: ItemInstanceId): ItemInstance {
    const itemInstance = this.items.getItemInstance(itemInstanceId);

    if (!itemInstance) {
      throw new Error(`Item instance "${itemInstanceId}" does not exist.`);
    }

    return itemInstance;
  }

  private assertValidQuantity(itemInstance: ItemInstance, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Item quantity for item instance "${itemInstance.id}" must be a positive integer.`);
    }

    if (quantity > itemInstance.quantity) {
      throw new Error(`Item quantity for item instance "${itemInstance.id}" cannot exceed owned quantity.`);
    }
  }

  private canMergeQuantities(
    currentQuantity: number,
    addedQuantity: number,
    maxStack: number | undefined,
  ): boolean {
    return maxStack === undefined || currentQuantity + addedQuantity <= maxStack;
  }
}

export const itemStackService = new ItemStackService();
