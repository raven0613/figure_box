import type {
  ActorId,
  ItemInstance,
  ItemInstanceId,
  ItemTransferReason,
} from '~/typing/item';
import { itemService, type ItemService } from './itemService';

export interface TransferItemInput {
  itemInstanceId: ItemInstanceId;
  fromActorId?: ActorId;
  toActorId: ActorId;
  reason: ItemTransferReason;
  day: number;
  timeOfDay?: string;
}

export interface TransferItemResult {
  itemInstance: ItemInstance;
  previousOwnerActorId?: ActorId;
}

const TRANSFER_BLOCKED_STATES = ['consumed', 'shopStock', 'transferring'] as const;

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

    const updatedItemInstance = this.items.updateItemInstance({
      ...itemInstance,
      ownerActorId: input.toActorId,
      state: 'stored',
      transferHistory: [
        ...(itemInstance.transferHistory ?? []),
        {
          ...(itemInstance.ownerActorId ? { fromActorId: itemInstance.ownerActorId } : {}),
          toActorId: input.toActorId,
          reason: input.reason,
          day: input.day,
          ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
        },
      ],
    });

    return {
      itemInstance: updatedItemInstance,
      previousOwnerActorId: itemInstance.ownerActorId,
    };
  }
}

export const itemTransferService = new ItemTransferService();
