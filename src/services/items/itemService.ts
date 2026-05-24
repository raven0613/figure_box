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
  ItemTransferHistoryEntry,
  ItemTransferReason,
  ItemPosition,
  MapId,
  MapObjectId,
  PlacedObject,
  PlacementSurfaceType,
} from '~/typing/item';
import { EmptyItemSavePort, type ItemSavePort } from './itemSavePort';
import { matchesItemDefinition } from './itemMatcher';
import { ItemStore, type ItemStoreSnapshot } from './itemStore';
import { appendItemTransferHistoryEntry } from './itemTransferHistory';
import { IndexedDbItemSavePort } from '~/services/save/adapters/indexedDbItemSavePort';

interface ItemServiceOptions {
  definitions?: readonly ItemDefinition[];
  inventoryGroupRules?: readonly InventoryGroupRule[];
  savePort?: ItemSavePort;
  store?: ItemStore;
}

export interface CreateItemInstanceInput {
  definitionId: ItemDefinitionId;
  fromActorId?: ActorId;
  ownerActorId?: ActorId;
  quantity?: number;
  state?: ItemState;
  reason?: ItemTransferReason;
  day?: number;
  timeOfDay?: string;
  stacking?: 'mergeStored' | 'separate';
  transferHistory?: readonly ItemTransferHistoryEntry[];
}

export interface InventoryGroup {
  id: InventoryGroupId;
  labelKey: string;
  itemInstances: readonly ItemInstance[];
}

export interface GetActorInventoryGroupsOptions {
  states?: readonly ItemState[];
}

export interface CreatePlacedObjectInput {
  itemInstanceId: ItemInstanceId;
  mapId: MapId;
  surfaceType: PlacementSurfaceType;
  worldPosition?: ItemPosition;
  localPosition?: ItemPosition;
  parentObjectId?: MapObjectId;
  layer?: string;
}

const DEFAULT_ITEM_QUANTITY = 1;

export class ItemService {
  private nextInstanceNumber = 1;
  private nextPlacedObjectNumber = 1;
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
    this.nextPlacedObjectNumber = this.getNextPlacedObjectNumber(snapshot.placedObjects ?? []);
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

  removeItemInstance(itemInstanceId: ItemInstanceId): ItemInstance | null {
    return this.store.removeItemInstance(itemInstanceId);
  }

  getActorItems(actorId: ActorId): readonly ItemInstance[] {
    return this.store.getItemInstancesByOwner(actorId);
  }

  getActorInventory(actorId: ActorId): ActorInventory {
    return this.store.getActorInventory(actorId);
  }

  getPlacedObjects(mapId?: MapId): readonly PlacedObject[] {
    return this.store.getPlacedObjects(mapId);
  }

  getPlacedObject(placedObjectId: MapObjectId): PlacedObject | null {
    return this.store.getPlacedObject(placedObjectId);
  }

  createPlacedObject(input: CreatePlacedObjectInput): PlacedObject {
    return this.store.addPlacedObject({
      id: this.createPlacedObjectId(),
      itemInstanceId: input.itemInstanceId,
      mapId: input.mapId,
      surfaceType: input.surfaceType,
      ...(input.worldPosition ? { worldPosition: input.worldPosition } : {}),
      ...(input.localPosition ? { localPosition: input.localPosition } : {}),
      ...(input.parentObjectId ? { parentObjectId: input.parentObjectId } : {}),
      ...(input.layer ? { layer: input.layer } : {}),
    });
  }

  removePlacedObject(placedObjectId: MapObjectId): PlacedObject | null {
    return this.store.removePlacedObject(placedObjectId);
  }

  getActorInventoryGroups(
    actorId: ActorId,
    options: GetActorInventoryGroupsOptions = {},
  ): readonly InventoryGroup[] {
    const allowedStates = options.states ? new Set<ItemState>(options.states) : null;
    const itemInstances = allowedStates
      ? this.getActorItems(actorId).filter(itemInstance => allowedStates.has(itemInstance.state))
      : this.getActorItems(actorId);
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
    const transferHistoryEntry = input.transferHistory !== undefined
      ? null
      : this.createTransferHistoryEntry(input, quantity);

    this.assertValidQuantity(definition, quantity);

    const stackableItemInstance = input.stacking === 'separate'
      ? null
      : this.findStackableItemInstance(input.ownerActorId, definition.id, quantity);

    if (stackableItemInstance && transferHistoryEntry) {
      return this.store.updateItemInstance({
        ...stackableItemInstance,
        quantity: stackableItemInstance.quantity + quantity,
        transferHistory: appendItemTransferHistoryEntry(
          stackableItemInstance.transferHistory,
          transferHistoryEntry,
        ),
      });
    }

    return this.store.addItemInstance({
      id: this.createItemInstanceId(definition.id),
      definitionId: definition.id,
      ownerActorId: input.ownerActorId,
      state: input.state ?? 'stored',
      quantity,
      transferHistory: input.transferHistory ?? (input.ownerActorId && transferHistoryEntry ? [transferHistoryEntry] : undefined),
    });
  }

  clear(): void {
    this.store.clear();
    this.nextInstanceNumber = 1;
    this.nextPlacedObjectNumber = 1;
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

  private findStackableItemInstance(
    ownerActorId: ActorId | undefined,
    definitionId: ItemDefinitionId,
    quantity: number,
  ): ItemInstance | null {
    const definition = this.getDefinitionOrThrow(definitionId);

    if (!ownerActorId || !definition.stackable) {
      return null;
    }

    return this.store.getItemInstancesByOwner(ownerActorId).find(itemInstance => (
      itemInstance.definitionId === definitionId &&
      itemInstance.state === 'stored' &&
      this.canAddToStack(definition, itemInstance.quantity, quantity)
    )) ?? null;
  }

  private canAddToStack(definition: ItemDefinition, currentQuantity: number, addedQuantity: number): boolean {
    return definition.maxStack === undefined || currentQuantity + addedQuantity <= definition.maxStack;
  }

  private createTransferHistoryEntry(
    input: CreateItemInstanceInput,
    quantity: number,
  ): ItemTransferHistoryEntry {
    return {
      ...(input.fromActorId ? { fromActorId: input.fromActorId } : {}),
      ...(input.ownerActorId ? { toActorId: input.ownerActorId } : {}),
      reason: input.reason ?? 'system',
      day: input.day ?? 0,
      quantity,
      ...(input.timeOfDay ? { timeOfDay: input.timeOfDay } : {}),
    };
  }

  private createItemInstanceId(definitionId: ItemDefinitionId): ItemInstanceId {
    const instanceId = `item-${definitionId}-${this.nextInstanceNumber}`;
    this.nextInstanceNumber += 1;

    return instanceId;
  }

  private createPlacedObjectId(): MapObjectId {
    const placedObjectId = `placed-item-${this.nextPlacedObjectNumber}`;
    this.nextPlacedObjectNumber += 1;

    return placedObjectId;
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

  private getNextPlacedObjectNumber(placedObjects: readonly PlacedObject[]): number {
    const maxPlacedObjectNumber = placedObjects.reduce((maxNumber, placedObject) => {
      const match = placedObject.id.match(/-(\d+)$/);

      if (!match) {
        return maxNumber;
      }

      return Math.max(maxNumber, Number(match[1]));
    }, 0);

    return maxPlacedObjectNumber + 1;
  }
}

export const itemService = new ItemService({
  savePort: new IndexedDbItemSavePort(),
});
