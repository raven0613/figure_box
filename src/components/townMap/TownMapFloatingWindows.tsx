import type { InventoryGroup } from '~/services/items/itemService';
import type { RequestListItem } from '~/services/characterRequests/visibility';
import type {
  ItemDefinition,
  ItemInstance,
  PlacedObject,
  ShopStockItem,
} from '~/typing/item';
import type { ApartmentResident } from '~/utils/townMapResidents';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import { InventoryPanel } from '~/components/inventory/InventoryPanel';
import { ShopPanel } from '~/components/shop/ShopPanel';
import { ApartmentPanel } from './ApartmentPanel';
import { CharacterRequestDebugPanel } from './TownMapDebugPanels';
import { ExpressionBubbleSpritePreviewWindow } from './ExpressionBubbleSpritePreviewWindow';
import { PlacedItemActionPanel, TransferHistoryPanel } from './TownMapItemPanels';

import styles from './townMap.module.scss';

interface CharacterInventoryWindow {
  characterName: string;
  groups: readonly InventoryGroup[];
}

interface PlacedItemMenuView {
  placedObject: PlacedObject;
  itemInstance: ItemInstance;
}

interface TownMapFloatingWindowsProps {
  apartmentResidents: readonly ApartmentResident[];
  characterInventoryWindow: CharacterInventoryWindow | null;
  isApartmentPanelOpen: boolean;
  isExpressionBubblePreviewOpen: boolean;
  isInventoryPanelOpen: boolean;
  isRequestPanelOpen: boolean;
  isShopPanelOpen: boolean;
  mapZoom: number;
  placedItemMenuName: string;
  placedItemMenuView: PlacedItemMenuView | null;
  playerInventoryGroups: readonly InventoryGroup[];
  requestListItems: readonly RequestListItem[];
  selectedCharacterName: string;
  shopStockItems: readonly ShopStockItem[];
  transferHistoryItem: ItemInstance | null;
  transferHistoryItemName: string;
  getDefinition: (definitionId: string) => ItemDefinition | null;
  onCloseApartment: () => void;
  onCloseCharacterInventory: () => void;
  onCloseExpressionBubblePreview: () => void;
  onCloseInventory: () => void;
  onClosePlacedItemMenu: () => void;
  onCloseRequests: () => void;
  onCloseShop: () => void;
  onCloseTransferHistory: () => void;
  onCompleteRequest: (requestId: string) => void;
  onGiftInventoryItem: (itemInstance: ItemInstance) => void;
  onLeaveApartment: (characterId: string) => void;
  onOpenTransferHistory: (itemInstance: ItemInstance) => void;
  onPickupPlacedItem: (placedObjectId: string) => void;
  onPlaceInventoryItem: (itemInstance: ItemInstance) => void;
  onPurchaseShopItem: (stockItem: ShopStockItem) => void;
  onStartDragInventoryItem: (itemInstance: ItemInstance, pointer: { x: number; y: number }) => void;
  onStartPickupChain: (placedObjectId: string) => void;
}

export function TownMapFloatingWindows({
  apartmentResidents,
  characterInventoryWindow,
  isApartmentPanelOpen,
  isExpressionBubblePreviewOpen,
  isInventoryPanelOpen,
  isRequestPanelOpen,
  isShopPanelOpen,
  mapZoom,
  placedItemMenuName,
  placedItemMenuView,
  playerInventoryGroups,
  requestListItems,
  selectedCharacterName,
  shopStockItems,
  transferHistoryItem,
  transferHistoryItemName,
  getDefinition,
  onCloseApartment,
  onCloseCharacterInventory,
  onCloseExpressionBubblePreview,
  onCloseInventory,
  onClosePlacedItemMenu,
  onCloseRequests,
  onCloseShop,
  onCloseTransferHistory,
  onCompleteRequest,
  onGiftInventoryItem,
  onLeaveApartment,
  onOpenTransferHistory,
  onPickupPlacedItem,
  onPlaceInventoryItem,
  onPurchaseShopItem,
  onStartDragInventoryItem,
  onStartPickupChain,
}: TownMapFloatingWindowsProps) {
  return (
    <>
      {isApartmentPanelOpen ? (
        <ApartmentPanel
          title="大家的公寓"
          residents={apartmentResidents}
          initialPosition={{ left: 716, top: 18 }}
          onClose={onCloseApartment}
          onLeaveApartment={onLeaveApartment}
        />
      ) : null}

      {isInventoryPanelOpen ? (
        <DraggablePanel
          title="物品欄"
          initialPosition={{ left: 716, top: 18 }}
          closeAriaLabel="關閉物品欄"
          className={styles.floatingInventoryPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onCloseInventory}
        >
          <InventoryPanel
            groups={playerInventoryGroups}
            getDefinition={getDefinition}
            giftTargetName={selectedCharacterName}
            onGiftItem={onGiftInventoryItem}
            onPlaceItem={onPlaceInventoryItem}
            onOpenTransferHistory={onOpenTransferHistory}
            onStartDragItem={onStartDragInventoryItem}
          />
        </DraggablePanel>
      ) : null}

      {transferHistoryItem ? (
        <DraggablePanel
          title="物品轉移履歷"
          initialPosition={{ left: 426, top: 18 }}
          closeAriaLabel="關閉物品轉移履歷"
          className={styles.floatingHistoryPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onCloseTransferHistory}
        >
          <TransferHistoryPanel
            itemInstance={transferHistoryItem}
            itemName={transferHistoryItemName}
          />
        </DraggablePanel>
      ) : null}

      {placedItemMenuView ? (
        <DraggablePanel
          title="地圖物品"
          initialPosition={{ left: 426, top: 190 }}
          closeAriaLabel="關閉地圖物品選單"
          className={styles.floatingPlacedItemPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onClosePlacedItemMenu}
        >
          <PlacedItemActionPanel
            itemName={placedItemMenuName}
            itemInstance={placedItemMenuView.itemInstance}
            placedObject={placedItemMenuView.placedObject}
            onPickup={() => onPickupPlacedItem(placedItemMenuView.placedObject.id)}
            onStartPickupChain={() => onStartPickupChain(placedItemMenuView.placedObject.id)}
          />
        </DraggablePanel>
      ) : null}

      {characterInventoryWindow ? (
        <DraggablePanel
          title={`${characterInventoryWindow.characterName} 的物品`}
          initialPosition={{ left: 426, top: 284 }}
          closeAriaLabel="關閉角色物品欄"
          className={styles.floatingInventoryPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onCloseCharacterInventory}
        >
          <InventoryPanel
            groups={characterInventoryWindow.groups}
            getDefinition={getDefinition}
            ownerLabel={characterInventoryWindow.characterName}
            onOpenTransferHistory={onOpenTransferHistory}
          />
        </DraggablePanel>
      ) : null}

      {isShopPanelOpen ? (
        <DraggablePanel
          title="綠地商店"
          initialPosition={{ left: 426, top: 18 }}
          closeAriaLabel="關閉綠地商店"
          className={styles.floatingShopPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onCloseShop}
        >
          <ShopPanel
            stockItems={shopStockItems}
            getDefinition={getDefinition}
            onPurchase={onPurchaseShopItem}
          />
        </DraggablePanel>
      ) : null}

      {isRequestPanelOpen ? (
        <DraggablePanel
          title="Requests"
          initialPosition={{ left: 716, top: 284 }}
          closeAriaLabel="關閉 request 面板"
          className={styles.floatingRequestPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={onCloseRequests}
        >
          <CharacterRequestDebugPanel
            items={requestListItems}
            mapZoom={mapZoom}
            onCompleteRequest={onCompleteRequest}
          />
        </DraggablePanel>
      ) : null}

      {isExpressionBubblePreviewOpen ? (
        <ExpressionBubbleSpritePreviewWindow
          onClose={onCloseExpressionBubblePreview}
        />
      ) : null}
    </>
  );
}
