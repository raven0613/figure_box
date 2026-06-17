import { useCallback, useEffect, useRef, useState } from 'react';

import type { TownCharacterController } from '~/services/townCharacterController';
import { itemPlacementService } from '~/services/items/itemPlacementService';
import { itemService } from '~/services/items/itemService';
import {
  TOWN_APARTMENT_OBJECT_ID,
  TOWN_ITEM_SHOP_OBJECT_ID,
} from '~/constants/townMap';
import { GameSimWorldState } from '~/stateMachines/gameFlow/states';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { TownMapTile } from '~/widgets/townMapGrid';
import type { ItemInstance, MapId } from '~/typing/item';
import {
  getPlacedItemMenuView,
  getPlacedItemViews,
  getTilePlacementBlockReason,
} from '~/utils/townMapItemUtils';

interface PickupChainState {
  actorId: string;
}

interface PlacedItemMenuState {
  placedObjectId: string;
}

interface UseTownMapPlacementOptions {
  actorId: string;
  characterControllerRef: { current: TownCharacterController | null };
  mapId: MapId;
  simWorldState: GameSimWorldState;
  widgetRef: { current: FabricTownMapWidget | null };
  onGiftDragClear: () => void;
  onGiftTargetPickerClear: () => void;
  onOpenApartmentPanel: () => void;
  onOpenShopPanel: () => void;
  onSelectedMapObjectsChange: (mapObjects: string[]) => void;
  onSelectedTileChange: (tile: TownMapTile) => void;
  onTransferHistoryItemChange: (updater: (currentItemInstance: ItemInstance | null) => ItemInstance | null) => void;
  refreshPlayerInventory: () => void;
  refreshShopStock: () => void;
}

interface PickupPlacedItemOptions {
  closePlacedItemMenu?: boolean;
}

export function useTownMapPlacement({
  actorId,
  characterControllerRef,
  mapId,
  simWorldState,
  widgetRef,
  onGiftDragClear,
  onGiftTargetPickerClear,
  onOpenApartmentPanel,
  onOpenShopPanel,
  onSelectedMapObjectsChange,
  onSelectedTileChange,
  onTransferHistoryItemChange,
  refreshPlayerInventory,
  refreshShopStock,
}: UseTownMapPlacementOptions) {
  const [placementDraft, setPlacementDraft] = useState<ItemInstance | null>(null);
  const [placedItemMenu, setPlacedItemMenu] = useState<PlacedItemMenuState | null>(null);
  const [pickupChain, setPickupChain] = useState<PickupChainState | null>(null);
  const placementDraftRef = useRef<ItemInstance | null>(null);
  const pickupChainRef = useRef<PickupChainState | null>(null);
  const placedItemMenuView = placedItemMenu
    ? getPlacedItemMenuView(placedItemMenu.placedObjectId)
    : null;

  const cancelPlacementDraft = useCallback(() => {
    placementDraftRef.current = null;
    setPlacementDraft(null);
  }, []);

  const cancelPickupChain = useCallback(() => {
    pickupChainRef.current = null;
    setPickupChain(null);
  }, []);

  const closePlacedItemMenu = useCallback(() => {
    setPlacedItemMenu(null);
  }, []);

  const syncPlacedItems = useCallback(() => {
    widgetRef.current?.syncPlacedItems(getPlacedItemViews(mapId));
  }, [mapId, widgetRef]);

  const pickupPlacedItem = useCallback((
    placedObjectId: string,
    options: PickupPlacedItemOptions = {},
  ) => {
    const shouldClosePlacedItemMenu = options.closePlacedItemMenu ?? true;
    const placedObject = itemPlacementService.getPlacedObject(placedObjectId);

    if (!placedObject) {
      if (shouldClosePlacedItemMenu) {
        setPlacedItemMenu(null);
      }

      syncPlacedItems();
      return false;
    }

    try {
      const pickedUpPlacedObject = itemPlacementService.pickupPlacedItem({
        placedObjectId: placedObject.id,
        actorId,
      });

      if (pickedUpPlacedObject.worldPosition) {
        characterControllerRef.current?.dispatchEventOccurrence({
          eventId: 'world.mapItem.pickedUp',
          sourceActorId: actorId,
          position: pickedUpPlacedObject.worldPosition,
          payload: {
            placedObjectId: pickedUpPlacedObject.id,
            itemInstanceId: pickedUpPlacedObject.itemInstanceId,
          },
        });
      }
    } catch (error) {
      window.alert(error instanceof Error ? error.message : '撿起物品失敗。');
      refreshPlayerInventory();
      syncPlacedItems();
      return false;
    }

    if (shouldClosePlacedItemMenu) {
      setPlacedItemMenu(null);
    }

    refreshPlayerInventory();
    syncPlacedItems();
    onTransferHistoryItemChange(currentItemInstance => {
      if (!currentItemInstance || currentItemInstance.id !== placedObject.itemInstanceId) {
        return currentItemInstance;
      }

      return itemService.getItemInstance(placedObject.itemInstanceId) ?? null;
    });
    return true;
  }, [
    actorId,
    characterControllerRef,
    onTransferHistoryItemChange,
    refreshPlayerInventory,
    syncPlacedItems,
  ]);

  const startPickupChain = useCallback((placedObjectId: string) => {
    const didPickup = pickupPlacedItem(placedObjectId, { closePlacedItemMenu: false });

    if (!didPickup) {
      return;
    }

    setPlacedItemMenu(null);
    pickupChainRef.current = { actorId };
    setPickupChain({ actorId });
  }, [actorId, pickupPlacedItem]);

  const startPlacingItem = useCallback((itemInstance: ItemInstance) => {
    const latestItemInstance = itemService.getItemInstance(itemInstance.id);

    if (!latestItemInstance || latestItemInstance.ownerActorId !== actorId) {
      refreshPlayerInventory();
      return;
    }

    if (latestItemInstance.state !== 'stored') {
      window.alert('這個物品目前不在玩家背包裡。');
      refreshPlayerInventory();
      return;
    }

    const definition = itemService.getDefinition(latestItemInstance.definitionId);

    if (!definition?.placement) {
      window.alert('這個物品目前沒有地圖放置設定。');
      return;
    }

    onGiftDragClear();
    onGiftTargetPickerClear();
    setPlacedItemMenu(null);
    cancelPickupChain();
    placementDraftRef.current = latestItemInstance;
    setPlacementDraft(latestItemInstance);
    widgetRef.current?.setCharacterDraggingEnabled(false);
  }, [
    actorId,
    cancelPickupChain,
    onGiftDragClear,
    onGiftTargetPickerClear,
    refreshPlayerInventory,
    widgetRef,
  ]);

  const handleTileClick = useCallback((tile: TownMapTile, widget: FabricTownMapWidget) => {
    const placementItem = placementDraftRef.current;

    if (placementItem) {
      const latestItemInstance = itemService.getItemInstance(placementItem.id);

      if (!latestItemInstance) {
        cancelPlacementDraft();
        refreshPlayerInventory();
        return;
      }

      const placementBlockReason = getTilePlacementBlockReason(tile, widget);

      if (placementBlockReason) {
        window.alert(placementBlockReason);
        return;
      }

      try {
        const placedObject = itemPlacementService.placeItemOnMap({
          itemInstanceId: latestItemInstance.id,
          ownerActorId: actorId,
          mapId,
          worldPosition: {
            x: tile.x,
            y: tile.y,
          },
        });
        characterControllerRef.current?.dispatchEventOccurrence({
          eventId: 'world.mapItem.placed',
          sourceActorId: actorId,
          position: {
            x: tile.x,
            y: tile.y,
          },
          payload: {
            placedObjectId: placedObject.id,
            itemInstanceId: placedObject.itemInstanceId,
            itemDefinitionId: latestItemInstance.definitionId,
          },
        });
      } catch (error) {
        window.alert(error instanceof Error ? error.message : '放置物品失敗。');
        refreshPlayerInventory();
        return;
      }

      const nextPlacementItem = itemService.getItemInstance(latestItemInstance.id);

      if (nextPlacementItem?.ownerActorId === actorId && nextPlacementItem.state === 'stored') {
        placementDraftRef.current = nextPlacementItem;
        setPlacementDraft(nextPlacementItem);
      } else {
        cancelPlacementDraft();
      }

      onSelectedTileChange(tile);
      onSelectedMapObjectsChange(widget.getMapObjectsAt(tile.x, tile.y).map(object => object.label));
      refreshPlayerInventory();
      widget.syncPlacedItems(getPlacedItemViews(mapId));
      onTransferHistoryItemChange(currentItemInstance => {
        if (!currentItemInstance || currentItemInstance.id !== latestItemInstance.id) {
          return currentItemInstance;
        }

        return itemService.getItemInstance(latestItemInstance.id) ?? currentItemInstance;
      });
      return;
    }

    if (pickupChainRef.current) {
      return;
    }

    onSelectedTileChange(tile);
    onSelectedMapObjectsChange(widget.getMapObjectsAt(tile.x, tile.y).map(object => object.label));
  }, [
    actorId,
    cancelPlacementDraft,
    characterControllerRef,
    mapId,
    onSelectedMapObjectsChange,
    onSelectedTileChange,
    onTransferHistoryItemChange,
    refreshPlayerInventory,
  ]);

  const handleMapObjectClick = useCallback((objectId: string) => {
    if (placementDraftRef.current) {
      cancelPlacementDraft();
      return;
    }

    const placedObject = itemPlacementService.getPlacedObject(objectId);

    if (pickupChainRef.current) {
      if (placedObject) {
        const didPickup = pickupPlacedItem(placedObject.id, { closePlacedItemMenu: false });

        if (!didPickup) {
          cancelPickupChain();
        }

        return;
      }

      cancelPickupChain();
      return;
    }

    if (placedObject) {
      setPlacedItemMenu({
        placedObjectId: placedObject.id,
      });
      return;
    }

    if (objectId === TOWN_APARTMENT_OBJECT_ID) {
      onOpenApartmentPanel();
    }

    if (objectId === TOWN_ITEM_SHOP_OBJECT_ID) {
      onOpenShopPanel();
      refreshShopStock();
    }
  }, [
    cancelPickupChain,
    cancelPlacementDraft,
    onOpenApartmentPanel,
    onOpenShopPanel,
    pickupPlacedItem,
    refreshShopStock,
  ]);

  useEffect(() => {
    placementDraftRef.current = placementDraft;
    widgetRef.current?.setCharacterDraggingEnabled(
      simWorldState === GameSimWorldState.Running && !placementDraft,
    );
  }, [placementDraft, simWorldState, widgetRef]);

  useEffect(() => {
    pickupChainRef.current = pickupChain;
  }, [pickupChain]);

  return {
    cancelPickupChain,
    cancelPlacementDraft,
    closePlacedItemMenu,
    handleMapObjectClick,
    handleTileClick,
    pickupChain,
    pickupChainRef,
    pickupPlacedItem,
    placedItemMenuView,
    placementDraft,
    placementDraftRef,
    startPickupChain,
    startPlacingItem,
  };
}
