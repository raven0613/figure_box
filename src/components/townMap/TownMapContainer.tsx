import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  type RelationshipStore,
} from '~/stateMachines/gameFlow/relationships';
import type {
  TownCharacterController,
  CharacterSnapshot,
} from '~/services/townCharacterController';
import { saveService } from '~/services/save/saveService';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import type { CharacterRequest } from '~/services/characterRequests/types';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import { CHARACTER_SEEDS, type ExpressionPresetId } from '~/constants/character';
import {
  TOWN_WORLD_SPACE_ID,
} from '~/constants/townMap';
import {
  GameSimWorldState,
} from '~/stateMachines/gameFlow/states';
import type { EventDialoguePresentation } from '~/typing/eventDialoguePresentation';
import type { TownMapTile } from '~/widgets/townMapGrid';
import { getPlayableCharacters } from '~/services/playableCharacterService';
import type {
  ItemInstance,
} from '~/typing/item';
import { useTownMapActivityObservation } from '~/hooks/townMap/useTownMapActivityObservation';
import { useTownMapControllerSync } from '~/hooks/townMap/useTownMapControllerSync';
import { useTownMapGiftDrag } from '~/hooks/townMap/useTownMapGiftDrag';
import { useTownMapInventoryActions } from '~/hooks/townMap/useTownMapInventoryActions';
import {
  useTownMapInteractionCardDrop,
  type InteractionCardDropRequest,
  type InteractionCardSelection,
} from '~/hooks/townMap/useTownMapInteractionCardDrop';
import { useTownMapPlacement } from '~/hooks/townMap/useTownMapPlacement';
import { useTownMapViewModel } from '~/hooks/townMap/useTownMapViewModel';
import { useTownMapWidget } from '~/hooks/townMap/useTownMapWidget';
import { TownMapFloatingWindows } from './TownMapFloatingWindows';
import { GiftDragPreview, GiftTargetPicker } from './TownMapGiftDrag';
import { TownMapSidebar } from './TownMapSidebar';

import styles from './townMap.module.scss';

const PLAYER_ACTOR_ID = 'player';
interface TownMapContainerProps {
  simWorldState?: GameSimWorldState;
  expressionPresetIdByCharacterId?: Partial<Record<string, ExpressionPresetId>>;
  mapDialoguePresentation?: EventDialoguePresentation | null;
  romanceRuleRevision?: number;
  characterRosterRevision?: number;
  apartmentReveal?: {
    characterId: string;
    revision: number;
  } | null;
  trackCharacterRequest?: {
    characterId: string;
    revision: number;
  } | null;
  interactionCardDropRequest?: InteractionCardDropRequest | null;
  interactionCardSelection?: InteractionCardSelection | null;
  onInteractionCardInitiatorSelect?: (cardId: string, initiatorId: string) => void;
  onInteractionCardTargetSelect?: (cardId: string, targetId: string) => void;
  onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => void;
  onActivitySettled?: (activityId: string) => void;
  observedActivityId?: string | null;
}

export function TownMapContainer({
  simWorldState = GameSimWorldState.Running,
  expressionPresetIdByCharacterId = {},
  mapDialoguePresentation = null,
  romanceRuleRevision = 0,
  characterRosterRevision = 0,
  apartmentReveal = null,
  trackCharacterRequest = null,
  interactionCardDropRequest = null,
  interactionCardSelection = null,
  onInteractionCardInitiatorSelect,
  onInteractionCardTargetSelect,
  onDialogueRequest,
  onActivitySettled,
  observedActivityId = null,
}: TownMapContainerProps) {
  const { t } = useTranslation();
  const canvasHostRef = useRef<HTMLDivElement | null>(null);
  const widgetRef = useRef<FabricTownMapWidget | null>(null);
  const characterControllerRef = useRef<TownCharacterController | null>(null);
  const [relationshipStore, setRelationshipStore] = useState<RelationshipStore>(() => relationshipStoreService.getSnapshot());
  const [selectedTile, setSelectedTile] = useState<TownMapTile | null>(null);
  const [selectedMapObjects, setSelectedMapObjects] = useState<string[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>(CHARACTER_SEEDS[0].id);
  const [characterSnapshots, setCharacterSnapshots] = useState<Record<string, CharacterSnapshot>>({});
  const [joinableActivities, setJoinableActivities] = useState<readonly JoinableActivity[]>([]);
  const [godDropOpportunity, setGodDropOpportunity] = useState<GodDropOpportunity | null>(null);
  const [characterRequests, setCharacterRequests] = useState<readonly CharacterRequest[]>([]);
  const [isApartmentPanelOpen, setIsApartmentPanelOpen] = useState(false);
  const [isInventoryPanelOpen, setIsInventoryPanelOpen] = useState(false);
  const [isRequestPanelOpen, setIsRequestPanelOpen] = useState(false);
  const [isExpressionBubblePreviewOpen, setIsExpressionBubblePreviewOpen] = useState(false);
  const [isShopPanelOpen, setIsShopPanelOpen] = useState(false);
  const [mapZoom, setMapZoom] = useState(1);
  const playableCharacters = useMemo(
    () => getPlayableCharacters(),
    [characterRosterRevision],
  );
  const {
    apartmentResidents,
    requestListItems,
    selectedCharacterName,
    selectedOccupantIds,
  } = useTownMapViewModel({
    apartmentRevealCharacterId: apartmentReveal?.characterId ?? null,
    characterRequests,
    characterSnapshots,
    playableCharacters,
    selectedCharacterId,
    selectedTile,
    widgetRef,
  });
  const {
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
  } = useTownMapInventoryActions({
    actorId: PLAYER_ACTOR_ID,
    characterControllerRef,
  });
  const transferHistoryDefinition = transferHistoryItem ? getItemDefinition(transferHistoryItem.definitionId) : null;

  const handleRelationshipStoreChange = useCallback((nextRelationshipStore: RelationshipStore) => {
    relationshipStoreService.load(nextRelationshipStore);
    setRelationshipStore(nextRelationshipStore);
    saveService.markDirty('relationships');
  }, []);

  const {
    clearGiftDrag,
    clearGiftTargetPicker,
    giftDragState,
    giftTargetPicker,
    selectGiftTarget,
    startGiftDrag,
  } = useTownMapGiftDrag({
    canvasHostRef,
    widgetRef,
    onGiftItemToCharacter: giftItemToCharacter,
  });
  const {
    handleInteractionCardCharacterPickUp,
  } = useTownMapInteractionCardDrop({
    canvasHostRef,
    interactionCardDropRequest,
    interactionCardSelection,
    widgetRef,
    onInteractionCardInitiatorSelect,
    onInteractionCardTargetSelect,
  });

  const openApartmentPanel = useCallback(() => {
    setIsApartmentPanelOpen(true);
  }, []);

  const openShopPanel = useCallback(() => {
    setIsShopPanelOpen(true);
  }, []);

  const {
    cancelPickupChain,
    cancelPlacementDraft,
    closePlacedItemMenu,
    handleMapObjectClick: handleTownMapObjectClick,
    handleTileClick: handleTownMapTileClick,
    pickupChain,
    pickupChainRef,
    pickupPlacedItem,
    placedItemMenuView,
    placementDraft,
    placementDraftRef,
    startPickupChain,
    startPlacingItem,
  } = useTownMapPlacement({
    actorId: PLAYER_ACTOR_ID,
    characterControllerRef,
    mapId: TOWN_WORLD_SPACE_ID,
    simWorldState,
    widgetRef,
    onGiftDragClear: clearGiftDrag,
    onGiftTargetPickerClear: clearGiftTargetPicker,
    onOpenApartmentPanel: openApartmentPanel,
    onOpenShopPanel: openShopPanel,
    onSelectedMapObjectsChange: setSelectedMapObjects,
    onSelectedTileChange: setSelectedTile,
    onTransferHistoryItemChange: updateTransferHistoryItem,
    refreshPlayerInventory,
    refreshShopStock,
  });

  const placementDraftDefinition = placementDraft ? getItemDefinition(placementDraft.definitionId) : null;
  const placementDraftName = placementDraftDefinition
    ? t(placementDraftDefinition.nameKey)
    : placementDraft?.definitionId ?? '';
  const placedItemMenuName = placedItemMenuView
    ? t(placedItemMenuView.definition.nameKey)
    : '';

  const closeInventoryPanel = useCallback(() => {
    cancelPlacementDraft();
    setIsInventoryPanelOpen(false);
  }, [cancelPlacementDraft]);

  const giftInventoryItem = useCallback((itemInstance: ItemInstance) => {
    cancelPlacementDraft();
    cancelPickupChain();
    giftItemToCharacter(itemInstance, selectedCharacterId);
  }, [cancelPickupChain, cancelPlacementDraft, giftItemToCharacter, selectedCharacterId]);

  const startDragInventoryItem = useCallback((itemInstance: ItemInstance, pointer: { x: number; y: number }) => {
    cancelPlacementDraft();
    cancelPickupChain();
    startGiftDrag(itemInstance, pointer);
  }, [cancelPickupChain, cancelPlacementDraft, startGiftDrag]);

  const leaveApartment = useCallback((characterId: string) => {
    characterControllerRef.current?.leaveApartment(characterId);
  }, []);

  const completeRequest = useCallback((requestId: string) => {
    characterControllerRef.current?.completeCharacterRequest(requestId);
  }, []);

  const selectGodDropCandidate = useCallback((candidateId: string) => {
    characterControllerRef.current?.chooseGodDropCandidate(candidateId);
  }, []);

  const handleCharacterPickUp = useCallback((characterId: string, widget: FabricTownMapWidget) => {
    if (handleInteractionCardCharacterPickUp(characterId, widget)) {
      return true;
    }

    if (placementDraftRef.current) {
      cancelPlacementDraft();
      return true;
    }

    if (pickupChainRef.current) {
      cancelPickupChain();
      return true;
    }

    return false;
  }, [
    cancelPickupChain,
    cancelPlacementDraft,
    handleInteractionCardCharacterPickUp,
    pickupChainRef,
    placementDraftRef,
  ]);

  const clearSelectedMapObjects = useCallback(() => {
    setSelectedMapObjects([]);
  }, []);

  const closeApartmentPanel = useCallback(() => {
    setIsApartmentPanelOpen(false);
  }, []);

  const closeShopPanel = useCallback(() => {
    setIsShopPanelOpen(false);
  }, []);

  useTownMapWidget({
    canvasHostRef,
    characterControllerRef,
    playableCharacters,
    widgetRef,
    onActivitySettled,
    onCharacterRequestsChange: setCharacterRequests,
    onCharacterSnapshotChange: setCharacterSnapshots,
    onDialogueRequest,
    onGodDropOpportunityChange: setGodDropOpportunity,
    onJoinableActivitiesChange: setJoinableActivities,
    onMapObjectsClear: clearSelectedMapObjects,
    onRelationshipStoreChange: handleRelationshipStoreChange,
    onApartmentPanelClose: closeApartmentPanel,
    onCharacterPickUp: handleCharacterPickUp,
    onCharacterSelect: setSelectedCharacterId,
    onPickupChainCancel: cancelPickupChain,
    onPlacementDraftCancel: cancelPlacementDraft,
    onShopPanelClose: closeShopPanel,
    onTileClick: handleTownMapTileClick,
    onMapObjectClick: handleTownMapObjectClick,
    onZoomChange: setMapZoom,
  });
  useTownMapActivityObservation({
    joinableActivities,
    observedActivityId,
    widgetRef,
  });
  useTownMapControllerSync({
    apartmentReveal,
    characterControllerRef,
    characterSnapshots,
    expressionPresetIdByCharacterId,
    mapDialoguePresentation,
    observedActivityId,
    playableCharacters,
    romanceRuleRevision,
    simWorldState,
    trackCharacterRequest,
    widgetRef,
    onApartmentPanelOpen: openApartmentPanel,
    onCharacterSelect: setSelectedCharacterId,
  });

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

      <TownMapFloatingWindows
        apartmentResidents={apartmentResidents}
        characterInventoryWindow={characterInventoryWindow}
        isApartmentPanelOpen={isApartmentPanelOpen}
        isExpressionBubblePreviewOpen={isExpressionBubblePreviewOpen}
        isInventoryPanelOpen={isInventoryPanelOpen}
        isRequestPanelOpen={isRequestPanelOpen}
        isShopPanelOpen={isShopPanelOpen}
        mapZoom={mapZoom}
        placedItemMenuName={placedItemMenuName}
        placedItemMenuView={placedItemMenuView}
        playerInventoryGroups={playerInventoryGroups}
        requestListItems={requestListItems}
        selectedCharacterName={selectedCharacterName}
        shopStockItems={shopStockItems}
        transferHistoryItem={transferHistoryItem}
        transferHistoryItemName={transferHistoryDefinition?.nameKey ?? transferHistoryItem?.definitionId ?? ''}
        getDefinition={getItemDefinition}
        onCloseApartment={() => setIsApartmentPanelOpen(false)}
        onCloseCharacterInventory={closeCharacterInventory}
        onCloseExpressionBubblePreview={() => setIsExpressionBubblePreviewOpen(false)}
        onCloseInventory={closeInventoryPanel}
        onClosePlacedItemMenu={closePlacedItemMenu}
        onCloseRequests={() => setIsRequestPanelOpen(false)}
        onCloseShop={() => setIsShopPanelOpen(false)}
        onCloseTransferHistory={closeTransferHistory}
        onCompleteRequest={completeRequest}
        onGiftInventoryItem={giftInventoryItem}
        onLeaveApartment={leaveApartment}
        onOpenTransferHistory={openTransferHistory}
        onPickupPlacedItem={pickupPlacedItem}
        onPlaceInventoryItem={startPlacingItem}
        onPurchaseShopItem={purchaseShopItem}
        onStartDragInventoryItem={startDragInventoryItem}
        onStartPickupChain={startPickupChain}
      />

      {giftDragState ? (
        <GiftDragPreview
          pointer={giftDragState.pointer}
          badgeLabel={
            getItemDefinition(giftDragState.itemInstance.definitionId)?.category.slice(0, 2).toUpperCase()
              ?? 'IT'
          }
          candidateCount={giftDragState.candidateCharacterIds.length}
        />
      ) : null}

      {giftTargetPicker ? (
        <GiftTargetPicker
          state={giftTargetPicker}
          characters={playableCharacters}
          onSelectTarget={selectGiftTarget}
          onCancel={clearGiftTargetPicker}
        />
      ) : null}

      <TownMapSidebar
        allSnapshots={characterSnapshots}
        godDropOpportunity={godDropOpportunity}
        isExpressionBubblePreviewOpen={isExpressionBubblePreviewOpen}
        isInventoryPanelOpen={isInventoryPanelOpen}
        isRequestPanelOpen={isRequestPanelOpen}
        joinableActivities={joinableActivities}
        playableCharacters={playableCharacters}
        relationshipStore={relationshipStore}
        selectedCharacterId={selectedCharacterId}
        selectedMapObjects={selectedMapObjects}
        selectedOccupantIds={selectedOccupantIds}
        selectedTile={selectedTile}
        onOpenCharacterInventory={openCharacterInventory}
        onOpenExpressionBubblePreview={() => setIsExpressionBubblePreviewOpen(true)}
        onOpenInventory={() => setIsInventoryPanelOpen(true)}
        onOpenRequests={() => setIsRequestPanelOpen(true)}
        onSelectCharacter={setSelectedCharacterId}
        onSelectGodDropCandidate={selectGodDropCandidate}
      />
    </section>
  );
}
