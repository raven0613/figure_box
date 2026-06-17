import { useCallback, useEffect, useRef } from 'react';

import type { FabricTownMapWidget } from '~/widgets/fabricTownMapWidget';

const INTERACTION_CARD_DROP_CHARACTER_RADIUS = 1;

export interface InteractionCardDropRequest {
  id: number;
  cardId: string;
  pointer: {
    x: number;
    y: number;
  };
}

export interface InteractionCardSelection {
  cardId: string;
  initiatorId: string | null;
  targetId: string | null;
}

interface UseTownMapInteractionCardDropOptions {
  canvasHostRef: { current: HTMLElement | null };
  interactionCardDropRequest: InteractionCardDropRequest | null;
  interactionCardSelection: InteractionCardSelection | null;
  widgetRef: { current: FabricTownMapWidget | null };
  onInteractionCardInitiatorSelect?: (cardId: string, initiatorId: string) => void;
  onInteractionCardTargetSelect?: (cardId: string, targetId: string) => void;
}

export function useTownMapInteractionCardDrop({
  canvasHostRef,
  interactionCardDropRequest,
  interactionCardSelection,
  widgetRef,
  onInteractionCardInitiatorSelect,
  onInteractionCardTargetSelect,
}: UseTownMapInteractionCardDropOptions) {
  const interactionCardSelectionRef = useRef<InteractionCardSelection | null>(null);
  const onInteractionCardTargetSelectRef = useRef<typeof onInteractionCardTargetSelect>(undefined);

  useEffect(() => {
    interactionCardSelectionRef.current = interactionCardSelection;
  }, [interactionCardSelection]);

  useEffect(() => {
    onInteractionCardTargetSelectRef.current = onInteractionCardTargetSelect;
  }, [onInteractionCardTargetSelect]);

  useEffect(() => {
    if (!interactionCardDropRequest) {
      return;
    }

    const candidateCharacterIds = getInteractionCardCandidateCharacterIds(
      interactionCardDropRequest.pointer,
      canvasHostRef.current,
      widgetRef.current,
    );
    const initiatorId = candidateCharacterIds[0];

    if (!initiatorId) {
      return;
    }

    widgetRef.current?.showCharacterExpressionBubble(initiatorId, 'question', 700);
    onInteractionCardInitiatorSelect?.(interactionCardDropRequest.cardId, initiatorId);
  }, [canvasHostRef, interactionCardDropRequest, onInteractionCardInitiatorSelect, widgetRef]);

  const handleInteractionCardCharacterPickUp = useCallback((
    characterId: string,
    widget: FabricTownMapWidget,
  ): boolean => {
    const cardSelection = interactionCardSelectionRef.current;

    if (!cardSelection?.initiatorId || cardSelection.targetId) {
      return false;
    }

    if (characterId !== cardSelection.initiatorId) {
      widget.showCharacterExpressionBubble(characterId, 'question', 700);
      onInteractionCardTargetSelectRef.current?.(cardSelection.cardId, characterId);
    }

    return true;
  }, []);

  return {
    handleInteractionCardCharacterPickUp,
  };
}

function getInteractionCardCandidateCharacterIds(
  pointer: { x: number; y: number },
  canvasHost: HTMLElement | null,
  widget: FabricTownMapWidget | null,
): readonly string[] {
  if (!canvasHost || !widget) {
    return [];
  }

  const rect = canvasHost.getBoundingClientRect();

  if (
    pointer.x < rect.left ||
    pointer.x > rect.right ||
    pointer.y < rect.top ||
    pointer.y > rect.bottom
  ) {
    return [];
  }

  return widget.getCharacterIdsNearViewportPoint(
    pointer.x - rect.left,
    pointer.y - rect.top,
    INTERACTION_CARD_DROP_CHARACTER_RADIUS,
  );
}
