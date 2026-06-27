import { useCallback, useMemo, useRef, useState } from 'react';
import type { ToastTone } from '~/components/common/Toast';
import {
  interactionCardService,
  type InteractionCardViewModel,
} from '~/services/interactionCards/interactionCardService';
import { getPlayableCharacters } from '~/services/playableCharacterService';
import type { InteractionCardUseFailureReason } from '~/services/townCharacterController';
import type {
  InteractionCardDropRequest,
  InteractionCardSelection,
} from '~/hooks/townMap/useTownMapInteractionCardDrop';
import type { InteractionCardDropInput } from '~/widgets/interactionCards/InteractionCardHand';

interface InteractionCardDraft {
  card: InteractionCardViewModel;
  initiatorId: string | null;
  targetId: string | null;
}

interface InteractionCardToast {
  id: number;
  message: string;
  tone: ToastTone;
}

type InteractionCardFailureToast = Omit<InteractionCardToast, 'id'>;

interface UseInteractionCardSessionOptions {
  characterRosterRevision: number;
  pauseSimWorld: () => void;
  resumeSimWorld: () => void;
}

export function useInteractionCardSession({
  characterRosterRevision,
  pauseSimWorld,
  resumeSimWorld,
}: UseInteractionCardSessionOptions) {
  const cards = useMemo(() => interactionCardService.getAvailableCards(), []);
  const [draft, setDraft] = useState<InteractionCardDraft | null>(null);
  const [dropRequest, setDropRequest] = useState<InteractionCardDropRequest | null>(null);
  const [toast, setToast] = useState<InteractionCardToast | null>(null);
  const isTargetingPausedRef = useRef(false);
  const nextToastIdRef = useRef(0);
  const characterNamesById = useMemo(() => (
    getPlayableCharacters().reduce<Record<string, string>>(
      (namesById, character) => ({
        ...namesById,
        [character.id]: character.name,
      }),
      {},
    )
  ), [characterRosterRevision]);
  const promptText = useMemo(() => {
    if (!draft) {
      return null;
    }

    return formatInteractionCardPrompt(
      draft.card.promptTemplate,
      draft.initiatorId
        ? characterNamesById[draft.initiatorId] ?? draft.initiatorId
        : '__',
      draft.targetId
        ? characterNamesById[draft.targetId] ?? draft.targetId
        : '__',
    );
  }, [characterNamesById, draft]);
  const selection = useMemo<InteractionCardSelection | null>(() => (
    draft
      ? {
        cardId: draft.card.id,
        initiatorId: draft.initiatorId,
        targetId: draft.targetId,
      }
      : null
  ), [draft]);
  const resumeTargetingPause = useCallback(() => {
    if (!isTargetingPausedRef.current) {
      return;
    }

    isTargetingPausedRef.current = false;
    resumeSimWorld();
  }, [resumeSimWorld]);
  const clearTargetingPause = useCallback(() => {
    isTargetingPausedRef.current = false;
  }, []);
  const selectCard = useCallback((card: InteractionCardViewModel) => {
    resumeTargetingPause();
    setDraft({
      card,
      initiatorId: null,
      targetId: null,
    });
    setDropRequest(null);
  }, [resumeTargetingPause]);
  const dropCard = useCallback((input: InteractionCardDropInput) => {
    resumeTargetingPause();
    setDraft({
      card: input.card,
      initiatorId: null,
      targetId: null,
    });
    setDropRequest({
      id: Date.now(),
      cardId: input.card.id,
      pointer: input.pointer,
    });
  }, [resumeTargetingPause]);
  const selectInitiator = useCallback((cardId: string, initiatorId: string) => {
    pauseSimWorld();
    isTargetingPausedRef.current = true;
    setDraft(currentDraft => {
      if (!currentDraft || currentDraft.card.id !== cardId) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        initiatorId,
        targetId: null,
      };
    });
  }, [pauseSimWorld]);
  const selectTarget = useCallback((cardId: string, targetId: string) => {
    setDraft(currentDraft => {
      if (!currentDraft || currentDraft.card.id !== cardId || !currentDraft.initiatorId) {
        return currentDraft;
      }

      return {
        ...currentDraft,
        targetId,
      };
    });
  }, []);
  const completeUse = useCallback((cardId: string) => {
    setDraft(currentDraft => (
      currentDraft?.card.id === cardId ? null : currentDraft
    ));
    setDropRequest(currentDrop => (
      currentDrop?.cardId === cardId ? null : currentDrop
    ));
    clearTargetingPause();
  }, [clearTargetingPause]);
  const failUse = useCallback((
    cardId: string,
    reason: InteractionCardUseFailureReason,
  ) => {
    setDraft(currentDraft => (
      currentDraft?.card.id === cardId ? null : currentDraft
    ));
    setDropRequest(currentDrop => (
      currentDrop?.cardId === cardId ? null : currentDrop
    ));
    resumeTargetingPause();

    const failureToast = getInteractionCardFailureToast(reason);
    nextToastIdRef.current += 1;
    setToast({
      id: nextToastIdRef.current,
      ...failureToast,
    });
  }, [resumeTargetingPause]);
  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  return {
    cards,
    dropRequest,
    promptText,
    selectedCardId: draft?.card.id ?? null,
    selection,
    toast,
    dismissToast,
    dropCard,
    selectCard,
    selectInitiator,
    selectTarget,
    completeUse,
    failUse,
    resumeTargetingPause,
  };
}

function getInteractionCardFailureToast(
  reason: InteractionCardUseFailureReason,
): InteractionCardFailureToast {
  switch (reason) {
    case 'invalidSelection':
      return {
        message: '卡片或角色選擇無效，請重新選擇。',
        tone: 'warning',
      };
    case 'characterUnavailable':
      return {
        message: '角色目前無法參加活動，請稍後再試。',
        tone: 'warning',
      };
    case 'initiatorPreparationFailed':
      return {
        message: '發起者無法進入演出位置，請稍後再試。',
        tone: 'warning',
      };
    case 'insufficientSpace':
      return {
        message: '空間不足！請到開闊的地方再試一次。',
        tone: 'warning',
      };
    case 'targetMoveFailed':
      return {
        message: '無法將目標帶到演出位置，請換個位置再試。',
        tone: 'warning',
      };
    case 'activityStartFailed':
      return {
        message: '活動無法開始，請稍後再試。',
        tone: 'error',
      };
    case 'presentationFailed':
      return {
        message: '演出載入失敗，請再試一次。',
        tone: 'error',
      };
    case 'dialogueUnavailable':
      return {
        message: '對話無法開始，請再試一次。',
        tone: 'error',
      };
  }
}

function formatInteractionCardPrompt(
  template: string,
  initiatorName: string,
  targetName: string,
): string {
  return template
    .replace('{initiator}', initiatorName)
    .replace('{target}', targetName);
}
