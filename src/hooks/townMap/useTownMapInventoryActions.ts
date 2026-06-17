import { useCallback, useEffect, useState } from 'react';

import type { TownCharacterController } from '~/services/townCharacterController';
import { saveService } from '~/services/save/saveService';
import { itemService, type InventoryGroup } from '~/services/items/itemService';
import { itemTransferService } from '~/services/items/itemTransferService';
import { DEFAULT_ITEM_SHOP_ID, shopService } from '~/services/items/shopService';
import type {
  ItemDefinition,
  ItemDefinitionId,
  ItemInstance,
  ShopStockItem,
} from '~/typing/item';

interface CharacterInventoryWindowState {
  characterId: string;
  characterName: string;
  groups: readonly InventoryGroup[];
}

interface UseTownMapInventoryActionsOptions {
  actorId: string;
  characterControllerRef: { current: TownCharacterController | null };
}

const PLAYER_DEMO_ITEM_IDS: readonly ItemDefinitionId[] = [
  'apple',
  'clear_gem',
  'silver_bracelet',
  'wooden_chair',
];

export function useTownMapInventoryActions({
  actorId,
  characterControllerRef,
}: UseTownMapInventoryActionsOptions) {
  const [playerInventoryGroups, setPlayerInventoryGroups] = useState<readonly InventoryGroup[]>([]);
  const [shopStockItems, setShopStockItems] = useState<readonly ShopStockItem[]>([]);
  const [transferHistoryItem, setTransferHistoryItem] = useState<ItemInstance | null>(null);
  const [characterInventoryWindow, setCharacterInventoryWindow] = useState<CharacterInventoryWindowState | null>(null);

  const refreshPlayerInventory = useCallback(() => {
    setPlayerInventoryGroups(itemService.getActorInventoryGroups(actorId, { states: ['stored'] }));
    saveService.scheduleSaveItems();
  }, [actorId]);

  const refreshShopStock = useCallback(() => {
    setShopStockItems(shopService.getStock(DEFAULT_ITEM_SHOP_ID));
    saveService.markDirty('shops');
  }, []);

  const refreshOpenCharacterInventory = useCallback((characterId: string) => {
    setCharacterInventoryWindow(currentWindow => {
      if (!currentWindow || currentWindow.characterId !== characterId) {
        return currentWindow;
      }

      return {
        ...currentWindow,
        groups: itemService.getActorInventoryGroups(characterId),
      };
    });
  }, []);

  const getItemDefinition = useCallback((definitionId: string): ItemDefinition | null => (
    itemService.getDefinition(definitionId)
  ), []);

  const openTransferHistory = useCallback((itemInstance: ItemInstance) => {
    setTransferHistoryItem(itemService.getItemInstance(itemInstance.id) ?? itemInstance);
  }, []);

  const closeTransferHistory = useCallback(() => {
    setTransferHistoryItem(null);
  }, []);

  const updateTransferHistoryItem = useCallback((
    updater: (currentItemInstance: ItemInstance | null) => ItemInstance | null,
  ) => {
    setTransferHistoryItem(updater);
  }, []);

  const giftItemToCharacter = useCallback((itemInstance: ItemInstance, targetCharacterId: string) => {
    const latestItemInstance = itemService.getItemInstance(itemInstance.id);

    if (!latestItemInstance || latestItemInstance.ownerActorId !== actorId) {
      refreshPlayerInventory();
      return;
    }

    const itemDefinition = itemService.getDefinition(latestItemInstance.definitionId);

    if (!itemDefinition) {
      return;
    }

    itemTransferService.transferItem({
      itemInstanceId: latestItemInstance.id,
      fromActorId: actorId,
      toActorId: targetCharacterId,
      reason: 'gift',
      day: 1,
      quantity: 1,
    });

    refreshPlayerInventory();
    updateTransferHistoryItem(currentItemInstance => {
      if (!currentItemInstance) {
        return null;
      }

      return itemService.getItemInstance(currentItemInstance.id) ?? null;
    });
    refreshOpenCharacterInventory(targetCharacterId);
    characterControllerRef.current?.markCharacterRequestItemReceived({
      characterId: targetCharacterId,
      itemId: itemDefinition.id,
      itemType: itemDefinition.type,
      itemCategory: itemDefinition.category,
      itemTags: itemDefinition.tags,
      itemDefinition,
    });

  }, [
    actorId,
    characterControllerRef,
    refreshOpenCharacterInventory,
    refreshPlayerInventory,
    updateTransferHistoryItem,
  ]);

  const purchaseShopItem = useCallback((stockItem: ShopStockItem) => {
    if (stockItem.stock <= 0) {
      return;
    }

    try {
      const purchaseResult = shopService.purchaseItem({
        shopId: DEFAULT_ITEM_SHOP_ID,
        stockItemId: stockItem.id,
        buyerActorId: actorId,
        day: 1,
      });
      updateTransferHistoryItem(currentItemInstance => {
        if (!currentItemInstance || currentItemInstance.id !== purchaseResult.itemInstanceId) {
          return currentItemInstance;
        }

        return itemService.getItemInstance(purchaseResult.itemInstanceId) ?? currentItemInstance;
      });
    } catch {
      refreshShopStock();
      return;
    }

    refreshShopStock();
    refreshPlayerInventory();
  }, [actorId, refreshPlayerInventory, refreshShopStock, updateTransferHistoryItem]);

  const openCharacterInventory = useCallback((characterId: string, characterName: string) => {
    setCharacterInventoryWindow({
      characterId,
      characterName,
      groups: itemService.getActorInventoryGroups(characterId),
    });
  }, []);

  const closeCharacterInventory = useCallback(() => {
    setCharacterInventoryWindow(null);
  }, []);

  useEffect(() => {
    seedDemoPlayerInventory(actorId);
    refreshPlayerInventory();
    refreshShopStock();
  }, [actorId, refreshPlayerInventory, refreshShopStock]);

  return {
    characterInventoryWindow,
    closeCharacterInventory,
    closeTransferHistory,
    getItemDefinition,
    giftItemToCharacter,
    openCharacterInventory,
    openTransferHistory,
    playerInventoryGroups,
    purchaseShopItem,
    refreshPlayerInventory,
    refreshShopStock,
    shopStockItems,
    transferHistoryItem,
    updateTransferHistoryItem,
  };
}

function seedDemoPlayerInventory(actorId: string): void {
  if (itemService.getActorItems(actorId).length > 0) {
    return;
  }

  PLAYER_DEMO_ITEM_IDS.forEach((definitionId, index) => {
    itemService.createItemInstance({
      definitionId,
      ownerActorId: actorId,
      quantity: definitionId === 'apple' ? 3 : 1,
      day: index + 1,
    });
  });
}
