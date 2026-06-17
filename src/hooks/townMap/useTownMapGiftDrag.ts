import { useCallback, useEffect, useState } from 'react';

import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';
import type { ItemInstance } from '~/typing/item';

const GIFT_DROP_CHARACTER_RADIUS = 1;

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

interface UseTownMapGiftDragOptions {
  canvasHostRef: { current: HTMLElement | null };
  widgetRef: { current: FabricTownMapWidget | null };
  onGiftItemToCharacter: (itemInstance: ItemInstance, targetCharacterId: string) => void;
}

export function useTownMapGiftDrag({
  canvasHostRef,
  widgetRef,
  onGiftItemToCharacter,
}: UseTownMapGiftDragOptions) {
  const [giftDragState, setGiftDragState] = useState<GiftDragState | null>(null);
  const [giftTargetPicker, setGiftTargetPicker] = useState<GiftTargetPickerState | null>(null);

  const clearGiftDrag = useCallback(() => {
    setGiftDragState(null);
  }, []);

  const clearGiftTargetPicker = useCallback(() => {
    setGiftTargetPicker(null);
  }, []);

  const startGiftDrag = useCallback((itemInstance: ItemInstance, pointer: { x: number; y: number }) => {
    setGiftTargetPicker(null);
    setGiftDragState({
      itemInstance,
      pointer,
      candidateCharacterIds: [],
    });
  }, []);

  const selectGiftTarget = useCallback((characterId: string) => {
    if (!giftTargetPicker) {
      return;
    }

    onGiftItemToCharacter(giftTargetPicker.itemInstance, characterId);
    setGiftTargetPicker(null);
  }, [giftTargetPicker, onGiftItemToCharacter]);

  useEffect(() => {
    if (!giftDragState) {
      return undefined;
    }

    const handlePointerMove = (event: PointerEvent) => {
      const candidateCharacterIds = getGiftCandidateCharacterIds(
        event,
        canvasHostRef.current,
        widgetRef.current,
      );

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
      const candidateCharacterIds = getGiftCandidateCharacterIds(
        event,
        canvasHostRef.current,
        widgetRef.current,
      );

      setGiftDragState(currentState => {
        if (!currentState) {
          return null;
        }

        if (candidateCharacterIds.length === 1) {
          onGiftItemToCharacter(currentState.itemInstance, candidateCharacterIds[0]);
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
  }, [canvasHostRef, giftDragState, onGiftItemToCharacter, widgetRef]);

  return {
    clearGiftDrag,
    clearGiftTargetPicker,
    giftDragState,
    giftTargetPicker,
    selectGiftTarget,
    startGiftDrag,
  };
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
    widget?.showCharacterExpressionBubble(characterId, 'question', 700);
  });
}

function areSameStringLists(first: readonly string[], second: readonly string[]): boolean {
  return first.length === second.length && first.every((value, index) => value === second[index]);
}
