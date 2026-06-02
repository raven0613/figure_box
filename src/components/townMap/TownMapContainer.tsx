import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getCharacterStateSummary,
} from '~/stateMachines/gameFlow/children/character';
import {
  normalizeRelationshipPair,
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import {
  TownCharacterController,
  type CharacterSnapshot,
} from '~/services/townCharacterController';
import { saveService } from '~/services/save/saveService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import type { CharacterRequest } from '~/services/characterRequests/types';
import {
  getApartmentRequestItems,
  getRequestListItems,
  MINOR_REQUEST_MAP_MIN_ZOOM,
  type ApartmentRequestItem,
  type RequestListItem,
} from '~/services/characterRequests/visibility';
import { CHARACTER_EVENT_DEFINITIONS_BY_ID } from '~/constants/charactarEventsDefinitions';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
import { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import { CHARACTER_SEEDS, Expression, MemoryType, SocialStatus } from '~/constants/character';
import {
  TOWN_APARTMENT_OBJECT_ID,
  TOWN_APARTMENT_SPACE_ID,
  TOWN_ITEM_SHOP_OBJECT_ID,
  TOWN_WORLD_SPACE_ID,
} from '~/constants/townMap';
import {
  CharacterBodyActionState,
  CharacterBodyMoveState,
  type CharacterStateSummary,
} from '~/stateMachines/gameFlow/states';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { TownMapTile } from '~/widgets/townMapGrid';
import { itemService, type InventoryGroup } from '~/services/items/itemService';
import { itemPlacementService } from '~/services/items/itemPlacementService';
import { itemTransferService } from '~/services/items/itemTransferService';
import { DEFAULT_ITEM_SHOP_ID, shopService } from '~/services/items/shopService';
import type {
  ItemDefinition,
  ItemDefinitionId,
  ItemInstance,
  MapId,
  PlacedObject,
  ShopStockItem,
} from '~/typing/item';
import { InventoryPanel } from '~/components/inventory/InventoryPanel';
import { ShopPanel } from '~/components/shop/ShopPanel';
import { DraggablePanel } from '~/components/common/DraggablePanel';
import { ApartmentPanel, type ApartmentResident } from './ApartmentPanel';

import styles from './townMap.module.scss';

const PLAYER_ACTOR_ID = 'player';
const PLAYER_DEMO_ITEM_IDS: readonly ItemDefinitionId[] = [
  'apple',
  'clear_gem',
  'silver_bracelet',
  'wooden_chair',
];
const GIFT_DROP_CHARACTER_RADIUS = 1;

interface TownMapContainerProps {
  expressionByCharacterId?: Partial<Record<string, Expression>>;
  mapDialoguePresentation?: EventDialoguePresentation | null;
  romanceRuleRevision?: number;
  onCharacterExpressionsChange?: (expressionByCharacterId: Partial<Record<string, Expression>>) => void;
  onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => void;
}

interface GiftDragState {
  itemInstance: ItemInstance;
  pointer: {
    x: number;
    y: number;
  };
  candidateCharacterIds: readonly string[];
}

interface GiftTargetPickerState {
  itemInstance: ItemInstance;
  candidateCharacterIds: readonly string[];
  pointer: {
    x: number;
    y: number;
  };
}

interface CharacterInventoryWindowState {
  characterId: string;
  characterName: string;
  groups: readonly InventoryGroup[];
}

interface PlacedItemView {
  placedObject: PlacedObject;
  definition: ItemDefinition;
}

interface PlacedItemMenuState {
  placedObjectId: string;
}

interface PlacedItemMenuView {
  placedObject: PlacedObject;
  itemInstance: ItemInstance;
  definition: ItemDefinition;
}

interface PickupChainState {
  actorId: typeof PLAYER_ACTOR_ID;
}

export function TownMapContainer({
  expressionByCharacterId = {},
  mapDialoguePresentation = null,
  romanceRuleRevision = 0,
  onCharacterExpressionsChange,
  onDialogueRequest,
}: TownMapContainerProps) {
  const { t } = useTranslation();
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<FabricTownMapWidget | null>(null);
  const characterControllerRef = useRef<TownCharacterController | null>(null);
  const [relationshipStore, setRelationshipStore] = useState<RelationshipStore>(() => relationshipStoreService.getSnapshot());
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  const [selectedMapObjects, setSelectedMapObjects] = useState<string[]>([]);
  // const [nearbyTiles, setNearbyTiles] = useState<TownMapTile[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_SEEDS[0].id);
  const [characterSnapshots, setCharacterSnapshots] = useState<Record<string, CharacterSnapshot>>({});
  const [joinableActivities, setJoinableActivities] = useState<readonly JoinableActivity[]>([]);
  const [godDropOpportunity, setGodDropOpportunity] = useState<GodDropOpportunity | null>(null);
  const [characterRequests, setCharacterRequests] = useState<readonly CharacterRequest[]>([]);
  const [playerInventoryGroups, setPlayerInventoryGroups] = useState<readonly InventoryGroup[]>([]);
  const [isApartmentPanelOpen, setIsApartmentPanelOpen] = useState(false);
  const [isInventoryPanelOpen, setIsInventoryPanelOpen] = useState(false);
  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false);
  const [isShopPanelOpen, setIsShopPanelOpen] = useState(false);
  const [shopStockItems, setShopStockItems] = useState<readonly ShopStockItem[]>([]);
  const [transferHistoryItem, setTransferHistoryItem] = useState<ItemInstance | null>(null);
  const [giftDragState, setGiftDragState] = useState<GiftDragState | null>(null);
  const [giftTargetPicker, setGiftTargetPicker] = useState<GiftTargetPickerState | null>(null);
  const [placementDraft, setPlacementDraft] = useState<ItemInstance | null>(null);
  const [placedItemMenu, setPlacedItemMenu] = useState<PlacedItemMenuState | null>(null);
  const [pickupChain, setPickupChain] = useState<PickupChainState | null>(null);
  const [characterInventoryWindow, setCharacterInventoryWindow] = useState<CharacterInventoryWindowState | null>(null);
  const [mapZoom, setMapZoom] = useState(1);
  const placementDraftRef = useRef<ItemInstance | null>(null);
  const pickupChainRef = useRef<PickupChainState | null>(null);
  const lastAppliedRomanceRuleRevisionRef = useRef(romanceRuleRevision);
  const requestListItems = useMemo(
    () => getRequestListItems({
      requests: characterRequests,
      snapshots: characterSnapshots,
    }),
    [characterRequests, characterSnapshots],
  );
  const apartmentRequestItems = useMemo(
    () => getApartmentRequestItems({
      requests: characterRequests,
      snapshots: characterSnapshots,
      apartmentSpaceId: TOWN_APARTMENT_SPACE_ID,
    }),
    [characterRequests, characterSnapshots],
  );
  const apartmentResidents = useMemo(
    () => getApartmentResidents(characterSnapshots, TOWN_APARTMENT_SPACE_ID, apartmentRequestItems),
    [apartmentRequestItems, characterSnapshots],
  );
  const selectedCharacterName = CHARACTER_SEEDS.find(character => character.id === selectedCharacterId)?.name ?? selectedCharacterId;
  const transferHistoryDefinition = transferHistoryItem ? itemService.getDefinition(transferHistoryItem.definitionId) : null;
  const placementDraftDefinition = placementDraft ? itemService.getDefinition(placementDraft.definitionId) : null;
  const placementDraftName = placementDraftDefinition
    ? t(placementDraftDefinition.nameKey)
    : placementDraft?.definitionId ?? '';
  const placedItemMenuView = placedItemMenu
    ? getPlacedItemMenuView(placedItemMenu.placedObjectId)
    : null;
  const placedItemMenuName = placedItemMenuView
    ? t(placedItemMenuView.definition.nameKey)
    : '';
  const snapshotExpressionByCharacterId = useMemo(
    () => Object.fromEntries(
      Object.entries(characterSnapshots).map(([characterId, snapshot]) => [
        characterId,
        snapshot.context.status.expression,
      ]),
    ) as Partial<Record<string, Expression>>,
    [characterSnapshots],
  );

  const refreshPlayerInventory = useCallback(() => {
    setPlayerInventoryGroups(itemService.getActorInventoryGroups(PLAYER_ACTOR_ID, { states: ['stored'] }));
    saveService.scheduleSaveItems();
  }, []);

  const refreshShopStock = useCallback(() => {
    setShopStockItems(shopService.getStock(DEFAULT_ITEM_SHOP_ID));
    saveService.markDirty('shops');
  }, []);

  const handleRelationshipStoreChange = useCallback((nextRelationshipStore: RelationshipStore) => {
    relationshipStoreService.load(nextRelationshipStore);
    setRelationshipStore(nextRelationshipStore);
    saveService.markDirty('relationships');
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

  const giftItemToCharacter = useCallback((itemInstance: ItemInstance, targetCharacterId: string) => {
    handleGiftItemToSelectedCharacter({
      itemInstance,
      selectedCharacterId: targetCharacterId,
      characterController: characterControllerRef.current,
      refreshPlayerInventory,
      onItemTransferred: () => {
        setTransferHistoryItem(currentItemInstance => {
          if (!currentItemInstance) {
            return null;
          }

          const latestItemInstance = itemService.getItemInstance(currentItemInstance.id);

          return latestItemInstance ?? null;
        });
        refreshOpenCharacterInventory(targetCharacterId);
      },
    });
  }, [refreshOpenCharacterInventory, refreshPlayerInventory]);

  const cancelPlacementDraft = useCallback(() => {
    placementDraftRef.current = null;
    setPlacementDraft(null);
    widgetRef.current?.setCharacterDraggingEnabled(true);
  }, []);

  const cancelPickupChain = useCallback(() => {
    pickupChainRef.current = null;
    setPickupChain(null);
  }, []);

  const pickupPlacedItem = useCallback((placedObjectId: string, options: { closePlacedItemMenu?: boolean } = {}) => {
    const shouldClosePlacedItemMenu = options.closePlacedItemMenu ?? true;
    const placedObject = itemPlacementService.getPlacedObject(placedObjectId);

    if (!placedObject) {
      if (shouldClosePlacedItemMenu) {
        setPlacedItemMenu(null);
      }

      widgetRef.current?.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));
      return false;
    }

    try {
      const pickedUpPlacedObject = itemPlacementService.pickupPlacedItem({
        placedObjectId: placedObject.id,
        actorId: PLAYER_ACTOR_ID,
      });

      if (pickedUpPlacedObject.worldPosition) {
        characterControllerRef.current?.dispatchEventOccurrence({
          eventId: 'world.mapItem.pickedUp',
          sourceActorId: PLAYER_ACTOR_ID,
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
      widgetRef.current?.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));
      return false;
    }

    if (shouldClosePlacedItemMenu) {
      setPlacedItemMenu(null);
    }

    refreshPlayerInventory();
    widgetRef.current?.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));
    setTransferHistoryItem(currentItemInstance => {
      if (!currentItemInstance || currentItemInstance.id !== placedObject.itemInstanceId) {
        return currentItemInstance;
      }

      return itemService.getItemInstance(placedObject.itemInstanceId) ?? null;
    });
    return true;
  }, [refreshPlayerInventory]);

  const startPickupChain = useCallback((placedObjectId: string) => {
    const didPickup = pickupPlacedItem(placedObjectId, { closePlacedItemMenu: false });

    if (!didPickup) {
      return;
    }

    setPlacedItemMenu(null);
    pickupChainRef.current = { actorId: PLAYER_ACTOR_ID };
    setPickupChain({ actorId: PLAYER_ACTOR_ID });
  }, [pickupPlacedItem]);

  const startPlacingItem = useCallback((itemInstance: ItemInstance) => {
    const latestItemInstance = itemService.getItemInstance(itemInstance.id);

    if (!latestItemInstance || latestItemInstance.ownerActorId !== PLAYER_ACTOR_ID) {
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

    setGiftDragState(null);
    setGiftTargetPicker(null);
    setPlacedItemMenu(null);
    cancelPickupChain();
    placementDraftRef.current = latestItemInstance;
    setPlacementDraft(latestItemInstance);
    widgetRef.current?.setCharacterDraggingEnabled(false);
  }, [cancelPickupChain, refreshPlayerInventory]);

  useEffect(() => {
    placementDraftRef.current = placementDraft;
    widgetRef.current?.setCharacterDraggingEnabled(!placementDraft);
  }, [placementDraft]);

  useEffect(() => {
    pickupChainRef.current = pickupChain;
  }, [pickupChain]);

  useEffect(() => {
    if (lastAppliedRomanceRuleRevisionRef.current === romanceRuleRevision) {
      return;
    }

    lastAppliedRomanceRuleRevisionRef.current = romanceRuleRevision;
    characterControllerRef.current?.normalizeRomanceFeelings();
  }, [romanceRuleRevision]);

  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: 10,
      onTileClick: tile => {
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
              ownerActorId: PLAYER_ACTOR_ID,
              mapId: TOWN_WORLD_SPACE_ID,
              worldPosition: {
                x: tile.x,
                y: tile.y,
              },
            });
            characterControllerRef.current?.dispatchEventOccurrence({
              eventId: 'world.mapItem.placed',
              sourceActorId: PLAYER_ACTOR_ID,
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

          if (nextPlacementItem?.ownerActorId === PLAYER_ACTOR_ID && nextPlacementItem.state === 'stored') {
            placementDraftRef.current = nextPlacementItem;
            setPlacementDraft(nextPlacementItem);
          } else {
            cancelPlacementDraft();
          }

          setSelectedTile(tile);
          setSelectedMapObjects(widget.getMapObjectsAt(tile.x, tile.y).map(object => object.label));
          refreshPlayerInventory();
          widget.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));
          setTransferHistoryItem(currentItemInstance => {
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

        setSelectedTile(tile);
        setSelectedMapObjects(widget.getMapObjectsAt(tile.x, tile.y).map(object => object.label));
        // setNearbyTiles(widget.getNeighbors(tile.x, tile.y, 1));
      },
      onMapObjectClick: objectId => {
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
          setIsApartmentPanelOpen(true);
        }

        if (objectId === TOWN_ITEM_SHOP_OBJECT_ID) {
          setIsShopPanelOpen(true);
          refreshShopStock();
        }
      },
      onZoomChange: zoom => {
        setMapZoom(zoom);
        characterControllerRef.current?.syncRequestIndicators(zoom);
      },
      onCharacterPickUp: characterId => {
        if (placementDraftRef.current) {
          cancelPlacementDraft();
          return false;
        }

        if (pickupChainRef.current) {
          cancelPickupChain();
          return false;
        }

        setSelectedCharacterId(characterId);
        characterControllerRef.current?.pickUpCharacter(characterId);
        return true;
      },
      onCharacterDrop: (characterId, tile) => {
        characterControllerRef.current?.dropCharacter(characterId, tile);
      },
    });

    widgetRef.current = widget;
    const characterController = new TownCharacterController({
      widget,
      initialRelationshipStore: relationshipStoreService.getSnapshot(),
      onDialogueRequest,
      onCharacterSnapshot: (characterId, snapshot) => {
        setCharacterSnapshots(current => ({
          ...current,
          [characterId]: snapshot,
        }));
      },
      onRelationshipStoreChange: handleRelationshipStoreChange,
      onJoinableActivitiesChange: setJoinableActivities,
      onGodDropOpportunityChange: setGodDropOpportunity,
      onCharacterRequestsChange: setCharacterRequests,
    });

    characterControllerRef.current = characterController;
    characterController.start();
    characterController.normalizeRomanceFeelings();
    widget.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));

    return () => {
      characterController.dispose();
      characterControllerRef.current = null;
      widgetRef.current = null;
      setCharacterSnapshots({});
      setJoinableActivities([]);
      setGodDropOpportunity(null);
      setCharacterRequests([]);
      setSelectedMapObjects([]);
      setIsApartmentPanelOpen(false);
      setIsShopPanelOpen(false);
      cancelPlacementDraft();
      cancelPickupChain();
      void widget.destroy();
      canvasHost.replaceChildren();
    };
  }, [cancelPickupChain, cancelPlacementDraft, handleRelationshipStoreChange, onDialogueRequest, pickupPlacedItem, refreshPlayerInventory, refreshShopStock]);

  useEffect(() => {
    seedDemoPlayerInventory();
    refreshPlayerInventory();
    refreshShopStock();
  }, [refreshPlayerInventory, refreshShopStock]);

  useEffect(() => {
    if (!giftDragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const candidateCharacterIds = getGiftCandidateCharacterIds(event, canvasHostRef.current, widgetRef.current);

      setGiftDragState(currentState => {
        if (!currentState) {
          return null;
        }

        if (!areSameStringLists(currentState.candidateCharacterIds, candidateCharacterIds)) {
          showGiftPreview(candidateCharacterIds, widgetRef.current);
        }

        return {
          ...currentState,
          pointer: {
            x: event.clientX,
            y: event.clientY,
          },
          candidateCharacterIds,
        };
      });
    };

    const handlePointerUp = (event: PointerEvent) => {
      const candidateCharacterIds = getGiftCandidateCharacterIds(event, canvasHostRef.current, widgetRef.current);

      setGiftDragState(currentState => {
        if (!currentState) {
          return null;
        }

        if (candidateCharacterIds.length === 1) {
          giftItemToCharacter(currentState.itemInstance, candidateCharacterIds[0]);
          return null;
        }

        if (candidateCharacterIds.length > 1) {
          showGiftPreview(candidateCharacterIds, widgetRef.current);
          setGiftTargetPicker({
            itemInstance: currentState.itemInstance,
            candidateCharacterIds,
            pointer: {
              x: event.clientX,
              y: event.clientY,
            },
          });
        }

        return null;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    window.addEventListener('pointercancel', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [giftDragState, giftItemToCharacter]);

  useEffect(() => {
    Object.entries(expressionByCharacterId).forEach(([characterId, expression]) => {
      if (expression) {
        characterControllerRef.current?.setCharacterExpression(characterId, expression);
      }
    });
  }, [expressionByCharacterId]);

  useEffect(() => {
    onCharacterExpressionsChange?.(snapshotExpressionByCharacterId);
  }, [onCharacterExpressionsChange, snapshotExpressionByCharacterId]);

  useEffect(() => {
    const characterController = characterControllerRef.current;

    if (!characterController || !mapDialoguePresentation) {
      return undefined;
    }

    return characterController.showMapDialoguePresentation(mapDialoguePresentation);
  }, [mapDialoguePresentation]);

  return (
    <section className={styles.container}>
      <div className={styles.mapShell}>
        <div className={styles.canvasHost} ref={canvasHostRef} />
      </div>

      {placementDraft ? (
        <div className={styles.placementHint}>
          <div>
            <strong>放置中</strong>
            <span>{placementDraftName}</span>
          </div>
          <button
            type="button"
            onClick={cancelPlacementDraft}
          >
            取消
          </button>
        </div>
      ) : null}

      {pickupChain ? (
        <div className={styles.pickupChainHint}>
          <div>
            <strong>連續撿取中</strong>
            <span>點地圖物品撿起</span>
          </div>
          <button
            type="button"
            onClick={cancelPickupChain}
          >
            取消
          </button>
        </div>
      ) : null}

      {isApartmentPanelOpen ? (
        <ApartmentPanel
          title="大家的公寓"
          residents={apartmentResidents}
          initialPosition={{ left: 716, top: 18 }}
          onClose={() => setIsApartmentPanelOpen(false)}
          onLeaveApartment={characterId => {
            characterControllerRef.current?.leaveApartment(characterId);
          }}
        />
      ) : null}

      {isInventoryPanelOpen ? (
        <DraggablePanel
          title="物品欄"
          initialPosition={{ left: 716, top: 18 }}
          closeAriaLabel="關閉物品欄"
          className={styles.floatingInventoryPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={() => {
            cancelPlacementDraft();
            setIsInventoryPanelOpen(false);
          }}
        >
          <InventoryPanel
            groups={playerInventoryGroups}
            getDefinition={definitionId => itemService.getDefinition(definitionId)}
            giftTargetName={selectedCharacterName}
            onGiftItem={itemInstance => {
              cancelPlacementDraft();
              cancelPickupChain();
              giftItemToCharacter(itemInstance, selectedCharacterId);
            }}
            onPlaceItem={startPlacingItem}
            onOpenTransferHistory={itemInstance => {
              setTransferHistoryItem(itemService.getItemInstance(itemInstance.id) ?? itemInstance);
            }}
            onStartDragItem={(itemInstance, pointer) => {
              cancelPlacementDraft();
              cancelPickupChain();
              setGiftTargetPicker(null);
              setGiftDragState({
                itemInstance,
                pointer,
                candidateCharacterIds: [],
              });
            }}
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
          onClose={() => setTransferHistoryItem(null)}
        >
          <TransferHistoryPanel
            itemInstance={transferHistoryItem}
            itemName={transferHistoryDefinition?.nameKey ?? transferHistoryItem.definitionId}
          />
        </DraggablePanel>
      ) : null}

      {placedItemMenu && placedItemMenuView ? (
        <DraggablePanel
          title="地圖物品"
          initialPosition={{ left: 426, top: 190 }}
          closeAriaLabel="關閉地圖物品選單"
          className={styles.floatingPlacedItemPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={() => setPlacedItemMenu(null)}
        >
          <PlacedItemActionPanel
            itemName={placedItemMenuName}
            itemInstance={placedItemMenuView.itemInstance}
            placedObject={placedItemMenuView.placedObject}
            onPickup={() => pickupPlacedItem(placedItemMenuView.placedObject.id)}
            onStartPickupChain={() => startPickupChain(placedItemMenuView.placedObject.id)}
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
          onClose={() => setCharacterInventoryWindow(null)}
        >
          <InventoryPanel
            groups={characterInventoryWindow.groups}
            getDefinition={definitionId => itemService.getDefinition(definitionId)}
            ownerLabel={characterInventoryWindow.characterName}
            onOpenTransferHistory={itemInstance => {
              setTransferHistoryItem(itemService.getItemInstance(itemInstance.id) ?? itemInstance);
            }}
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
          onClose={() => setIsShopPanelOpen(false)}
        >
          <ShopPanel
            stockItems={shopStockItems}
            getDefinition={definitionId => itemService.getDefinition(definitionId)}
            onPurchase={stockItem => {
              if (stockItem.stock <= 0) {
                return;
              }

              try {
                const purchaseResult = shopService.purchaseItem({
                  shopId: DEFAULT_ITEM_SHOP_ID,
                  stockItemId: stockItem.id,
                  buyerActorId: PLAYER_ACTOR_ID,
                  day: 1,
                });
                setTransferHistoryItem(currentItemInstance => {
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
            }}
          />
        </DraggablePanel>
      ) : null}

      {giftDragState ? (
        <GiftDragPreview
          itemInstance={giftDragState.itemInstance}
          pointer={giftDragState.pointer}
          candidateCount={giftDragState.candidateCharacterIds.length}
        />
      ) : null}

      {giftTargetPicker ? (
        <GiftTargetPicker
          state={giftTargetPicker}
          onSelectTarget={characterId => {
            giftItemToCharacter(giftTargetPicker.itemInstance, characterId);
            setGiftTargetPicker(null);
          }}
          onCancel={() => setGiftTargetPicker(null)}
        />
      ) : null}

      {isRequestPanelOpen ? (
        <DraggablePanel
          title="Requests"
          initialPosition={{ left: 716, top: 284 }}
          closeAriaLabel="關閉 request 面板"
          className={styles.floatingRequestPanel}
          contentClassName={styles.floatingPanelContent}
          onClose={() => setIsRequestPanelOpen(false)}
        >
          <CharacterRequestDebugPanel
            items={requestListItems}
            mapZoom={mapZoom}
            onCompleteRequest={requestId => {
              characterControllerRef.current?.completeCharacterRequest(requestId);
            }}
          />
        </DraggablePanel>
      ) : null}

      <aside className={styles.panel}>
        <div className={styles.info}>
          <div className={styles.panelTitle}>Town Grid</div>
          <div className={styles.detailRow}>
            <span>Selected</span>
            <strong>{selectedTile ? `${selectedTile.x}, ${selectedTile.y}` : '-'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Terrain</span>
            <strong>{selectedTile?.cell.terrain ?? '-'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Walkable</span>
            <strong>{selectedTile ? String(selectedTile.cell.walkable) : '-'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Occupant</span>
            <strong>
              {selectedTile && widgetRef.current
                ? widgetRef.current.getOccupantIdsAt(selectedTile.x, selectedTile.y).join(', ') || '-'
                : '-'}
            </strong>
          </div>
          <div className={styles.detailRow}>
            <span>Object</span>
            <strong>{selectedMapObjects.length > 0 ? selectedMapObjects.join(', ') : '-'}</strong>
          </div>
          {/* <div className={styles.neighborList}>
          {nearbyTiles.map(tile => (
            <span key={tile.index}>
              {tile.x},{tile.y}
            </span>
          ))}
          </div> */}

          <div className={styles.characterList}>
            {CHARACTER_SEEDS.map(character => {
              const snapshot = characterSnapshots[character.id];
              const summary = snapshot ? getCharacterStateSummary(snapshot.value) : null;
              const isSelected = selectedCharacterId === character.id;

              return (
                <div className={styles.characterRow} key={character.id}>
                  <button
                    className={`${styles.characterButton} ${isSelected ? styles.characterButtonActive : ''}`}
                    type="button"
                    onClick={() => setSelectedCharacterId(character.id)}
                  >
                    <span className={styles.characterButtonName}>{character.name}</span>
                    <strong>{summary ? summary.bodyAction : '-'}</strong>
                  </button>
                  <button
                    className={styles.characterInventoryButton}
                    type="button"
                    onClick={() => {
                      setCharacterInventoryWindow({
                        characterId: character.id,
                        characterName: character.name,
                        groups: itemService.getActorInventoryGroups(character.id),
                      });
                    }}
                    aria-label={`打開${character.name}的物品欄`}
                  >
                    物
                  </button>
                </div>
              );
            })}
          </div>

          <ActivityDebugPanel activities={joinableActivities} allSnapshots={characterSnapshots} />
          <DebugWindowActions
            isInventoryPanelOpen={isInventoryPanelOpen}
            isRequestPanelOpen={isRequestPanelOpen}
            onOpenInventory={() => setIsInventoryPanelOpen(true)}
            onOpenRequests={() => setIsRequestPanelOpen(true)}
          />
          <GodDropOpportunityPanel
            opportunity={godDropOpportunity}
            onSelectCandidate={candidateId => {
              characterControllerRef.current?.chooseGodDropCandidate(candidateId);
            }}
          />
        </div>

        {characterSnapshots[selectedCharacterId] ? (
          <CharacterStatusPanel
            snapshot={characterSnapshots[selectedCharacterId]}
            allSnapshots={characterSnapshots}
            activities={joinableActivities}
            relationshipStore={relationshipStore}
          />
        ) : null}
      </aside>
    </section>
  );
}

function getGiftCandidateCharacterIds(
  event: PointerEvent,
  canvasHost: HTMLElement | null,
  widget: FabricTownMapWidget | null,
): readonly string[] {
  if (!canvasHost || !widget) {
    return [];
  }

  const rect = canvasHost.getBoundingClientRect();

  if (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  ) {
    return [];
  }

  return widget.getCharacterIdsNearViewportPoint(
    event.clientX - rect.left,
    event.clientY - rect.top,
    GIFT_DROP_CHARACTER_RADIUS,
  );
}

function showGiftPreview(characterIds: readonly string[], widget: FabricTownMapWidget | null): void {
  characterIds.forEach(characterId => {
    widget?.showCharacterEmote(characterId, '?', 700);
  });
}

function areSameStringLists(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}

function getTilePlacementBlockReason(tile: TownMapTile, widget: FabricTownMapWidget): string | null {
  if (!tile.cell.walkable) {
    return '這格不能放置物品。';
  }

  if (widget.getOccupantIdsAt(tile.x, tile.y).length > 0) {
    return '角色站著的格子目前不能放置物品。';
  }

  if (widget.getMapObjectsAt(tile.x, tile.y).length > 0) {
    return '已有地圖物件的格子目前不能放置物品。';
  }

  return null;
}

function getPlacedItemViews(mapId: MapId): readonly PlacedItemView[] {
  return itemPlacementService.getPlacedObjects(mapId)
    .map(placedObject => {
      const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);

      if (!itemInstance) {
        return null;
      }

      const definition = itemService.getDefinition(itemInstance.definitionId);

      if (!definition) {
        return null;
      }

      return {
        placedObject,
        definition,
      };
    })
    .filter((item): item is PlacedItemView => item !== null);
}

function getPlacedItemMenuView(placedObjectId: string): PlacedItemMenuView | null {
  const placedObject = itemPlacementService.getPlacedObject(placedObjectId);

  if (!placedObject) {
    return null;
  }

  const itemInstance = itemService.getItemInstance(placedObject.itemInstanceId);

  if (!itemInstance) {
    return null;
  }

  const definition = itemService.getDefinition(itemInstance.definitionId);

  if (!definition) {
    return null;
  }

  return {
    placedObject,
    itemInstance,
    definition,
  };
}

function PlacedItemActionPanel({
  itemName,
  itemInstance,
  placedObject,
  onPickup,
  onStartPickupChain,
}: {
  itemName: string;
  itemInstance: ItemInstance;
  placedObject: PlacedObject;
  onPickup: () => void;
  onStartPickupChain: () => void;
}) {
  return (
    <div className={styles.placedItemActionPanel}>
      <div className={styles.detailRow}>
        <span>Item</span>
        <strong>{itemName}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>State</span>
        <strong>{itemInstance.state}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Tile</span>
        <strong>
          {placedObject.worldPosition
            ? `${placedObject.worldPosition.x}, ${placedObject.worldPosition.y}`
            : '-'}
        </strong>
      </div>
      <div className={styles.placedItemActions}>
        <button
          className={styles.placedItemActionButton}
          type="button"
          onClick={onPickup}
        >
          撿起
        </button>
        <button
          className={styles.placedItemActionButton}
          type="button"
          onClick={onStartPickupChain}
        >
          連續撿
        </button>
      </div>
    </div>
  );
}

function GiftDragPreview({
  itemInstance,
  pointer,
  candidateCount,
}: {
  itemInstance: ItemInstance;
  pointer: { x: number; y: number };
  candidateCount: number;
}) {
  const definition = itemService.getDefinition(itemInstance.definitionId);

  return (
    <div
      className={styles.giftDragPreview}
      style={{
        transform: `translate(${pointer.x + 12}px, ${pointer.y + 12}px)`,
      }}
    >
      <strong>{definition?.category.slice(0, 2).toUpperCase() ?? 'IT'}</strong>
      <span>{candidateCount > 0 ? `${candidateCount} target` : 'drag to character'}</span>
    </div>
  );
}

function GiftTargetPicker({
  state,
  onSelectTarget,
  onCancel,
}: {
  state: GiftTargetPickerState;
  onSelectTarget: (characterId: string) => void;
  onCancel: () => void;
}) {
  return (
    <div
      className={styles.giftTargetPicker}
      style={{
        left: state.pointer.x,
        top: state.pointer.y,
      }}
    >
      <div className={styles.giftTargetPickerTitle}>選擇要送給誰</div>
      {state.candidateCharacterIds.map(characterId => (
        <button
          className={styles.giftTargetButton}
          key={characterId}
          type="button"
          onClick={() => onSelectTarget(characterId)}
        >
          {CHARACTER_SEEDS.find(character => character.id === characterId)?.name ?? characterId}
        </button>
      ))}
      <button
        className={styles.giftTargetCancelButton}
        type="button"
        onClick={onCancel}
      >
        取消
      </button>
    </div>
  );
}

function handleGiftItemToSelectedCharacter({
  itemInstance,
  selectedCharacterId,
  characterController,
  refreshPlayerInventory,
  onItemTransferred,
}: {
  itemInstance: ItemInstance;
  selectedCharacterId: string;
  characterController: TownCharacterController | null;
  refreshPlayerInventory: () => void;
  onItemTransferred: (itemInstance: ItemInstance) => void;
}): void {
  const latestItemInstance = itemService.getItemInstance(itemInstance.id);

  if (!latestItemInstance || latestItemInstance.ownerActorId !== PLAYER_ACTOR_ID) {
    refreshPlayerInventory();
    return;
  }

  const itemDefinition = itemService.getDefinition(latestItemInstance.definitionId);

  if (!itemDefinition) {
    return;
  }

  const result = itemTransferService.transferItem({
    itemInstanceId: latestItemInstance.id,
    fromActorId: PLAYER_ACTOR_ID,
    toActorId: selectedCharacterId,
    reason: 'gift',
    day: 1,
    quantity: 1,
  });

  refreshPlayerInventory();
  onItemTransferred(result.itemInstance);
  characterController?.markCharacterRequestItemReceived({
    characterId: selectedCharacterId,
    itemId: itemDefinition.id,
    itemType: itemDefinition.type,
    itemCategory: itemDefinition.category,
    itemTags: itemDefinition.tags,
    itemDefinition,
  });
}

function TransferHistoryPanel({
  itemInstance,
  itemName,
}: {
  itemInstance: ItemInstance;
  itemName: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.transferHistoryPanel}>
      <div className={styles.detailRow}>
        <span>Item</span>
        <strong>{t(itemName)}</strong>
      </div>
      {(itemInstance.transferHistory?.length ?? 0) === 0 ? (
        <div className={styles.emptyPanelText}>沒有轉移履歷</div>
      ) : (
        <div className={styles.transferHistoryList}>
          {itemInstance.transferHistory?.map((entry, index) => (
            <div className={styles.transferHistoryRow} key={`${entry.reason}-${entry.day}-${index}`}>
              <div className={styles.detailRow}>
                <span>Day</span>
                <strong>{entry.timeOfDay ? `${entry.day} ${entry.timeOfDay}` : entry.day}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>Reason</span>
                <strong>{entry.reason}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>From</span>
                <strong>{entry.fromActorId ?? '-'}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>To</span>
                <strong>{entry.toActorId ?? '-'}</strong>
              </div>
              <div className={styles.detailRow}>
                <span>Qty</span>
                <strong>{entry.quantity}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DebugWindowActions({
  isInventoryPanelOpen,
  isRequestPanelOpen,
  onOpenInventory,
  onOpenRequests,
}: {
  isInventoryPanelOpen: boolean;
  isRequestPanelOpen: boolean;
  onOpenInventory: () => void;
  onOpenRequests: () => void;
}) {
  return (
    <div className={styles.debugWindowActions}>
      <div className={styles.panelTitle}>Debug Windows</div>
      <button
        className={styles.debugWindowButton}
        type="button"
        onClick={onOpenInventory}
        disabled={isInventoryPanelOpen}
      >
        打開物品欄
      </button>
      <button
        className={styles.debugWindowButton}
        type="button"
        onClick={onOpenRequests}
        disabled={isRequestPanelOpen}
      >
        打開 Requests
      </button>
    </div>
  );
}

function seedDemoPlayerInventory(): void {
  if (itemService.getActorItems(PLAYER_ACTOR_ID).length > 0) {
    return;
  }

  PLAYER_DEMO_ITEM_IDS.forEach((definitionId, index) => {
    itemService.createItemInstance({
      definitionId,
      ownerActorId: PLAYER_ACTOR_ID,
      quantity: definitionId === 'apple' ? 3 : 1,
      day: index + 1,
    });
  });
}

function getApartmentResidents(
  snapshots: Record<string, CharacterSnapshot>,
  apartmentSpaceId: string,
  apartmentRequests: readonly ApartmentRequestItem[],
): ApartmentResident[] {
  return Object.values(snapshots)
    .filter(snapshot => (
      snapshot.context.presence.kind === 'contained' &&
      snapshot.context.presence.spaceId === apartmentSpaceId
    ))
    .map(snapshot => ({
      id: snapshot.context.id,
      name: snapshot.context.name,
      statusText: snapshot.context.currentMotivation,
      requests: apartmentRequests
        .filter(item => item.characterId === snapshot.context.id)
        .map(item => ({
          id: item.request.id,
          label: item.request.label,
          level: item.request.level,
          levelLabel: item.levelLabel,
          status: item.request.status,
        })),
    }));
}

function CharacterRequestDebugPanel({
  items,
  mapZoom,
  onCompleteRequest,
}: {
  items: readonly RequestListItem[];
  mapZoom: number;
  onCompleteRequest: (requestId: string) => void;
}) {
  return (
    <div className={styles.requestPanel}>
      <div className={styles.detailRow}>
        <span>Minor map zoom</span>
        <strong>{mapZoom >= MINOR_REQUEST_MAP_MIN_ZOOM ? 'visible' : `${mapZoom.toFixed(1)} / 3`}</strong>
      </div>
      {items.length === 0 ? (
        <div className={styles.detailRow}>
          <span>Active</span>
          <strong>-</strong>
        </div>
      ) : items.map(item => (
        <div className={styles.requestRow} key={item.request.id}>
          <div className={styles.detailRow}>
            <span>{item.characterName}</span>
            <strong>{item.request.status}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>{item.request.label}</span>
            <strong className={styles[getRequestLevelClassName(item.request.level)]}>
              {item.levelLabel} / {formatRequestRemainingTime(item.request)}
            </strong>
          </div>
          <div className={styles.detailRow}>
            <span>Location</span>
            <strong>{item.locationLabel}</strong>
          </div>
          {item.request.target?.targetCharacterName ? (
            <div className={styles.detailRow}>
              <span>Target</span>
              <strong>{item.request.target.targetCharacterName}</strong>
            </div>
          ) : null}
          <button
            className={styles.requestButton}
            type="button"
            onClick={() => onCompleteRequest(item.request.id)}
          >
            Complete
          </button>
        </div>
      ))}
    </div>
  );
}

function GodDropOpportunityPanel({
  opportunity,
  onSelectCandidate,
}: {
  opportunity: GodDropOpportunity | null;
  onSelectCandidate: (candidateId: string) => void;
}) {
  if (!opportunity) {
    return null;
  }

  const visibleCandidates = opportunity.candidates.slice(0, 5);

  return (
    <div className={styles.godDropPanel}>
      <div className={styles.panelTitle}>God Drop</div>
      <div className={styles.detailRow}>
        <span>Auto</span>
        <strong>{Math.max(0, Math.ceil((opportunity.autoDecisionAt - Date.now()) / 1000))}s</strong>
      </div>
      <div className={styles.godDropActions}>
        {visibleCandidates.map(candidate => (
          <button
            className={styles.godDropButton}
            key={candidate.id}
            type="button"
            onClick={() => onSelectCandidate(candidate.id)}
          >
            <span>{candidate.label}</span>
            <strong>{Math.round(candidate.score)}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRequestRemainingTime(request: CharacterRequest): string {
  if (request.expiresAt === null) {
    return 'never';
  }

  const remainingMs = Math.max(0, request.expiresAt - Date.now());
  const remainingHours = Math.floor(remainingMs / (60 * 60 * 1000));
  const remainingMinutes = Math.ceil((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  if (remainingHours <= 0) {
    return `${remainingMinutes}m`;
  }

  return `${remainingHours}h ${remainingMinutes}m`;
}

function getRequestLevelClassName(level: CharacterRequest['level']): string {
  if (level === 'critical') {
    return 'requestLevelCritical';
  }

  if (level === 'social') {
    return 'requestLevelSocial';
  }

  return 'requestLevelMinor';
}

function ActivityDebugPanel({
  activities,
  allSnapshots,
}: {
  activities: readonly JoinableActivity[];
  allSnapshots: Record<string, CharacterSnapshot>;
}) {
  return (
    <div className={styles.activityPanel}>
      <div className={styles.panelTitle}>Activities</div>
      {activities.length === 0 ? (
        <div className={styles.detailRow}>
          <span>Active</span>
          <strong>-</strong>
        </div>
      ) : activities.map(activity => (
        <div className={styles.activityRow} key={activity.id}>
          <div className={styles.detailRow}>
            <span>{activity.activityKey}</span>
            <strong>{activity.phase}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Type</span>
            <strong>{activity.type}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>People</span>
            <strong>{formatActivityParticipantNames(activity, allSnapshots)}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Arrived</span>
            <strong>{formatActivityArrivalDebug(activity, allSnapshots)}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Location</span>
            <strong>{activity.location ? `${activity.location.x}, ${activity.location.y}` : '-'}</strong>
          </div>
          <div className={styles.detailRow}>
            <span>Ends in</span>
            <strong>{formatActivityRemainingTime(activity)}</strong>
          </div>
        </div>
      ))}
    </div>
  );
}

function formatActivityRemainingTime(activity: JoinableActivity): string {
  if (activity.pausedAt !== undefined) {
    return `${Math.max(0, Math.ceil((activity.remainingMs ?? 0) / 1000))}s paused`;
  }

  return `${Math.max(0, Math.ceil((activity.endsAt - Date.now()) / 1000))}s`;
}

function formatActivityParticipantNames(
  activity: JoinableActivity,
  allSnapshots: Record<string, CharacterSnapshot>,
): string {
  return activity.participantIds
    .map(characterId => allSnapshots[characterId]?.context.name ?? characterId)
    .join(', ');
}

function formatActivityArrivalDebug(
  activity: JoinableActivity,
  allSnapshots: Record<string, CharacterSnapshot>,
): string {
  if (!activity.location) {
    return '-';
  }

  const activityLocation = activity.location;

  return activity.participantIds
    .map(characterId => {
      const snapshot = allSnapshots[characterId];
      const name = snapshot?.context.name ?? characterId;

      if (!snapshot) {
        return `${name}: no snapshot`;
      }

      const position = snapshot.context.position;
      const target = snapshot.context.target;
      const isArrived = isNearPosition(position, activityLocation, 2);
      const status = isArrived ? 'arrived' : 'not yet';
      const targetText = target ? ` -> ${target.x},${target.y}` : '';

      return `${name}: ${status} (${position.x},${position.y}${targetText})`;
    })
    .join(' / ');
}

function CharacterStatusPanel({ snapshot, allSnapshots, activities, relationshipStore }: {
  snapshot: CharacterSnapshot;
  allSnapshots: Record<string, CharacterSnapshot>;
  activities: readonly JoinableActivity[];
  relationshipStore: RelationshipStore;
}) {
  const summary = getCharacterStateSummary(snapshot.value);
  const inviteAvailability = getInviteAvailabilityDebugText(snapshot, summary);
  const chatMoodAcceptance = getMoodAcceptanceDebugText('environment.nearbyCharacter.chat', snapshot.context.status.moodValue);
  const playMoodAcceptance = getMoodAcceptanceDebugText('environment.nearbyCharacter.play', snapshot.context.status.moodValue);
  const chatFinalAcceptance = getFinalAcceptanceDebugText(inviteAvailability.isAvailable, chatMoodAcceptance);
  const playFinalAcceptance = getFinalAcceptanceDebugText(inviteAvailability.isAvailable, playMoodAcceptance);
  const currentActivityId = snapshot.context.currentActivity?.activityId ?? snapshot.context.pendingActivityJoin?.activityId;
  const currentActivity = currentActivityId
    ? activities.find(activity => activity.id === currentActivityId)
    : undefined;

  return (
    <div className={styles.characterPanel}>
      <div className={styles.panelTitle}>{snapshot.context.name}</div>
      <div className={styles.detailRow}>
        <span>Body action</span>
        <strong>{summary.bodyAction}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Body move</span>
        <strong>{summary.bodyMove}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Mind</span>
        <strong>{summary.mind}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Comm</span>
        <strong>{summary.communication}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Control</span>
        <strong>{summary.control}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Motivation</span>
        <strong>{snapshot.context.currentMotivation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Activity</span>
        <strong>{snapshot.context.currentActivity?.activityId ?? snapshot.context.pendingActivityJoin?.activityId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Activity members</span>
        <strong>{currentActivity ? formatActivityParticipantNames(currentActivity, allSnapshots) : '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Event bucket</span>
        <strong>{snapshot.context.lastEventDecision?.selectedBucketId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Event picked</span>
        <strong>{snapshot.context.lastEventDecision?.selectedCandidateId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Variant</span>
        <strong>{snapshot.context.lastEventDecision?.selectedPresentationVariantId ?? '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Tags</span>
        <strong>{snapshot.context.lastEventDecision?.selectedPresentationTags.join(', ') || '-'}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Candidates</span>
        <strong>{snapshot.context.lastEventDecision?.candidateCount ?? 0}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Saturation</span>
        <strong>{snapshot.context.status.saturation}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Mood</span>
        <strong>{snapshot.context.status.moodValue}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play need</span>
        <strong>{Math.round(snapshot.context.status.playNeed)}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Invite ready</span>
        <strong>{inviteAvailability.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat mood</span>
        <strong>{chatMoodAcceptance.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat final</span>
        <strong>{chatFinalAcceptance}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play mood</span>
        <strong>{playMoodAcceptance.text}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play final</span>
        <strong>{playFinalAcceptance}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Eat score</span>
        <strong>{snapshot.context.utilityScores.findFood}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Play score</span>
        <strong>{snapshot.context.utilityScores.play}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Rest score</span>
        <strong>{snapshot.context.utilityScores.rest}</strong>
      </div>
      <div className={styles.detailRow}>
        <span>Chat score</span>
        <strong>{snapshot.context.utilityScores.chat}</strong>
      </div>
      {snapshot.context.relationships.map(relationship => {
        const targetName = allSnapshots[relationship.targetCharId]?.context.name ?? relationship.targetCharId;
        const pair = normalizeRelationshipPair(snapshot.context.id, relationship.targetCharId);
        const mutualStatus = pair
          ? relationshipStore.mutualRelationships.find(
            m => m.charIds[0] === pair[0] && m.charIds[1] === pair[1],
          )?.status ?? SocialStatus.Stranger
          : SocialStatus.Stranger;

        return (
          <div className={styles.relationshipRow} key={relationship.targetCharId}>
            <div className={styles.detailRow}>
              <span>{targetName}</span>
            </div>
            <div className={styles.detailRow}>
              <span>Feeling</span>
              <strong>{relationship.feeling}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Intimacy</span>
              <strong>{relationship.intimacy}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Relationship</span>
              <strong>{mutualStatus}</strong>
            </div>
            <div className={styles.detailRow}>
              <span>Impression</span>
              <strong>{relationship.memories[MemoryType.Impression].counts}</strong>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getMoodAcceptanceDebugText(eventId: string, moodValue: number): { isGuaranteed: boolean; text: string } {
  const acceptance = CHARACTER_EVENT_DEFINITIONS_BY_ID[eventId]?.acceptance;

  if (!acceptance) {
    return { isGuaranteed: false, text: '-' };
  }

  const minMoodValue = acceptance.minMoodValue ?? 30;
  const fallbackPercent = Math.round((acceptance.fallbackChance ?? 0.3) * 100);
  const isGuaranteed = moodValue >= minMoodValue;
  const state = isGuaranteed ? 'yes' : `${fallbackPercent}%`;

  return {
    isGuaranteed,
    text: `${state} (mood >= ${minMoodValue}, fallback ${fallbackPercent}%)`,
  };
}

function getFinalAcceptanceDebugText(
  isAvailable: boolean,
  moodAcceptance: { isGuaranteed: boolean; text: string },
): string {
  if (!isAvailable) {
    return 'no (busy)';
  }

  return moodAcceptance.isGuaranteed ? 'yes' : moodAcceptance.text;
}

function getInviteAvailabilityDebugText(
  snapshot: CharacterSnapshot,
  summary: CharacterStateSummary,
): { isAvailable: boolean; text: string } {
  if (snapshot.context.target) {
    return { isAvailable: false, text: 'no (has target)' };
  }

  if (snapshot.context.currentMotivation !== 'idle') {
    return { isAvailable: false, text: `no (${snapshot.context.currentMotivation})` };
  }

  if (summary.bodyAction !== CharacterBodyActionState.Idle || summary.bodyMove !== CharacterBodyMoveState.Stand) {
    return { isAvailable: false, text: `no (${summary.bodyMove}/${summary.bodyAction})` };
  }

  if (snapshot.context.locks.bodyAction.length > 0 || snapshot.context.locks.bodyMove.length > 0) {
    return { isAvailable: false, text: 'no (locked)' };
  }

  return { isAvailable: true, text: 'yes' };
}

function isNearPosition(position: { x: number; y: number }, target: { x: number; y: number }, range: number): boolean {
  return Math.max(
    Math.abs(position.x - target.x),
    Math.abs(position.y - target.y),
  ) <= range;
}
