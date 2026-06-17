import { useEffect } from 'react';

import {
  TownCharacterController,
  type CharacterSnapshot,
} from '~/services/townCharacterController';
import type { CharacterSeed } from '~/services/townCharacterTypes';
import { relationshipStoreService } from '~/services/save/relationshipStoreService';
import type { RelationshipStore } from '~/stateMachines/gameFlow/relationships';
import type { CharacterRequest } from '~/services/characterRequests/types';
import type { GodDropOpportunity } from '~/services/godDropOpportunityService';
import type { JoinableActivity } from '~/services/characterEvents/joinableActivities';
import type { CharacterPerformanceDialogueRequest } from '~/services/characterEvents/characterPerformanceRunner';
import {
  FabricTownMapWidget,
} from '~/widgets/fabricTownMapWidget';
import { loadTownCharacterSpriteSet } from '~/services/townSpritePreloadService';
import { TOWN_WORLD_SPACE_ID } from '~/constants/townMap';
import { TOWN_MAP_CELL_SIZE } from '~/constants/townMapWidgetConstants';
import type { TownMapTile } from '~/widgets/townMapGrid';
import { getPlacedItemViews } from '~/utils/townMapItemUtils';

const ALLOW_DIAGONAL_MOVEMENT = false; // 斜走 斜線

interface UseTownMapWidgetOptions {
  canvasHostRef: { current: HTMLDivElement | null };
  characterControllerRef: { current: TownCharacterController | null };
  playableCharacters: readonly CharacterSeed[];
  widgetRef: { current: FabricTownMapWidget | null };
  onActivitySettled?: (activityId: string) => void;
  onCharacterRequestsChange: (requests: readonly CharacterRequest[]) => void;
  onCharacterSnapshotChange: (updater: (current: Record<string, CharacterSnapshot>) => Record<string, CharacterSnapshot>) => void;
  onDialogueRequest?: (request: CharacterPerformanceDialogueRequest) => void;
  onGodDropOpportunityChange: (opportunity: GodDropOpportunity | null) => void;
  onJoinableActivitiesChange: (activities: readonly JoinableActivity[]) => void;
  onMapObjectsClear: () => void;
  onRelationshipStoreChange: (relationshipStore: RelationshipStore) => void;
  onApartmentPanelClose: () => void;
  onCharacterPickUp: (characterId: string, widget: FabricTownMapWidget) => boolean;
  onCharacterSelect: (characterId: string) => void;
  onPickupChainCancel: () => void;
  onPlacementDraftCancel: () => void;
  onShopPanelClose: () => void;
  onTileClick: (tile: TownMapTile, widget: FabricTownMapWidget) => void;
  onMapObjectClick: (objectId: string) => void;
  onZoomChange: (zoom: number) => void;
}

export function useTownMapWidget({
  canvasHostRef,
  characterControllerRef,
  playableCharacters,
  widgetRef,
  onActivitySettled,
  onCharacterRequestsChange,
  onCharacterSnapshotChange,
  onDialogueRequest,
  onGodDropOpportunityChange,
  onJoinableActivitiesChange,
  onMapObjectsClear,
  onRelationshipStoreChange,
  onApartmentPanelClose,
  onCharacterPickUp,
  onCharacterSelect,
  onPickupChainCancel,
  onPlacementDraftCancel,
  onShopPanelClose,
  onTileClick,
  onMapObjectClick,
  onZoomChange,
}: UseTownMapWidgetOptions) {
  useEffect(() => {
    if (!canvasHostRef.current) {
      return;
    }

    const canvasHost = canvasHostRef.current;
    const widget = FabricTownMapWidget.mount(canvasHost, {
      cellSize: TOWN_MAP_CELL_SIZE,
      allowDiagonalMovement: ALLOW_DIAGONAL_MOVEMENT,
      onTileClick: tile => {
        onTileClick(tile, widget);
      },
      onMapObjectClick,
      onMapActivityObserve: activityId => {
        characterControllerRef.current?.observeActivity(activityId);
      },
      onZoomChange: zoom => {
        onZoomChange(zoom);
        characterControllerRef.current?.syncRequestIndicators(zoom);
      },
      onCharacterPickUp: characterId => {
        if (onCharacterPickUp(characterId, widget)) {
          return false;
        }

        onCharacterSelect(characterId);
        return characterControllerRef.current?.pickUpCharacter(characterId) ?? false;
      },
      onCharacterDrop: (characterId, tile) => {
        characterControllerRef.current?.dropCharacter(characterId, tile);
      },
    });

    widgetRef.current = widget;
    let isWidgetDisposed = false;

    void syncCharacterSpriteRenderers(widget, playableCharacters, () => isWidgetDisposed);

    const characterController = new TownCharacterController({
      widget,
      characters: playableCharacters,
      initialRelationshipStore: relationshipStoreService.getSnapshot(),
      onDialogueRequest,
      onActivitySettled,
      onCharacterSnapshot: (characterId, snapshot) => {
        onCharacterSnapshotChange(current => ({
          ...current,
          [characterId]: snapshot,
        }));
      },
      onRelationshipStoreChange,
      onJoinableActivitiesChange,
      onGodDropOpportunityChange,
      onCharacterRequestsChange,
    });

    characterControllerRef.current = characterController;
    characterController.start();
    characterController.normalizeRomanceFeelings();
    widget.syncPlacedItems(getPlacedItemViews(TOWN_WORLD_SPACE_ID));

    return () => {
      isWidgetDisposed = true;
      characterController.dispose();
      characterControllerRef.current = null;
      widgetRef.current = null;
      onCharacterSnapshotChange(() => ({}));
      onJoinableActivitiesChange([]);
      onGodDropOpportunityChange(null);
      onCharacterRequestsChange([]);
      onMapObjectsClear();
      onApartmentPanelClose();
      onShopPanelClose();
      onPlacementDraftCancel();
      onPickupChainCancel();
      void widget.destroy();
      canvasHost.replaceChildren();
    };
  }, [
    canvasHostRef,
    characterControllerRef,
    playableCharacters,
    widgetRef,
    onActivitySettled,
    onCharacterRequestsChange,
    onCharacterSnapshotChange,
    onDialogueRequest,
    onGodDropOpportunityChange,
    onJoinableActivitiesChange,
    onMapObjectsClear,
    onRelationshipStoreChange,
    onApartmentPanelClose,
    onCharacterPickUp,
    onCharacterSelect,
    onPickupChainCancel,
    onPlacementDraftCancel,
    onShopPanelClose,
    onTileClick,
    onMapObjectClick,
    onZoomChange,
  ]);
}

async function syncCharacterSpriteRenderers(
  widget: FabricTownMapWidget,
  characters: readonly CharacterSeed[],
  isWidgetDisposed: () => boolean,
): Promise<void> {
  await Promise.all(
    characters.map(async character => {
      try {
        const spriteSet = await loadTownCharacterSpriteSet(character);

        if (isWidgetDisposed()) {
          return;
        }

        await widget.setCharacterSpriteSheets(character.id, spriteSet);
      } catch (error) {
        console.error('Failed to sync town character sprite renderer:', error);
      }
    }),
  );
}
