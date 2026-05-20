import {
  INVENTORY_GROUP_RULES,
  ITEM_DEFINITIONS,
} from '~/constants/items';
import type {
  ActorId,
  ActorInventory,
  InventoryGroupId,
  InventoryGroupRule,
  ItemDefinition,
  ItemDefinitionId,
  ItemInstance,
  ItemInstanceId,
  ItemState,
} from '~/typing/item';
import { EmptyItemSavePort, type ItemSavePort } from './itemSavePort';
import { matchesItemDefinition } from './itemMatcher';
import { ItemStore, type ItemStoreSnapshot } from './itemStore';

interface ItemServiceOptions {
  definitions?: readonly ItemDefinition[];
  inventoryGroupRules?: readonly InventoryGroupRule[];
  savePort?: ItemSavePort;
  store?: ItemStore;
}

export interface CreateItemInstanceInput {
  definitionId: ItemDefinitionId;
  ownerActorId?: ActorId;
  quantity?: number;
  state?: ItemState;
  day?: number;
}

export interface InventoryGroup {
  id: InventoryGroupId;
  labelKey: string;
  itemInstances: readonly ItemInstance[];
}

const DEFAULT_ITEM_QUANTITY = 1;

export class ItemService {
  private nextInstanceNumber = 1;
  private readonly definitionsById: Map<ItemDefinitionId, ItemDefinition>;
  private readonly inventoryGroupRules: readonly InventoryGroupRule[];
  private readonly savePort: ItemSavePort;
  private readonly store: ItemStore;

  constructor(options: ItemServiceOptions = {}) {
    const definitions = options.definitions ?? ITEM_DEFINITIONS;

    this.definitionsById = new Map(definitions.map(definition => [definition.id, definition]));
    this.inventoryGroupRules = options.inventoryGroupRules ?? INVENTORY_GROUP_RULES;
    this.savePort = options.savePort ?? new EmptyItemSavePort();
    this.store = options.store ?? new ItemStore();
  }

  async load(): Promise<void> {
    const snapshot = await this.savePort.loadItemSnapshot();

    if (snapshot) {
      this.loadSnapshot(snapshot);
    }
  }

  async save(): Promise<void> {
    await this.savePort.saveItemSnapshot(this.getSnapshot());
  }

  loadSnapshot(snapshot: ItemStoreSnapshot): void {
    this.store.loadSnapshot(snapshot);
    this.nextInstanceNumber = this.getNextInstanceNumber(snapshot.itemInstances);
  }

  getSnapshot(): ItemStoreSnapshot {
    return this.store.getSnapshot();
  }

  getDefinitions(): readonly ItemDefinition[] {
    return Array.from(this.definitionsById.values());
  }

  getDefinition(definitionId: ItemDefinitionId): ItemDefinition | null {
    return this.definitionsById.get(definitionId) ?? null;
  }

  getDefinitionOrThrow(definitionId: ItemDefinitionId): ItemDefinition {
    const definition = this.getDefinition(definitionId);

    if (!definition) {
      throw new Error(`Item definition "${definitionId}" does not exist.`);
    }

    return definition;
  }

  getItemInstances(): readonly ItemInstance[] {
    return this.store.getItemInstances();
  }

  getItemInstance(itemInstanceId: ItemInstanceId): ItemInstance | null {
    return this.store.getItemInstance(itemInstanceId);
  }

  updateItemInstance(itemInstance: ItemInstance): ItemInstance {
    return this.store.updateItemInstance(itemInstance);
  }

  getActorItems(actorId: ActorId): readonly ItemInstance[] {
    return this.store.getItemInstancesByOwner(actorId);
  }

  getActorInventory(actorId: ActorId): ActorInventory {
    return this.store.getActorInventory(actorId);
  }

  getActorInventoryGroups(actorId: ActorId): readonly InventoryGroup[] {
    const itemInstances = this.getActorItems(actorId);
    const groupedItemIds = new Set<ItemInstanceId>();

    return this.inventoryGroupRules.map(rule => {
      const groupItemInstances = itemInstances.filter(itemInstance => {
        if (groupedItemIds.has(itemInstance.id)) {
          return false;
        }

        const definition = this.getDefinition(itemInstance.definitionId);

        if (!definition) {
          return false;
        }

        return rule.id === 'other' || matchesItemDefinition(definition, rule.match);
      });

      groupItemInstances.forEach(itemInstance => {
        groupedItemIds.add(itemInstance.id);
      });

      return {
        id: rule.id,
        labelKey: rule.labelKey,
        itemInstances: groupItemInstances,
      };
    });
  }

  createItemInstance(input: CreateItemInstanceInput): ItemInstance {
    const definition = this.getDefinitionOrThrow(input.definitionId);
    const quantity = input.quantity ?? DEFAULT_ITEM_QUANTITY;

    this.assertValidQuantity(definition, quantity);

    return this.store.addItemInstance({
      id: this.createItemInstanceId(definition.id),
      definitionId: definition.id,
      ownerActorId: input.ownerActorId,
      state: input.state ?? 'stored',
      quantity,
      transferHistory: input.ownerActorId
        ? [{
          toActorId: input.ownerActorId,
          reason: 'system',
          day: input.day ?? 0,
        }]
        : undefined,
    });
  }

  clear(): void {
    this.store.clear();
    this.nextInstanceNumber = 1;
  }

  private assertValidQuantity(definition: ItemDefinition, quantity: number): void {
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Item quantity for "${definition.id}" must be a positive integer.`);
    }

    if (!definition.stackable && quantity !== DEFAULT_ITEM_QUANTITY) {
      throw new Error(`Item "${definition.id}" is not stackable.`);
    }

    if (definition.maxStack !== undefined && quantity > definition.maxStack) {
      throw new Error(`Item quantity for "${definition.id}" cannot exceed ${definition.maxStack}.`);
    }
  }

  private createItemInstanceId(definitionId: ItemDefinitionId): ItemInstanceId {
    const instanceId = `item-${definitionId}-${this.nextInstanceNumber}`;
    this.nextInstanceNumber += 1;

    return instanceId;
  }

  private getNextInstanceNumber(itemInstances: readonly ItemInstance[]): number {
    const maxInstanceNumber = itemInstances.reduce((maxNumber, itemInstance) => {
      const match = itemInstance.id.match(/-(\d+)$/);

      if (!match) {
        return maxNumber;
      }

      return Math.max(maxNumber, Number(match[1]));
    }, 0);

    return maxInstanceNumber + 1;
  }
}

export const itemService = new ItemService();
