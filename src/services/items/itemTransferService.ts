import type {
  ActorId,
  ItemInstance,
  ItemInstanceId,
  ItemTransferHistoryEntry,
  ItemTransferReason,
} from '~/typing/item';
import { itemService, type ItemService } from './itemService';
import { appendItemTransferHistoryEntry } from './itemTransferHistory';

export interface TransferItemInput {
  itemInstanceId: ItemInstanceId;
  fromActorId?: ActorId;
  toActorId: ActorId;
  reason: ItemTransferReason;
  day: number;
  quantity?: number;
  timeOfDay?: string;
}

export interface TransferItemResult {
  itemInstance: ItemInstance;
  sourceItemInstance?: ItemInstance;
  previousOwnerActorId?: ActorId;
}

const TRANSFER_BLOCKED_STATES = ['consumed', 'shopStock', 'transferring'] as const;
const DEFAULT_TRANSFER_QUANTITY = 1;

export class ItemTransferService {
  private readonly items: ItemService;

  constructor(items: ItemService = itemService) {
    this.items = items;
  }

  transferItem(input: TransferItemInput): TransferItemResult {
    const itemInstance = this.items.getItemInstance(input.itemInstanceId);

    if (!itemInstance) {
      throw new Error(`Item instance "${input.itemInstanceId}" does not exist.`);
    }

    if (TRANSFER_BLOCKED_STATES.some(state => state === itemInstance.state)) {
      throw new Error(`Item instance "${input.itemInstanceId}" cannot transfer from state "${itemInstance.state}".`);
    }

    if (input.fromActorId && itemInstance.ownerActorId !== input.fromActorId) {
      throw new Error(`Actor "${input.fromActorId}" does not own item instance "${input.itemInstanceId}".`);
    }

    const definition = this.items.getDefinitionOrThrow(itemInstance.definitionId);
    const transferQuantity = input.quantity ?? DEFAULT_TRANSFER_QUANTITY;

    this.assertValidTransferQuantity(itemInstance, transferQuantity);

    if (definition.stackable) {
      return this.transferStackableItem({
        itemInstance,
        input,
        transferQuantity,
      });
    }

    const updatedItemInstance = this.items.updateItemInstance({
      ...itemInstance,
      ownerActorId: input.toActorId,
      state: 'stored',
      transferHistory: appendItemTransferHistoryEntry(
        itemInstance.transferHistory,
        this.createTransferHistoryEntry(input, itemInstance.ownerActorId, transferQuantity),
      ),
    });

    return {
      itemInstance: updatedItemInstance,
      previousOwnerActorId: itemInstance.ownerActorId,
    };
  }

  private transferStackableItem({
    itemInstance,
    input,
    transferQuantity,
  }: {
    itemInstance: ItemInstance;
    input: TransferItemInput;
    transferQuantity: number;
  }): TransferItemResult {
    const transferHistoryEntry = this.createTransferHistoryEntry(
      input,
      itemInstance.ownerActorId,
      transferQuantity,
    );
    const remainingQuantity = itemInstance.quantity - transferQuantity;
    const sourceItemInstance = remainingQuantity > 0
      ? this.items.updateItemInstance({
        ...itemInstance,
        quantity: remainingQuantity,
        transferHistory: appendItemTransferHistoryEntry(
          itemInstance.transferHistory,
          transferHistoryEntry,
        ),
      })
      : undefined;

    if (remainingQuantity === 0) {
      this.items.removeItemInstance(itemInstance.id);
    }
    const targetItemInstance = this.items.createItemInstance({
      definitionId: itemInstance.definitionId,
      fromActorId: itemInstance.ownerActorId,
      ownerActorId: input.toActorId,
      quantity: transferQuantity,
      reason: input.reason,
      day: input.day,
      timeOfDay: input.timeOfDay,
    });

    return {
      itemInstance: targetItemInstance,
      sourceItemInstance,
      previousOwnerActorId: itemInstance.ownerActorId,
    };
  }

  private assertValidTransferQuantity(itemInstance: ItemInstance, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Transfer quantity for item instance "${itemInstance.id}" must be a positive integer.`);
    }

    if (quantity > itemInstance.quantity) {
      throw new Error(`Transfer quantity for item instance "${itemInstance.id}" cannot exceed owned quantity.`);
    }
  }

  private createTransferHistoryEntry(
    input: TransferItemInput,
    fromActorId: ActorId | undefined,
    quantity: number,
  ): ItemTransferHistoryEntry {
    return {
      ...(fromActorId ? { fromActorId } : {}),
      toActorId: input.toActorId,
      reason: input.reason,
      day: input.day,
      quantity,
      ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
    };
  }
}

export const itemTransferService = new ItemTransferService();
